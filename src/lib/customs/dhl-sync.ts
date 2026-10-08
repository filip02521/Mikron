/**
 * Odprawy DHL Express z Gmaila: każda połączona skrzynka osoby (z odczytem) dokłada
 * zdarzenia do przesyłki o danym AWB. Kopie tej samej wiadomości (kilka skrzynek) liczą się raz
 * (Message-ID), przekazania (Fwd:) dopinają się do tej samej przesyłki. Pierwsza prośba agencji
 * zakłada odprawę: faktura z załącznika → AI → dostawca → pozycje → propozycje opisów i CN.
 */

import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { query, withClient } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayDateKeyInWarsaw, warsawDateKeyFromIso } from "@/lib/time/warsaw";
import { readStorageObject } from "@/lib/storage/local";
import {
  fetchGmailAttachment,
  getGmailMessageMeta,
  getGmailMessageText,
  listGmailMessageIds,
  type GmailMessageMeta,
} from "@/lib/google/gmail";
import { parseFromHeader } from "@/lib/supplier-mail/match";
import {
  INVOICE_EXTRACTION_PROMPT,
  INVOICE_EXTRACTION_SCHEMA,
  callCustomsGemini,
  invoiceLinesToPasteText,
  isCustomsAiConfigured,
  parseInvoiceExtraction,
  userFacingCustomsAiError,
  type InvoiceExtraction,
} from "./customs-ai";
import { TimeoutError, isGeminiQuotaExceeded, isRetryableGeminiError } from "@/lib/teeth/teeth-vision-gemini";
import { customsAiInlineData, customsFileMime } from "./customs-ai-input";
import { createCustomsClearance } from "./customs-create";
import { NOTHING_TO_PROPOSE, proposeCustomsLines } from "./customs-proposals";
import {
  DHL_GMAIL_QUERY,
  classifyDhlMail,
  dhlInvoiceAttachments,
  dhlMailNeedsBody,
  dhlTicketDate,
  isCustomsRelease,
  matchSupplierBySellerName,
  nextStage,
  stripSubjectPrefixes,
  type DhlMail,
  type DhlStage as Stage,
} from "./dhl-mail";

const STORAGE_BUCKET = "customs-documents";
const MAX_MESSAGES = 300;
/** Starszych próśb nie zakładamy automatycznie (pierwsza synchronizacja sięga 30 dni wstecz). */
const AUTO_CREATE_MAX_AGE_MS = 10 * 86_400_000;
const MAX_INVOICE_BYTES = 14 * 1024 * 1024;
const MAX_INVOICE_FILES = 4;

export type DhlInvoiceFile = { path: string; name: string; mime: string; size: number };
type Extraction = InvoiceExtraction & { file?: string };

export type DhlMailbox = { email: string; userId: string | null };

/** Notatka chwilowego błędu AI — automat ponowi odczyt przy kolejnej synchronizacji. */
export const DHL_AI_RETRY_NOTE = "AI chwilowo niedostępne - ponowię odczyt przy kolejnej synchronizacji.";

function isTransientAiError(e: unknown): boolean {
  return e instanceof TimeoutError || isGeminiQuotaExceeded(e) || isRetryableGeminiError(e);
}

/** Rodzaje, które zakładają przesyłkę; pozostałe tylko uzupełniają już znaną (np. „doręczono”). */
const CREATES_SHIPMENT = new Set<DhlMail["kind"]>([
  "request",
  "reminder",
  "agency",
  "replied",
  "confirmation",
  "customs",
  "duties",
  "paid",
]);
/** Agencja czeka na nas: prośba, ponaglenie, pytanie — od nich liczy się termin składowania. */
const STARTS_REQUEST = new Set<DhlMail["kind"]>(["request", "reminder", "agency"]);

async function findShipment(mail: DhlMail, receivedAt: string): Promise<{ id: string; awb: string } | null> {
  if (mail.awb && CREATES_SHIPMENT.has(mail.kind)) {
    const { rows } = await query<{ id: string; awb: string }>(
      `INSERT INTO public.customs_dhl_shipments (awb, first_seen_at) VALUES ($1, $2)
       ON CONFLICT (awb) DO UPDATE SET first_seen_at = LEAST(customs_dhl_shipments.first_seen_at, EXCLUDED.first_seen_at)
       RETURNING id, awb`,
      [mail.awb, receivedAt]
    );
    return rows[0] ?? null;
  }
  const { rows } = await query<{ id: string; awb: string }>(
    mail.awb
      ? `SELECT id, awb FROM public.customs_dhl_shipments WHERE awb = $1`
      : `SELECT id, awb FROM public.customs_dhl_shipments WHERE ticket = $1 ORDER BY first_seen_at DESC LIMIT 1`,
    [mail.awb ?? mail.ticket]
  );
  return rows[0] ?? null;
}

/**
 * Pliki faktury z wiadomości (oryginał albo przekazana kopia), których przesyłka jeszcze nie ma — po
 * nazwie pliku. Nowy plik bez założonej odprawy kasuje odczyt i notatkę: automat spróbuje jeszcze raz
 * (np. oryginał przyszedł bez załączników, a faktura dopiero w przekazanej kopii).
 */
async function storeInvoiceFiles(token: string, meta: GmailMessageMeta, shipment: { id: string; awb: string }): Promise<number> {
  const refs = dhlInvoiceAttachments(meta.attachments, shipment.awb).filter((r) => r.size <= MAX_INVOICE_BYTES);
  if (!refs.length) return 0;
  const { rows } = await query<{ invoice_files: DhlInvoiceFile[] }>(
    `SELECT invoice_files FROM public.customs_dhl_shipments WHERE id = $1`,
    [shipment.id]
  );
  const have = new Set((rows[0]?.invoice_files ?? []).map((f) => f.name.toLowerCase()));
  let added = 0;
  for (const ref of refs) {
    if (have.has(ref.filename.toLowerCase()) || have.size >= MAX_INVOICE_FILES) continue;
    const bytes = await fetchGmailAttachment(token, meta.id, ref.attachmentId);
    if (!bytes) continue;
    const mime = customsFileMime(ref.filename, ref.mimeType);
    const ext = ref.filename.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `customs-documents/dhl/${shipment.awb}/${randomUUID()}.${ext}`;
    const { error } = await createAdminClient()
      .storage.from(STORAGE_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`zapis faktury: ${error.message}`);
    const file: DhlInvoiceFile = { path, name: ref.filename.slice(0, 255), mime, size: bytes.length };
    // Dopisanie tylko, gdy tej nazwy jeszcze nie ma (dwie skrzynki naraz) — inaczej sprzątamy plik.
    const res = await query(
      `UPDATE public.customs_dhl_shipments
          SET invoice_files = invoice_files || $2::jsonb,
              extraction = CASE WHEN clearance_id IS NULL THEN NULL ELSE extraction END,
              note = CASE WHEN clearance_id IS NULL THEN NULL ELSE note END,
              updated_at = now()
        WHERE id = $1 AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(invoice_files) f WHERE lower(f->>'name') = lower($3)
        )`,
      [shipment.id, JSON.stringify([file]), file.name]
    );
    if (!res.rowCount) {
      await createAdminClient().storage.from(STORAGE_BUCKET).remove([path]).catch(() => undefined);
      continue;
    }
    have.add(file.name.toLowerCase());
    added++;
  }
  return added;
}

/** Zdarzenie raz (po Message-ID) i jego skutek na przesyłce. false = już znane albo przesyłki brak. */
async function applyMail(token: string, box: DhlMailbox, meta: GmailMessageMeta, mail: DhlMail): Promise<boolean> {
  const shipment = await findShipment(mail, meta.receivedAt);
  if (!shipment) return false;
  // Faktura także z przekazanej kopii — czasem tylko ona dociera do połączonej skrzynki.
  if (STARTS_REQUEST.has(mail.kind)) await storeInvoiceFiles(token, meta, shipment);
  const sender = parseFromHeader(meta.from);
  // Zdarzenie i jego skutek razem: przerwany przebieg nie zostawia zdarzenia „znanego”, a nie zastosowanego.
  return withClient(async (db) => {
    await db.query("BEGIN");
    try {
      const applied = await applyInTransaction(db, box, meta, mail, shipment.id, sender.email);
      await db.query(applied ? "COMMIT" : "ROLLBACK");
      return applied;
    } catch (e) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw e;
    }
  });
}

async function applyInTransaction(
  db: PoolClient,
  box: DhlMailbox,
  meta: GmailMessageMeta,
  mail: DhlMail,
  shipmentId: string,
  senderEmail: string
): Promise<boolean> {
  const ev = await db.query(
    `INSERT INTO public.customs_dhl_events
       (shipment_id, rfc_message_id, mailbox, gmail_message_id, gmail_thread_id, kind, forwarded, customs_code,
        from_address, subject, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (rfc_message_id) DO NOTHING`,
    [
      shipmentId,
      meta.rfcMessageId || `gmail:${box.email}:${meta.id}`,
      box.email,
      meta.id,
      meta.threadId,
      mail.kind,
      mail.forwarded,
      mail.customsCode,
      senderEmail,
      meta.subject.slice(0, 500),
      meta.receivedAt,
    ]
  );
  if (!ev.rowCount) return false;
  const { rows } = await db.query<{ stage: Stage; clearance_id: string | null }>(
    `SELECT stage, clearance_id FROM public.customs_dhl_shipments WHERE id = $1 FOR UPDATE`,
    [shipmentId]
  );
  const shipment = { id: shipmentId, stage: rows[0]!.stage, clearance_id: rows[0]!.clearance_id };

  const sets: string[] = ["last_event_at = GREATEST(last_event_at, $2::timestamptz)", "updated_at = now()"];
  const params: unknown[] = [shipment.id, meta.receivedAt];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    // Funkcja zamiast napisu: w napisie zamiany „$$” znaczy „$”.
    sets.push(sql.replaceAll("?", () => `$${params.length}`));
  };

  // Odpowiedź do agencji idzie w wątku jej ostatniej wiadomości (oryginał, nie przekazana kopia).
  // Tylko mail z numerem sprawy (T#) — DHL wymaga odpowiedzi w tym wątku i z tym tematem.
  const fromAgency = (mail.kind === "request" || mail.kind === "agency") && !mail.forwarded && Boolean(mail.ticket);
  if (fromAgency) {
    const original = stripSubjectPrefixes(meta.subject).subject;
    add("request_subject = ?", original.slice(0, 500));
    add("request_rfc_message_id = ?", meta.rfcMessageId || null);
    add("request_mailbox = ?", box.email);
    add("request_gmail_message_id = ?", meta.id);
    add("request_gmail_thread_id = ?", meta.threadId);
  } else if ((mail.kind === "request" || mail.kind === "agency") && mail.forwarded && mail.ticket) {
    // Oryginał przyszedł do niepodłączonej skrzynki — temat z T# z przekazanej kopii, inaczej odpowiedź bez numeru sprawy.
    add("request_subject = COALESCE(request_subject, ?)", stripSubjectPrefixes(meta.subject).subject.slice(0, 500));
  }
  if (STARTS_REQUEST.has(mail.kind)) {
    // Wcześniejsza z: data maila, dzień z numeru sprawy (przekazanie bywa dużo później niż prośba).
    const ticketDay = dhlTicketDate(mail.ticket);
    const at = ticketDay && ticketDay < meta.receivedAt ? ticketDay : meta.receivedAt;
    add("requested_at = LEAST(COALESCE(requested_at, ?::timestamptz), ?::timestamptz)", at);
  }
  if (mail.ticket) add("ticket = COALESCE(ticket, ?)", mail.ticket);
  if (mail.kind === "reminder" && !mail.forwarded) {
    sets.push("reminder_count = reminder_count + 1");
    add("last_reminder_at = GREATEST(last_reminder_at, ?::timestamptz)", meta.receivedAt);
  }
  if (mail.mrn) add("mrn = ?", mail.mrn);
  if (mail.kind === "duties") add("duties_due_at = COALESCE(duties_due_at, ?::timestamptz)", meta.receivedAt);
  if (mail.kind === "paid") add("duties_paid_at = COALESCE(duties_paid_at, ?::timestamptz)", meta.receivedAt);
  if (mail.kind === "delivered") add("delivered_at = COALESCE(delivered_at, ?::timestamptz)", meta.receivedAt);
  const stage = nextStage(shipment.stage, mail);
  if (stage !== shipment.stage) add("stage = ?", stage);

  await db.query(`UPDATE public.customs_dhl_shipments SET ${sets.join(", ")} WHERE id = $1`, params);

  // W odprawie MRN = zakończona (ZC429); wcześniejsze komunikaty mają inne numery zgłoszeń.
  const releaseMrn = isCustomsRelease(mail.customsCode) ? mail.mrn : null;
  if (shipment.clearance_id && (releaseMrn || mail.kind === "paid" || mail.kind === "delivered")) {
    const day = warsawDateKeyFromIso(meta.receivedAt);
    await db.query(
      `UPDATE public.customs_clearances
          SET mrn = CASE WHEN $2::text IS NOT NULL AND mrn = '' THEN $2 ELSE mrn END,
              duties_paid_at = CASE WHEN $3::boolean THEN COALESCE(duties_paid_at, $5::date) ELSE duties_paid_at END,
              delivered_at = CASE WHEN $4::boolean THEN COALESCE(delivered_at, $5::date) ELSE delivered_at END,
              updated_at = now()
        WHERE id = $1`,
      [shipment.clearance_id, releaseMrn, mail.kind === "paid", mail.kind === "delivered", day]
    );
  }
  return true;
}

/** Ostatni dostawca wybrany ręcznie dla tej samej nazwy sprzedawcy — automat uczy się z poprawek. */
async function supplierFromHistory(sellerName: string): Promise<string | null> {
  const { rows } = await query<{ supplier_id: string }>(
    `SELECT supplier_id FROM public.customs_dhl_shipments
      WHERE supplier_id IS NOT NULL AND lower(extraction->>'sellerName') = lower($1)
      ORDER BY updated_at DESC LIMIT 1`,
    [sellerName]
  );
  return rows[0]?.supplier_id ?? null;
}

async function setNote(id: string, note: string | null): Promise<void> {
  await query(`UPDATE public.customs_dhl_shipments SET note = $2, updated_at = now() WHERE id = $1`, [id, note]);
}

/**
 * Odczyt AI każdego pliku INV osobno; wygrywa plik z największą liczbą pozycji (obok faktury DHL
 * dołącza bywa certyfikat albo drugą stronę bez pozycji).
 */
export async function extractBestInvoice(files: DhlInvoiceFile[]): Promise<{ invoice: Extraction; bytes: Buffer; file: DhlInvoiceFile }> {
  let best: { invoice: Extraction; bytes: Buffer; file: DhlInvoiceFile } | null = null;
  let lastError: unknown = null;
  for (const file of files) {
    try {
      const bytes = await readStorageObject(file.path);
      const raw = await callCustomsGemini(
        [{ inlineData: await customsAiInlineData(bytes, file.mime) }, { text: INVOICE_EXTRACTION_PROMPT }],
        INVOICE_EXTRACTION_SCHEMA
      );
      const invoice: Extraction = { ...parseInvoiceExtraction(raw), file: file.name };
      if (!best || invoice.lines.length > best.invoice.lines.length) best = { invoice, bytes, file };
    } catch (e) {
      lastError = e;
    }
  }
  // Plik, którego nie udało się odczytać, mógł być fakturą — „brak pozycji” ogłaszamy dopiero po odczycie wszystkich.
  if (!best || (!best.invoice.lines.length && lastError)) throw lastError ?? new Error("brak pliku");
  return best;
}

type PrepareRow = {
  id: string;
  awb: string;
  requested_at: Date | null;
  invoice_files: DhlInvoiceFile[];
  extraction: Extraction | null;
  supplier_id: string | null;
  clearance_id: string | null;
};

/**
 * Faktura → odczyt AI → dostawca → odprawa z pozycjami i propozycjami. Bez rozpoznanego dostawcy
 * zatrzymuje się na odczycie (Odprawy pokazują przesyłkę z wyborem dostawcy).
 */
export async function prepareDhlClearance(shipmentId: string, userId: string | null): Promise<string | null> {
  const { rows } = await query<PrepareRow>(
    `SELECT id, awb, requested_at, invoice_files, extraction, supplier_id, clearance_id
       FROM public.customs_dhl_shipments WHERE id = $1`,
    [shipmentId]
  );
  const s = rows[0];
  if (!s || s.clearance_id) return s?.clearance_id ?? null;
  if (!s.invoice_files.length) {
    await setNote(s.id, "Brak faktury w załącznikach maili DHL - wgraj ją w „Nowa odprawa”.");
    return null;
  }

  let invoice = s.extraction;
  let invoiceFile = s.invoice_files.find((f) => f.name === invoice?.file) ?? s.invoice_files[0]!;
  let bytes: Buffer | null = null;
  if (!invoice) {
    if (!isCustomsAiConfigured()) {
      await setNote(s.id, "Odczyt faktury wymaga AI (GOOGLE_AI_API_KEY).");
      return null;
    }
    try {
      const best = await extractBestInvoice(s.invoice_files);
      ({ invoice, bytes } = best);
      invoiceFile = best.file;
    } catch (e) {
      // Limit / przeciążenie Gemini mija samo — nie zostawiamy przesyłki „na stałe” z błędem.
      await setNote(s.id, isTransientAiError(e) ? DHL_AI_RETRY_NOTE : `AI nie odczytało faktury: ${userFacingCustomsAiError(e)}`.slice(0, 300));
      return null;
    }
    await query(`UPDATE public.customs_dhl_shipments SET extraction = $2::jsonb, updated_at = now() WHERE id = $1`, [
      s.id,
      JSON.stringify(invoice),
    ]);
  }
  if (!invoice.lines.length) {
    // DHL bywa, że w „INV” jest sam certyfikat albo strona bez pozycji — wtedy agencja i tak poprosi o fakturę.
    await setNote(
      s.id,
      `W załącznikach DHL nie ma pozycji faktury${invoice.sellerName ? ` (${invoice.sellerName})` : ""} - wgraj fakturę w „Nowa odprawa”.`.slice(0, 300)
    );
    return null;
  }

  let supplierId = s.supplier_id;
  if (!supplierId && invoice.sellerName) {
    supplierId = await supplierFromHistory(invoice.sellerName);
    if (!supplierId) {
      const { rows: suppliers } = await query<{ id: string; name: string }>(
        `SELECT id, name FROM public.suppliers WHERE location = 'IMPORT'`
      );
      supplierId = matchSupplierBySellerName(invoice.sellerName, suppliers);
    }
  }
  if (!supplierId) {
    await setNote(s.id, invoice.sellerName ? `Nie rozpoznano dostawcy „${invoice.sellerName}” - wybierz go.` : "Wybierz dostawcę.");
    return null;
  }
  return createFromShipment(s, supplierId, invoice, bytes ?? (await readStorageObject(invoiceFile.path)), invoiceFile, userId);
}

async function createFromShipment(
  s: PrepareRow,
  supplierId: string,
  invoice: Extraction,
  invoiceBytes: Buffer,
  invoiceFile: DhlInvoiceFile,
  userId: string | null
): Promise<string | null> {
  // Blokada przed drugą odprawą dla tego samego AWB (dwa przebiegi synchronizacji naraz).
  const claim = await query(
    `UPDATE public.customs_dhl_shipments SET supplier_id = $2, claimed_at = now(), updated_at = now()
      WHERE id = $1 AND clearance_id IS NULL AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes')`,
    [s.id, supplierId]
  );
  if (!claim.rowCount) return null;

  const supabase = createAdminClient();
  const created = await createCustomsClearance(
    supabase,
    {
      supplierId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      currency: invoice.currency ?? "",
      shipmentDescription: "",
      zdId: null,
      pastedLines: invoiceLinesToPasteText(invoice.lines),
      invoiceTotal: invoice.total,
      invoiceHsCode: invoice.hsCode,
      countryOfOrigin: invoice.countryOfOrigin,
    },
    userId
  );
  if (!created.ok) {
    await query(`UPDATE public.customs_dhl_shipments SET claimed_at = NULL WHERE id = $1`, [s.id]);
    await setNote(s.id, `Nie udało się założyć odprawy: ${created.error}`.slice(0, 300));
    return null;
  }
  const clearanceId = created.id;
  // Od razu przypięta — błąd dalej (plik, aktualizacja) nie może skończyć się drugą odprawą dla tego AWB.
  await query(`UPDATE public.customs_dhl_shipments SET clearance_id = $2, note = NULL, claimed_at = NULL, updated_at = now() WHERE id = $1`, [
    s.id,
    clearanceId,
  ]);

  // Własna kopia faktury — usunięcie / podmiana pliku w odprawie nie rusza pliku przesyłki.
  const ext = invoiceFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `customs-documents/clearances/${clearanceId}/${randomUUID()}.${ext}`;
  const up = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, invoiceBytes, { contentType: invoiceFile.mime, upsert: false });
  await query(
    `UPDATE public.customs_clearances
        SET dhl_shipment_id = $2, forwarder = 'DHL Express', transport_ref = $3,
            arrived_at = COALESCE(arrived_at, $4::date),
            invoice_storage_path = COALESCE($5, invoice_storage_path),
            invoice_file_name = COALESCE($6, invoice_file_name),
            updated_at = now()
      WHERE id = $1`,
    [
      clearanceId,
      s.id,
      s.awb,
      s.requested_at ? todayDateKeyInWarsaw(s.requested_at) : null,
      up.error ? null : path,
      up.error ? null : invoiceFile.name,
    ]
  );
  if (up.error) await setNote(s.id, `Odprawa założona bez faktury - nie udało się zapisać pliku: ${up.error.message}`.slice(0, 300));
  if (userId) {
    const res = await proposeCustomsLines(supabase, clearanceId, userId).catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    }));
    if (!res.ok && res.error !== NOTHING_TO_PROPOSE) {
      await setNote(s.id, `Odprawa założona, propozycje AI nie powiodły się: ${res.error}`.slice(0, 300));
    }
  }
  return clearanceId;
}

/** Odprawa dla przesyłki z ręcznie wybranym dostawcą (gdy automat go nie rozpoznał). */
export async function createDhlClearanceForSupplier(
  shipmentId: string,
  supplierId: string,
  userId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await query(
    `UPDATE public.customs_dhl_shipments SET supplier_id = $2, note = NULL, updated_at = now()
      WHERE id = $1 AND clearance_id IS NULL`,
    [shipmentId, supplierId]
  );
  const id = await prepareDhlClearance(shipmentId, userId);
  if (id) return { ok: true, id };
  const { rows } = await query<{ note: string | null; busy: boolean }>(
    `SELECT note, claimed_at > now() - interval '10 minutes' AS busy FROM public.customs_dhl_shipments WHERE id = $1`,
    [shipmentId]
  );
  if (rows[0]?.busy) return { ok: false, error: "Odprawa jest właśnie zakładana - odśwież stronę za chwilę." };
  return { ok: false, error: rows[0]?.note ?? "Nie udało się założyć odprawy." };
}

/** Rozpoznanie maila; gdy temat wskazuje DHL, a numeru przesyłki nie ma we fragmencie — z pełnej treści. */
export async function classifyMeta(token: string, meta: GmailMessageMeta): Promise<DhlMail | null> {
  const input = {
    subject: meta.subject,
    from: meta.from,
    snippet: meta.snippet,
    to: meta.to,
    attachmentNames: meta.attachments.map((a) => a.filename),
  };
  const mail = classifyDhlMail(input);
  if (mail || !dhlMailNeedsBody(meta.subject)) return mail;
  const text = await getGmailMessageText(token, meta.id, { full: true });
  return text ? classifyDhlMail({ ...input, snippet: text.slice(0, 4000) }) : null;
}

/** Maile DHL z jednej skrzynki od `since`; nowe prośby od razu zakładają odprawę. */
export async function syncDhlMailbox(token: string, box: DhlMailbox, since: Date): Promise<number> {
  const q = `(${DHL_GMAIL_QUERY}) after:${Math.floor(since.getTime() / 1000)} -in:drafts -in:chats`;
  const ids = await listGmailMessageIds(token, q, MAX_MESSAGES);
  if (!ids.length) return 0;
  const { rows: known } = await query<{ gmail_message_id: string }>(
    `SELECT gmail_message_id FROM public.customs_dhl_events WHERE mailbox = $1 AND gmail_message_id = ANY($2::text[])`,
    [box.email, ids]
  );
  const knownIds = new Set(known.map((k) => k.gmail_message_id));
  const metas: GmailMessageMeta[] = [];
  for (const id of ids) {
    if (knownIds.has(id)) continue;
    // Błąd (np. limit Gmaila po ponowieniach) przerywa przebieg — data synchronizacji się nie przesuwa,
    // więc kolejna próba pobierze tę wiadomość, zamiast ją zgubić. null = wiadomość usunięta.
    const meta = await getGmailMessageMeta(token, id);
    if (meta && !meta.labelIds.includes("DRAFT")) metas.push(meta);
  }
  // Od najstarszej — etapy (prośba → odpowiedź → potwierdzenie → zwolnienie) w kolejności zdarzeń.
  metas.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  let applied = 0;
  for (const meta of metas) {
    const mail = await classifyMeta(token, meta);
    if (!mail) continue;
    if (await applyMail(token, box, meta, mail)) applied++;
  }
  return applied;
}

/**
 * Świeże prośby bez odprawy i bez rozstrzygnięcia (nowe albo po chwilowym błędzie AI) — także te
 * z poprzednich przebiegów, więc limit Gemini czy restart serwera nie zostawiają ich w zawieszeniu.
 */
export async function prepareWaitingShipments(userId: string | null): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM public.customs_dhl_shipments
      WHERE clearance_id IS NULL AND dismissed_at IS NULL AND stage = 'request' AND extraction IS NULL
        -- Po limicie Gemini co najwyżej raz na 15 min, nie przy każdym przebiegu.
        AND (note IS NULL OR (note = $2 AND updated_at < now() - interval '15 minutes')) AND requested_at > $1
      ORDER BY requested_at`,
    [new Date(Date.now() - AUTO_CREATE_MAX_AGE_MS), DHL_AI_RETRY_NOTE]
  );
  for (const r of rows) {
    await prepareDhlClearance(r.id, userId).catch(async (e: unknown) => {
      await setNote(r.id, `Automat: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300)).catch(() => undefined);
    });
  }
}
