/**
 * Synchronizacja Poczty dostawców: z każdej skrzynki połączonej z odczytem (gmail.readonly) pobiera
 * maile od adresów / domen z kart dostawców i zwroty, przypina je do spraw i zapisuje w
 * `supplier_mail_messages`. Kolejna synchronizacja bierze tylko nowsze (z zakładką 1 h).
 * Po migracji 184 także resztę skrzynki (bez kategorii Gmaila), przesianą przez lib/mail-board/triage.
 */

import { query } from "@/lib/db/pool";
import {
  decryptToken,
  getGmailMessageMeta,
  getGmailOAuthConfig,
  getGmailThreadId,
  getGmailThreadSentTimes,
  gmailAccessToken,
  listGmailMessageIds,
  listGmailMessages,
  runAsGmailBackground,
  scopeCanReadReplies,
  type GmailMessageMeta,
} from "@/lib/google/gmail";
import {
  buildSenderIndex,
  documentRefs,
  gmailBounceQuery,
  gmailInboxQuery,
  gmailSenderQueries,
  linkToCase,
  parseFromHeader,
  senderSearchTerms,
  suppliersForSender,
  supplierMailCategory,
  type MailCase,
  type SupplierCard,
} from "@/lib/supplier-mail/match";
import { prepareWaitingShipments, syncDhlMailbox } from "@/lib/customs/dhl-sync";
import { isMikranEmail } from "@/lib/email/supplier-emails";
import { mapPool } from "@/lib/async/map-pool";
import { triageOther, type SenderRule } from "@/lib/mail-board/triage";

/** Pierwsza synchronizacja skrzynki sięga tyle wstecz. */
const FIRST_SYNC_DAYS = 30;
/** Zakładka przy kolejnych — wiadomości z opóźnionym internalDate nie przepadają. */
const OVERLAP_MS = 60 * 60_000;
/** Częściej nie ma sensu (licznik w menu i tak odświeża się co kilkadziesiąt sekund). */
export const SUPPLIER_MAIL_SYNC_EVERY_MS = 5 * 60_000;
/** Najkrótszy odstęp przy „Sprawdź teraz”. */
const FORCE_SYNC_MIN_GAP_MS = 60_000;
/** Wysoko — przy limicie starsze maile z okna by przepadły (data synchronizacji idzie naprzód). */
const MAX_MESSAGES_PER_QUERY = 3000;
const META_CONCURRENCY = 6;
/**
 * Metadane porcjami, każda porcja od razu zapisana. Błąd (np. limit Gmaila na minutę) nie kasuje pracy:
 * kolejny przebieg pomija zapisane (knownIds) i pominięte (processedIds), zamiast od nowa pobierać 30 dni.
 */
const META_CHUNK = 100;
/** Cała skrzynka: pierwszy raz tyle dni wstecz (reszta historii zostaje w Gmailu). */
const INBOX_FIRST_DAYS = 7;
/** Skrzynka bez kategorii Gmaila (promocje, społeczności, fora, powiadomienia) — na przebieg. */
const MAX_INBOX_MESSAGES = 400;

/** Pobrane, ale niezapisane (newsletter, poczta wewnętrzna…) — przy przerwanej synchronizacji nie pytamy o nie znowu. */
const processedIds = new Map<string, Set<string>>();

/** Skrzynki osób, które połączyły Gmaila ze zgodą na odczyt. */
type Mailbox = { userId: string; email: string; tokenEnc: string };

async function loadMailboxes(): Promise<Mailbox[]> {
  const { rows } = await query<{ user_id: string; google_email: string; refresh_token_enc: string; scope: string }>(
    `SELECT user_id, google_email, refresh_token_enc, scope FROM public.google_mail_connections`
  );
  return rows
    .filter((r) => scopeCanReadReplies(r.scope))
    .map((r) => ({ userId: r.user_id, email: r.google_email.toLowerCase(), tokenEnc: r.refresh_token_enc }));
}

/**
 * Odprawy DHL. Brak migracji 179 nie zatrzymuje Poczty dostawców; inny błąd (np. limit Gmaila) przerywa
 * przebieg skrzynki bez przesuwania daty synchronizacji — inaczej maile DHL z tego okna by przepadły.
 */
async function syncDhl(token: string, box: Mailbox, since: Date): Promise<void> {
  try {
    await syncDhlMailbox(token, { email: box.email, userId: box.userId }, since);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/customs_dhl_(shipments|events)/.test(message) && /does not exist|nie istnieje/.test(message)) return;
    throw e;
  }
}

type CaseRow = {
  kind: "zd" | "inquiry";
  id: string;
  supplier_id: string | null;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  from_address: string;
  dok_nr: string | null;
  dok_id: number | null;
  board_thread_id: string | null;
  sent_at: Date;
  resolved: boolean;
};

/** Sprawy z ostatnich 45 dni (ZD: ostatnia wysyłka dokumentu) i wszystkie otwarte zapytania. */
export async function loadMailCases(): Promise<CaseRow[]> {
  const { rows } = await query<CaseRow>(
    `SELECT 'zd' AS kind, e.id, e.supplier_id, e.gmail_thread_id, e.gmail_message_id, e.from_address,
            e.dok_nr, e.subiekt_dok_id AS dok_id, NULL::uuid AS board_thread_id, e.sent_at,
            (e.resolved_at IS NOT NULL) AS resolved
       FROM (
         SELECT DISTINCT ON (subiekt_dok_id) *
           FROM public.supplier_order_emails
          WHERE sent_at > now() - interval '45 days'
          ORDER BY subiekt_dok_id, sent_at DESC
       ) e
     UNION ALL
     SELECT 'inquiry', i.id, i.supplier_id, i.gmail_thread_id, i.gmail_message_id, i.from_address,
            NULL, NULL, i.thread_id, i.sent_at, (i.resolved_at IS NOT NULL)
       FROM public.supplier_inquiry_emails i
      WHERE i.resolved_at IS NULL OR i.sent_at > now() - interval '45 days'`
  );
  return rows;
}

export function toMailCase(row: CaseRow): MailCase {
  return {
    kind: row.kind,
    id: String(row.id),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    threadId: row.gmail_thread_id,
    dokNr: row.dok_nr,
    dokId: row.dok_id == null ? null : Number(row.dok_id),
    boardThreadId: row.board_thread_id ? String(row.board_thread_id) : null,
    sentAt: row.sent_at.toISOString(),
    resolved: row.resolved,
  };
}

/** Wysyłki sprzed migracji 178 nie mają wątku — dociągamy go z Gmaila nadawcy (raz). */
async function backfillThreadIds(token: string, mailbox: string, cases: CaseRow[]): Promise<void> {
  const missing = cases.filter((c) => c.gmail_thread_id == null && c.gmail_message_id && c.from_address.toLowerCase() === mailbox);
  // Błąd (np. limit Gmaila) kończy dociąganie — reszta przy kolejnej synchronizacji, bez pytania o każdą osobno.
  await mapPool(missing, META_CONCURRENCY, async (c) => {
    const threadId = await getGmailThreadId(token, c.gmail_message_id!);
    // null (wiadomość usunięta) — '' i więcej nie pytamy.
    c.gmail_thread_id = threadId ?? "";
    await query(
      c.kind === "zd"
        ? `UPDATE public.supplier_order_emails SET gmail_thread_id = $2 WHERE id = $1`
        : `UPDATE public.supplier_inquiry_emails SET gmail_thread_id = $2 WHERE id = $1`,
      [c.id, threadId ?? ""]
    );
  }).catch((e: unknown) => console.warn("[poczta] wątki starych wysyłek", mailbox, e instanceof Error ? e.message : e));
}

async function syncMailbox(
  box: Mailbox,
  cards: SupplierCard[],
  cases: CaseRow[],
  /** Reguły nadawców; null = przed migracją 184 — tylko dostawcy, jak dotąd. */
  rules: SenderRule[] | null
): Promise<{ inserted: number }> {
  const cfg = getGmailOAuthConfig();
  if (!cfg) return { inserted: 0 };
  const startedAt = new Date();
  // to_jsonb: kolumna inbox_synced_at jest od migracji 184 — zapytanie działa też bez niej.
  const { rows: syncRows } = await query<{ synced_at: Date; inbox_synced_at: string | null }>(
    `SELECT synced_at, to_jsonb(s) ->> 'inbox_synced_at' AS inbox_synced_at FROM public.supplier_mail_sync s WHERE mailbox = $1`,
    [box.email]
  );
  const firstInbox = Boolean(rules) && !syncRows[0]?.inbox_synced_at;
  // synced_at = 0 (epoka) — dotąd tylko błędy, jeszcze żadnej udanej synchronizacji.
  const firstSync = !(syncRows[0] && syncRows[0].synced_at.getTime() > 0);
  const since = !firstSync
    ? new Date(syncRows[0].synced_at.getTime() - OVERLAP_MS)
    : new Date(startedAt.getTime() - FIRST_SYNC_DAYS * 86_400_000);

  const token = await gmailAccessToken(cfg, decryptToken(cfg.tokenKey, box.tokenEnc));
  await syncDhl(token, box, since);
  await backfillThreadIds(token, box.email, cases);

  const index = buildSenderIndex(cards);
  const queries = [...gmailSenderQueries(senderSearchTerms(index), since), gmailBounceQuery(since)];
  const ids = new Set<string>();
  for (const q of queries) {
    const found = await listGmailMessageIds(token, q, MAX_MESSAGES_PER_QUERY);
    if (found.length >= MAX_MESSAGES_PER_QUERY) console.warn("[poczta] limit wiadomości w zapytaniu", box.email, q.slice(0, 120));
    for (const id of found) ids.add(id);
  }
  if (rules) {
    const inboxSince = syncRows[0]?.inbox_synced_at
      ? new Date(Date.parse(syncRows[0].inbox_synced_at) - OVERLAP_MS)
      : new Date(startedAt.getTime() - INBOX_FIRST_DAYS * 86_400_000);
    const found = await listGmailMessageIds(token, gmailInboxQuery(inboxSince), MAX_INBOX_MESSAGES);
    if (found.length >= MAX_INBOX_MESSAGES) console.warn("[poczta] limit wiadomości ze skrzynki", box.email);
    for (const id of found) ids.add(id);
  }
  if (!ids.size) {
    await reconcileRepliedInGmail(token, box.email, since);
    await markSynced(box.email, startedAt, rules != null);
    return { inserted: 0 };
  }

  const { rows: known } = await query<{ gmail_message_id: string }>(
    `SELECT gmail_message_id FROM public.supplier_mail_messages WHERE mailbox = $1 AND gmail_message_id = ANY($2::text[])`,
    [box.email, [...ids]]
  );
  const knownIds = new Set(known.map((k) => k.gmail_message_id));
  const processed = processedIds.get(box.email) ?? new Set<string>();
  processedIds.set(box.email, processed);
  const fresh = [...ids].filter((id) => !knownIds.has(id) && !processed.has(id));
  const mailCases = cases.map(toMailCase);
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += META_CHUNK) {
    const chunk = fresh.slice(i, i + META_CHUNK);
    // Bez .catch: błąd przerywa przebieg bez przesunięcia daty synchronizacji (wiadomość nie przepada).
    const metas = (await mapPool(chunk, META_CONCURRENCY, (id) => getGmailMessageMeta(token, id))).filter(
      (m): m is GmailMessageMeta => m != null
    );
    inserted += await storeMetas(box, metas, index, mailCases, rules);
    for (const id of chunk) processed.add(id);
    // Pierwsza synchronizacja: historia z 30 dni jest do wglądu, ale nie jako zaległości do reakcji —
    // po każdej porcji, bo przebieg może się przerwać przed końcem.
    if (firstSync) await markInitialHandled(box.email, startedAt);
    // Pierwsze pobranie całej skrzynki (tydzień wstecz) dociąga też starsze maile od dostawców, których
    // zapytania po nadawcach nie złapały — do historii, nie na tablicę. Nieznani zostają na półce.
    else if (firstInbox) await markInitialHandled(box.email, startedAt, { onlyNewSuppliers: true });
  }
  await reconcileRepliedInGmail(token, box.email, since);
  await markSynced(box.email, startedAt, rules != null);
  return { inserted };
}

async function markInitialHandled(mailbox: string, startedAt: Date, opts: { onlyNewSuppliers?: boolean } = {}): Promise<void> {
  await query(
    `UPDATE public.supplier_mail_messages SET handled_at = now(), handled_via = 'initial'
      WHERE mailbox = $1 AND handled_at IS NULL AND received_at < $2
        AND (NOT $3 OR (kind <> 'other' AND created_at >= $4))`,
    [mailbox, new Date(startedAt.getTime() - 86_400_000), Boolean(opts.onlyNewSuppliers), startedAt]
  );
}

/** Zapisuje wiadomości od dostawców i zwroty z jednej porcji; zwraca liczbę nowych. */
async function storeMetas(
  box: Mailbox,
  metas: GmailMessageMeta[],
  index: ReturnType<typeof buildSenderIndex>,
  mailCases: MailCase[],
  rules: SenderRule[] | null
): Promise<number> {
  // Wątki, które już są sprawą na tablicy — kolejne wiadomości od obcych dołączają bez pytania.
  const caseThreads = rules
    ? new Set(
        (
          await query<{ gmail_thread_id: string }>(
            `SELECT DISTINCT gmail_thread_id FROM public.supplier_mail_messages
              WHERE mailbox = $1 AND triage = 'case' AND gmail_thread_id = ANY($2::text[])`,
            [box.email, [...new Set(metas.map((m) => m.threadId))]]
          )
        ).rows.map((r) => r.gmail_thread_id)
      )
    : new Set<string>();
  // Numery ZD z treści — przypięcie także do ZD wysłanych poza OnTime (indeks Subiekta).
  const zdIndex = await loadZdIndex(
    metas.flatMap((m) => documentRefs([m.subject, m.snippet, ...m.attachments.map((a) => a.filename)].join("\n")).dokNrs)
  );
  let inserted = 0;
  for (const meta of metas) {
    if (meta.labelIds.includes("SENT") || meta.labelIds.includes("DRAFT")) continue;
    if (meta.kind === "internal") continue;
    const sender = parseFromHeader(meta.from);
    const supplierIds = meta.kind === "bounce" ? [] : suppliersForSender(index, sender.email);
    let triage: "case" | "review" | null = null;
    if (meta.kind !== "bounce" && !supplierIds.length) {
      // Spoza kart dostawców: tylko ludzie (bez autoodpowiedzi), przesiani regułami nadawców.
      if (!rules || meta.kind !== "supplier") continue;
      triage = triageOther({ email: sender.email, bulk: meta.bulk, rules, knownCaseThread: caseThreads.has(meta.threadId) });
      if (!triage) continue;
    }
    const attachmentNames = meta.attachments.map((a) => a.filename);
    const category = supplierMailCategory({ from: meta.from, subject: meta.subject, attachmentNames, bulk: meta.bulk });
    if (category === "newsletter" && meta.kind !== "bounce" && triage !== "case") continue;
    const text = [meta.subject, meta.snippet, ...attachmentNames].join("\n");
    const zdNr = documentRefs(text).dokNrs[0] ?? null;
    const zd = zdNr ? zdIndex.get(zdNr) : undefined;
    // Zwrot należy do nas tylko wtedy, gdy wrócił w wątku naszej wysyłki.
    const link =
      meta.kind === "bounce"
        ? (() => {
            const c = mailCases.find((x) => x.threadId && x.threadId === meta.threadId);
            return c ? { caseKind: c.kind, caseId: c.id, linkedBy: "thread" as const } : null;
          })()
        : linkToCase({ threadId: meta.threadId, text, supplierIds, category, receivedAt: meta.receivedAt }, mailCases);
    if (meta.kind === "bounce" && !link) continue;
    const linkedCase = link ? mailCases.find((c) => c.kind === link.caseKind && c.id === link.caseId) : undefined;
    const supplierId = linkedCase?.supplierId ?? zd?.supplierId ?? supplierIds[0] ?? null;

    // Ta sama wiadomość jest już z innej skrzynki (DW), ale tam bez wątku naszej wysyłki — przejmujemy
    // ją na kopię z wątku: odpowiedź z OnTime i „odpisano w Gmailu” działają tylko w skrzynce nadawcy ZD.
    if (link?.linkedBy === "thread" && meta.rfcMessageId) {
      const moved = await query(
        `UPDATE public.supplier_mail_messages
            SET mailbox = $1, owner_user_id = $2, gmail_message_id = $3, gmail_thread_id = $4,
                case_kind = $5, case_id = $6, linked_by = 'thread', supplier_id = COALESCE($7, supplier_id)
          WHERE id = (SELECT id FROM public.supplier_mail_messages
                       WHERE rfc_message_id = $8 AND mailbox <> $1 AND linked_by IS DISTINCT FROM 'thread'
                       LIMIT 1)`,
        [box.email, box.userId, meta.id, meta.threadId, link.caseKind, link.caseId, supplierId, meta.rfcMessageId]
      );
      if (moved.rowCount) continue;
    }

    const res = await query(
      `INSERT INTO public.supplier_mail_messages
         (mailbox, owner_user_id, gmail_message_id, gmail_thread_id, rfc_message_id, supplier_id, kind,
          from_address, from_name, subject, snippet, attachments, received_at, case_kind, case_id, linked_by,
          category, zd_dok_nr, zd_dok_id, triage)
       SELECT $1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20
        WHERE NOT EXISTS (
          -- Ta sama wiadomość w drugiej skrzynce (np. DW) — jedna pozycja w Poczcie.
          SELECT 1 FROM public.supplier_mail_messages WHERE rfc_message_id = NULLIF($5, '') AND mailbox <> $1
        )
       ON CONFLICT (mailbox, gmail_message_id) DO NOTHING`,
      [
        box.email,
        box.userId,
        meta.id,
        meta.threadId,
        meta.rfcMessageId,
        supplierId,
        triage ? "other" : meta.kind,
        sender.email,
        sender.name,
        meta.subject.slice(0, 500),
        meta.snippet.slice(0, 1000),
        JSON.stringify(meta.attachments),
        meta.receivedAt,
        link?.caseKind ?? null,
        link?.caseId ?? null,
        link?.linkedBy ?? null,
        // Zwrot zawsze „do reakcji” (jak odpowiedź) — mail nie doszedł.
        category === "newsletter" ? "reply" : category,
        zdNr ? `ZD ${zdNr}` : null,
        zd?.dokId ?? null,
        triage,
      ]
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

/**
 * Odpowiedź w Gmailu zamyka sprawę w OnTime: otwarta wiadomość od dostawcy, po której w tym samym
 * wątku jest nasza wiadomość (SENT), jest załatwiona („gmail”). Czytamy tylko wątki, w których od `since`
 * coś wysłaliśmy (jedna lista SENT) — bez tego co 5 min do 300 odczytów wątków, prawie zawsze bez zmian.
 */
async function reconcileRepliedInGmail(token: string, mailbox: string, since: Date): Promise<void> {
  const { rows } = await query<{ id: string; gmail_thread_id: string; received_at: Date }>(
    `SELECT id, gmail_thread_id, received_at FROM public.supplier_mail_messages
      WHERE mailbox = $1 AND handled_at IS NULL AND category IN ('reply', 'confirmation')
        AND (kind = 'supplier' OR (kind = 'other' AND triage = 'case'))
        AND received_at > now() - interval '30 days'
      ORDER BY received_at DESC LIMIT 300`,
    [mailbox]
  );
  if (!rows.length) return;
  const sentThreads = new Set(
    (await listGmailMessages(token, `in:sent after:${Math.floor(since.getTime() / 1000)}`, 500)).map((m) => m.threadId)
  );
  const threads = [...new Set(rows.map((r) => r.gmail_thread_id))].filter((t) => sentThreads.has(t));
  const sentByThread = new Map<string, number[]>();
  // Błąd (np. limit) przerywa przebieg bez przesunięcia daty — inaczej niesprawdzone wątki wypadłyby z okna `since`.
  await mapPool(threads, META_CONCURRENCY, async (threadId) => {
    const sent = await getGmailThreadSentTimes(token, threadId, isMikranEmail);
    if (sent?.length) sentByThread.set(threadId, sent);
  });
  const replied = rows.filter((r) => (sentByThread.get(r.gmail_thread_id) ?? []).some((t) => t > r.received_at.getTime()));
  if (!replied.length) return;
  await query(
    `UPDATE public.supplier_mail_messages SET handled_at = now(), handled_via = 'gmail'
      WHERE id = ANY($1::uuid[]) AND handled_at IS NULL`,
    [replied.map((r) => r.id)]
  );
}

/** ZD z indeksu Subiekta po pełnym numerze („ZD 26/M/10/2026”). */
async function loadZdIndex(nrs: string[]): Promise<Map<string, { dokId: number; supplierId: string | null }>> {
  const unique = [...new Set(nrs)];
  if (!unique.length) return new Map();
  const { rows } = await query<{ dok_id: number; dok_nr_pelny: string; supplier_id: string | null }>(
    `SELECT dok_id, dok_nr_pelny, supplier_id FROM public.subiekt_zd_index WHERE dok_nr_pelny = ANY($1::text[])`,
    [unique.map((nr) => `ZD ${nr}`)]
  );
  return new Map(
    rows.map((r) => [
      r.dok_nr_pelny.replace(/^ZD\s*/i, "").toUpperCase(),
      { dokId: Number(r.dok_id), supplierId: r.supplier_id ? String(r.supplier_id) : null },
    ])
  );
}

async function markSynced(mailbox: string, at: Date, inbox: boolean): Promise<void> {
  processedIds.delete(mailbox);
  await query(
    `INSERT INTO public.supplier_mail_sync (mailbox, synced_at, last_error) VALUES ($1, $2, NULL)
     ON CONFLICT (mailbox) DO UPDATE SET synced_at = EXCLUDED.synced_at, last_error = NULL`,
    [mailbox, at]
  );
  if (inbox) await query(`UPDATE public.supplier_mail_sync SET inbox_synced_at = $2 WHERE mailbox = $1`, [mailbox, at]);
}

/** Reguły nadawców; null przed migracją 184 (cała skrzynka jeszcze wyłączona). */
async function loadSenderRules(): Promise<SenderRule[] | null> {
  try {
    return (await query<SenderRule>(`SELECT pattern, decision FROM public.mail_sender_rules`)).rows;
  } catch (e) {
    if (e instanceof Error && /mail_sender_rules/.test(e.message) && /does not exist|nie istnieje/.test(e.message)) return null;
    throw e;
  }
}

/** Błąd nie przesuwa daty synchronizacji — kolejna próba pobierze ten sam zakres. */
async function markSyncError(mailbox: string, error: string): Promise<void> {
  await query(
    `INSERT INTO public.supplier_mail_sync (mailbox, synced_at, last_error) VALUES ($1, to_timestamp(0), $2)
     ON CONFLICT (mailbox) DO UPDATE SET last_error = EXCLUDED.last_error`,
    [mailbox, error.slice(0, 500)]
  );
}

/** Ostatnia próba w tym procesie — po błędzie też odczekujemy, zamiast pytać Gmaila co kilkanaście sekund. */
const lastAttempt = new Map<string, number>();

export type SupplierMailSyncResult = { mailboxes: number; inserted: number; errors: string[] };

/** ponytail: blokada w procesie (jeden serwer OnTime); przy kilku instancjach — advisory lock w bazie. */
let running: Promise<SupplierMailSyncResult> | null = null;
let forced: Promise<SupplierMailSyncResult> | null = null;

/**
 * Synchronizuje wszystkie skrzynki z odczytem. `force` = bez czekania na odstęp 5 min.
 * Równoległe wywołania czekają na ten sam przebieg. Błąd jednej skrzynki nie zatrzymuje reszty.
 */
export function syncSupplierMail(opts: { force?: boolean } = {}): Promise<SupplierMailSyncResult> {
  // „Sprawdź teraz” w trakcie przebiegu z odpytywania (który mógł pominąć skrzynki) — drugi przebieg po nim.
  if (running && opts.force) {
    const prev = running;
    return (forced ??= prev
      .catch(() => undefined)
      .then(() => runSync(opts))
      .finally(() => {
        forced = null;
      }));
  }
  return runSync(opts);
}

function runSync(opts: { force?: boolean }): Promise<SupplierMailSyncResult> {
  if (running) return running;
  // Praca w tle: ustępuje odczytom Gmaila, na które ktoś czeka (tablica, karta dostawcy).
  running = runAsGmailBackground(async () => {
    const result: SupplierMailSyncResult = { mailboxes: 0, inserted: 0, errors: [] };
    if (!getGmailOAuthConfig()) return result;
    const boxes = await loadMailboxes();
    if (!boxes.length) return result;
    // Przed migracją 178 nie ma tabel Poczty — bez błędu w logach co kilkanaście sekund.
    const syncRes = await query<{ mailbox: string; synced_at: Date }>(`SELECT mailbox, synced_at FROM public.supplier_mail_sync`).catch(
      (e: unknown) => {
        if (e instanceof Error && /supplier_mail_sync/.test(e.message) && /does not exist|nie istnieje/.test(e.message)) return null;
        throw e;
      }
    );
    if (!syncRes) return result;
    const syncRows = syncRes.rows;
    const lastSync = new Map(syncRows.map((r) => [r.mailbox, r.synced_at.getTime()]));
    // „Sprawdź teraz” (force) skraca odstęp do minuty — nie znosi go (Gmail API ma limity).
    const minGap = opts.force ? FORCE_SYNC_MIN_GAP_MS : SUPPLIER_MAIL_SYNC_EVERY_MS;
    const due = boxes.filter(
      (b) => Date.now() - Math.max(lastSync.get(b.email) ?? 0, lastAttempt.get(b.email) ?? 0) >= minGap
    );
    if (!due.length) return result;
    const [{ rows: cards }, cases, rules] = await Promise.all([
      query<SupplierCard>(`SELECT id, mails, notes, extra_info FROM public.suppliers`),
      loadMailCases(),
      loadSenderRules(),
    ]);
    for (const box of due) {
      result.mailboxes++;
      lastAttempt.set(box.email, Date.now());
      try {
        result.inserted += (await syncMailbox(box, cards, cases, rules)).inserted;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        result.errors.push(`${box.email}: ${message}`);
        await markSyncError(box.email, message).catch(() => undefined);
      }
    }
    // Prośby DHL czekające na odczyt AI — raz na przebieg (nie na skrzynkę), także gdy nie było nowych maili.
    await prepareWaitingShipments(due[0]?.userId ?? null).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (!/customs_dhl_shipments/.test(message)) console.error("[odprawy] automat", e);
    });
    return result;
  }).finally(() => {
    running = null;
  });
  return running;
}
