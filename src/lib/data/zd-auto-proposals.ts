import { query, withClient } from "@/lib/db/pool";
import { dateToIso } from "@/lib/orders/dates";
import type { ZdProposalFlag, ZdProposalLineFlag } from "@/lib/orders/zd-automat-contract";
import type { ZdSupplierOrderPolicy } from "@/lib/orders/zd-demand-policy";
import { daysBetweenKeys } from "@/lib/orders/zd-automat-daily";
import {
  ZD_RECONCILE_GIVE_UP_DAYS,
  matchZdForUnconfirmedProposal,
  type ZdReconcileCandidate,
} from "@/lib/orders/zd-auto-proposal-reconcile";

/** Linia propozycji automatu — to, co Kreator pokazałby w „Do ZD” tego ranka. */
export type ZdAutoProposalLine = {
  twId: number;
  symbol: string;
  nazwa: string;
  /** Jednostki dokumentu ZD (paczki albo sztuki). */
  zdUnits: number;
  /** Sztuki po dostawie. */
  pieces: number;
  unitLabel: string;
  /** Cena netto za sztukę: kartotekowa z Subiekta, fallback ostatnie ZD (zadanie 5); null = bez ceny. */
  priceNet: number | null;
  /** Z tego sztuki z próśb handlowców. */
  prosbaPieces: number;
  /** Podłoga 90 d podniosła tempo. */
  floor: boolean;
  /** PLU (kod Mikran) — prośby z samym kodem Mikran dopasowują się przy tworzeniu ZD jak w Kreatorze. */
  plu?: string | null;
  /** Cel i korekta śledzenia sprzedaży w chwili propozycji — zapis ZD w historii jak z Kreatora. */
  celAtLink?: number | null;
  deltaAtLink?: number | null;
  /** Bezpieczniki (zadanie 4) — linia z flagą wymaga akceptacji człowieka. */
  flags?: ZdProposalLineFlag[];
  /** Krótko, z liczbami, dlaczego bezpiecznik oznaczył linię (zadanie 4); brak = stara propozycja. */
  flagNotes?: Partial<Record<ZdProposalLineFlag, string>>;
  /** Zadanie 5: jednostki ZD dołożone do progu darmowej dostawy (cała linia, gdy = zdUnits). */
  topUpUnits?: number;
};

export type ZdAutoProposalStatus = "pending" | "accepted" | "rejected" | "expired" | "deferred";

/**
 * Skąd propozycja (migracja 199): nocny przebieg, „Przygotuj teraz” w Kreatorze, przeliczenie w panelu
 * „Sprawdź i zatwierdź”. null = propozycja sprzed migracji (traktowana jak nocna).
 */
export type ZdAutoProposalOrigin = "night" | "manual" | "review";

export type ZdAutoProposal = {
  id: string;
  supplierId: string;
  createdAt: string;
  policy: ZdSupplierOrderPolicy;
  dataOd: string;
  dataDo: string;
  lines: ZdAutoProposalLine[];
  lineCount: number;
  valueNet: number;
  status: ZdAutoProposalStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  dokId: number | null;
  /** twId → jednostki ZD na utworzonym ZD (raport różnic). */
  finalLines: Record<string, number> | null;
  /** Prośby-usługi (bez towaru na liście zakresu); null = propozycja sprzed migracji 193. */
  serviceOrderIds: string[] | null;
  /** Powód odłożenia (status deferred, zadanie 5); null = nie odłożona albo przed migracją 194. */
  deferredReason: string | null;
  /** Flagi całej propozycji (zadanie 4); [] przed migracją 194. */
  flags: ZdProposalFlag[];
  /** Minimum i próg darmowej dostawy dostawcy (dziś, nie z chwili propozycji) — komunikat w panelu. */
  supplierTerms: ZdAutoProposalSupplierTerms | null;
  origin: ZdAutoProposalOrigin | null;
  /** Ostatnie przeliczenie w panelu (te same id, nowe linie); null = bez przeliczenia. */
  refreshedAt: string | null;
  /** Linie z chwili powstania (lista automatu), gdy panel je przeliczył — KPI korekty; null = bez przeliczenia. */
  originalLines: ZdAutoProposalLine[] | null;
  /** Rozpoczęte tworzenie ZD (blokada); przy statusie czekającym = wynik niepotwierdzony. */
  createAttemptedAt: string | null;
  /** Wynik uzgodnienia po niepotwierdzonym tworzeniu ZD. */
  createOutcomeNote: string | null;
};

export type ZdAutoProposalSupplierTerms = {
  minOrderValue: number | null;
  minOrderCurrency: string | null;
  freeShippingThreshold: number | null;
};

type Row = {
  id: string;
  supplier_id: string;
  created_at: Date | string;
  policy: ZdSupplierOrderPolicy;
  data_od: Date | string;
  data_do: Date | string;
  lines: ZdAutoProposalLine[];
  line_count: number;
  value_net: string | number;
  status: ZdAutoProposalStatus;
  decided_at: Date | string | null;
  decision_note: string | null;
  dok_id: number | null;
  final_lines: Record<string, number> | null;
  service_order_ids: unknown;
  deferred_reason: unknown;
  flags: unknown;
  supplier_terms?: { min?: unknown; currency?: unknown; free?: unknown } | null;
  /** Kolumny z migracji 193/199 przez to_jsonb — baza bez nich czyta się dalej (null). */
  extra?: { origin?: unknown; refreshed_at?: unknown; original_lines?: unknown; create_attempted_at?: unknown; create_outcome_note?: unknown } | null;
};

const ORIGINS: ReadonlySet<string> = new Set(["night", "manual", "review"]);

const numOrNull = (v: unknown) => (v != null && Number(v) > 0 ? Number(v) : null);

const iso = (v: Date | string) => new Date(v).toISOString();
// pg zwraca kolumnę date jako lokalną północ — toISOString() cofałby datę o dzień (Warszawa, UTC+1/+2).
const dateKey = (v: Date | string) => (typeof v === "string" ? v.slice(0, 10) : dateToIso(v) ?? "");

function map(r: Row): ZdAutoProposal {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    createdAt: iso(r.created_at),
    policy: r.policy,
    dataOd: dateKey(r.data_od),
    dataDo: dateKey(r.data_do),
    lines: Array.isArray(r.lines) ? r.lines : [],
    lineCount: Number(r.line_count) || 0,
    valueNet: Number(r.value_net) || 0,
    status: r.status,
    decidedAt: r.decided_at ? iso(r.decided_at) : null,
    decisionNote: r.decision_note,
    dokId: r.dok_id,
    finalLines: r.final_lines,
    serviceOrderIds: Array.isArray(r.service_order_ids)
      ? r.service_order_ids.filter((x): x is string => typeof x === "string" && x.length > 0)
      : null,
    deferredReason: typeof r.deferred_reason === "string" && r.deferred_reason ? r.deferred_reason : null,
    flags: Array.isArray(r.flags) ? r.flags.filter((x): x is ZdProposalFlag => x === "order_value_jump") : [],
    supplierTerms: r.supplier_terms
      ? {
          minOrderValue: numOrNull(r.supplier_terms.min),
          minOrderCurrency: typeof r.supplier_terms.currency === "string" ? r.supplier_terms.currency : null,
          freeShippingThreshold: numOrNull(r.supplier_terms.free),
        }
      : null,
    origin: typeof r.extra?.origin === "string" && ORIGINS.has(r.extra.origin) ? (r.extra.origin as ZdAutoProposalOrigin) : null,
    refreshedAt: r.extra?.refreshed_at ? iso(String(r.extra.refreshed_at)) : null,
    originalLines: Array.isArray(r.extra?.original_lines) ? (r.extra.original_lines as ZdAutoProposalLine[]) : null,
    createAttemptedAt: r.extra?.create_attempted_at ? iso(String(r.extra.create_attempted_at)) : null,
    createOutcomeNote: typeof r.extra?.create_outcome_note === "string" ? r.extra.create_outcome_note : null,
  };
}

/** Kolumny migracji 193/199 bez zależności od ich istnienia (to_jsonb). */
const EXTRA = (t: string) =>
  `jsonb_build_object('origin', to_jsonb(${t}.*) -> 'origin', 'refreshed_at', to_jsonb(${t}.*) -> 'refreshed_at',
                     'original_lines', to_jsonb(${t}.*) -> 'original_lines', 'create_attempted_at', to_jsonb(${t}.*) -> 'create_attempted_at',
                     'create_outcome_note', to_jsonb(${t}.*) -> 'create_outcome_note') AS extra`;

const SELECT = `SELECT id, supplier_id, created_at, policy, data_od, data_do, lines, line_count, value_net,
                       status, decided_at, decision_note, dok_id, final_lines,
                       to_jsonb(zd_auto_proposals.*) -> 'service_order_ids' AS service_order_ids,
                       to_jsonb(zd_auto_proposals.*) ->> 'deferred_reason' AS deferred_reason,
                       to_jsonb(zd_auto_proposals.*) -> 'flags' AS flags,
                       (SELECT jsonb_build_object('min', s.min_order_value, 'currency', s.min_order_currency,
                                                  'free', to_jsonb(s.*) -> 'free_shipping_threshold')
                          FROM suppliers s WHERE s.id = zd_auto_proposals.supplier_id) AS supplier_terms,
                       ${EXTRA("zd_auto_proposals")}
                  FROM zd_auto_proposals`;

/** Czy minął cykl od ostatniej propozycji (dni kalendarzowe wg dat Warszawy). */
export function isZdAutoProposalDue(input: {
  cycleDays: number | null;
  lastCreatedDateKey: string | null;
  todayKey: string;
}): boolean {
  const cycle = Number(input.cycleDays);
  if (!(Number.isInteger(cycle) && cycle >= 1)) return false;
  if (!input.lastCreatedDateKey) return true;
  const days = Math.round(
    (Date.parse(`${input.todayKey}T00:00:00Z`) - Date.parse(`${input.lastCreatedDateKey}T00:00:00Z`)) / 86_400_000
  );
  return days >= cycle;
}

export async function fetchLatestZdAutoProposal(supplierId: string): Promise<ZdAutoProposal | null> {
  const res = await query<Row>(`${SELECT} WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 1`, [supplierId]);
  return res.rows[0] ? map(res.rows[0]) : null;
}

export async function listZdAutoProposals(supplierId: string, limit = 20): Promise<ZdAutoProposal[]> {
  const res = await query<Row>(`${SELECT} WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT $2`, [
    supplierId,
    Math.min(100, Math.max(1, Math.trunc(limit))),
  ]);
  return res.rows.map(map);
}

/** Kolumna z migracji 193/194/199 jeszcze niewgrana — kod Postgresa 42703. */
const isUndefinedColumn = (e: unknown) => (e as { code?: string } | null)?.code === "42703";

/** Wygaszenie otwartych propozycji dostawcy — bez tej, dla której trwa tworzenie ZD (blokada `create_attempted_at`). */
const EXPIRE_OPEN_SQL = `UPDATE zd_auto_proposals SET status = 'expired', decided_at = now()
      WHERE supplier_id = $1 AND status IN ('pending', 'deferred') AND create_attempted_at IS NULL`;
const EXPIRE_OPEN_LEGACY_SQL = `UPDATE zd_auto_proposals SET status = 'expired', decided_at = now()
      WHERE supplier_id = $1 AND status IN ('pending', 'deferred')`;

type ZdAutoProposalWrite = {
  supplierId: string;
  policy: ZdSupplierOrderPolicy;
  dataOd: string;
  dataDo: string;
  lines: ZdAutoProposalLine[];
  serviceOrderIds: string[];
  /** Zadanie 5: odłożona (minimum / próg darmowej dostawy) zamiast czekającej. */
  deferredReason?: string | null;
  /** Zadanie 4: flagi całej propozycji. */
  flags?: ZdProposalFlag[];
};

const valueOfLines = (lines: readonly ZdAutoProposalLine[]) =>
  Math.round(lines.reduce((a, l) => a + (l.priceNet != null ? l.priceNet * l.pieces : 0), 0) * 100) / 100;

/**
 * Nowa propozycja; poprzednia czekająca albo odłożona wygasa (jedna aktualna na dostawcę) — oprócz tej, dla której
 * trwa tworzenie ZD. Jedna transakcja: wygaszenie i zapis razem albo wcale (awaria w środku nie zostawi dostawcy bez
 * propozycji ani odłożonej jako czekającej). Baza bez migracji 193/194/199 — dawny zapis krok po kroku.
 */
export async function createZdAutoProposal(input: ZdAutoProposalWrite & { origin: ZdAutoProposalOrigin }): Promise<ZdAutoProposal> {
  const status = input.deferredReason ? "deferred" : "pending";
  try {
    const id = await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(EXPIRE_OPEN_SQL, [input.supplierId]);
        const res = await client.query<{ id: string }>(
          `INSERT INTO zd_auto_proposals
             (supplier_id, policy, data_od, data_do, lines, line_count, value_net, status,
              service_order_ids, flags, deferred_reason, origin)
           VALUES ($1, $2::jsonb, $3::date, $4::date, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)
           RETURNING id`,
          [
            input.supplierId,
            JSON.stringify(input.policy),
            input.dataOd,
            input.dataDo,
            JSON.stringify(input.lines),
            input.lines.length,
            valueOfLines(input.lines),
            status,
            JSON.stringify(input.serviceOrderIds),
            JSON.stringify(input.flags ?? []),
            input.deferredReason ?? null,
            input.origin,
          ]
        );
        await client.query("COMMIT");
        return res.rows[0]!.id;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw e;
      }
    });
    return (await fetchZdAutoProposalById(id))!;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    return createZdAutoProposalLegacy(input);
  }
}

/** Zapis bez kolumn migracji 193/194/199 — jak przed nimi (czekająca, potem usługi i flagi, jeśli się da). */
async function createZdAutoProposalLegacy(input: ZdAutoProposalWrite): Promise<ZdAutoProposal> {
  await query(EXPIRE_OPEN_SQL, [input.supplierId]).catch(async (e) => {
    if (!isUndefinedColumn(e)) throw e;
    await query(EXPIRE_OPEN_LEGACY_SQL, [input.supplierId]);
  });
  const res = await query<{ id: string }>(
    `INSERT INTO zd_auto_proposals (supplier_id, policy, data_od, data_do, lines, line_count, value_net)
     VALUES ($1, $2::jsonb, $3::date, $4::date, $5::jsonb, $6, $7) RETURNING id`,
    [input.supplierId, JSON.stringify(input.policy), input.dataOd, input.dataDo, JSON.stringify(input.lines), input.lines.length, valueOfLines(input.lines)]
  );
  const id = res.rows[0]!.id;
  await query(`UPDATE zd_auto_proposals SET service_order_ids = $2::jsonb WHERE id = $1`, [id, JSON.stringify(input.serviceOrderIds)]).catch(
    (e) => console.error("[zd-auto-proposals] usługi propozycji (migracja 193?)", e)
  );
  if (input.deferredReason || input.flags?.length) {
    await query(
      `UPDATE zd_auto_proposals
          SET flags = $2::jsonb, status = CASE WHEN $3::text IS NULL THEN status ELSE 'deferred' END, deferred_reason = $3::text
        WHERE id = $1`,
      [id, JSON.stringify(input.flags ?? []), input.deferredReason ?? null]
    ).catch((e) => console.error("[zd-auto-proposals] flagi / odłożenie propozycji (migracja 194?)", e));
  }
  return (await fetchZdAutoProposalById(id))!;
}

/**
 * Przeliczenie w panelu „Sprawdź i zatwierdź”: ta sama propozycja dostaje linie z aktualnych stanów (ten sam id
 * i data powstania — termin kolejnej się nie przesuwa). Pierwsze przeliczenie zachowuje listę automatu
 * (`original_lines`) do KPI korekty. null = nie ma otwartej propozycji do przeliczenia (albo trwa tworzenie ZD,
 * albo baza bez migracji 199) — wtedy wołający tworzy nową.
 */
export async function refreshZdAutoProposal(id: string, input: ZdAutoProposalWrite): Promise<ZdAutoProposal | null> {
  try {
    const res = await query(
      `UPDATE zd_auto_proposals
          SET original_lines = COALESCE(original_lines, lines),
              lines = $3::jsonb, line_count = $4, value_net = $5, policy = $6::jsonb,
              data_od = $7::date, data_do = $8::date, service_order_ids = $9::jsonb, flags = $10::jsonb,
              deferred_reason = $11, status = CASE WHEN $11::text IS NULL THEN 'pending' ELSE 'deferred' END,
              refreshed_at = now()
        WHERE id = $1 AND supplier_id = $2 AND status IN ('pending', 'deferred') AND create_attempted_at IS NULL`,
      [
        id,
        input.supplierId,
        JSON.stringify(input.lines),
        input.lines.length,
        valueOfLines(input.lines),
        JSON.stringify(input.policy),
        input.dataOd,
        input.dataDo,
        JSON.stringify(input.serviceOrderIds),
        JSON.stringify(input.flags ?? []),
        input.deferredReason ?? null,
      ]
    );
    if (!(res.rowCount ?? 0)) return null;
    return fetchZdAutoProposalById(id);
  } catch (e) {
    if (isUndefinedColumn(e)) return null;
    throw e;
  }
}

export async function fetchZdAutoProposalById(id: string): Promise<ZdAutoProposal | null> {
  const res = await query<Row>(`${SELECT} WHERE id = $1`, [id]);
  return res.rows[0] ? map(res.rows[0]) : null;
}

/**
 * Kotwica cyklu (dzień Warszawy): najnowsza propozycja nocna (albo sprzed migracji 199) lub zatwierdzona.
 * Przeliczenia w panelu i „Przygotuj teraz” bez zatwierdzenia nie przesuwają harmonogramu.
 */
export async function fetchZdAutoProposalCycleAnchorKey(supplierId: string): Promise<string | null> {
  const sql = (originFilter: boolean) =>
    `SELECT (created_at AT TIME ZONE 'Europe/Warsaw')::date::text AS day FROM zd_auto_proposals
      WHERE supplier_id = $1 ${originFilter ? "AND (origin IS NULL OR origin = 'night' OR status = 'accepted')" : ""}
      ORDER BY created_at DESC LIMIT 1`;
  try {
    return (await query<{ day: string }>(sql(true), [supplierId])).rows[0]?.day ?? null;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    return (await query<{ day: string }>(sql(false), [supplierId])).rows[0]?.day ?? null;
  }
}

/**
 * Zajęcie propozycji przed tworzeniem ZD — atomowo w bazie (dwie zakładki, kilka instancji).
 * "claimed" = można tworzyć; "busy" = ktoś już tworzy albo poprzednia próba nie dostała
 * potwierdzenia z Subiekta (ZD mogło powstać); "unsupported" = brak migracji 193.
 */
export async function claimZdAutoProposalCreate(id: string, supplierId: string): Promise<"claimed" | "busy" | "unsupported"> {
  try {
    const res = await query(
      `UPDATE zd_auto_proposals SET create_attempted_at = now()
        WHERE id = $1 AND supplier_id = $2 AND status IN ('pending', 'deferred') AND create_attempted_at IS NULL`,
      [id, supplierId]
    );
    return (res.rowCount ?? 0) > 0 ? "claimed" : "busy";
  } catch (e) {
    if ((e as { code?: string }).code === "42703") return "unsupported";
    throw e;
  }
}

/** Create zakończony pewną porażką (Subiekt odrzucił dokument) — propozycję można zatwierdzić ponownie. */
export async function releaseZdAutoProposalCreate(id: string): Promise<void> {
  await query(`UPDATE zd_auto_proposals SET create_attempted_at = NULL WHERE id = $1 AND status IN ('pending', 'deferred')`, [id]).catch(
    (e: unknown) => console.error("[zd-auto-proposals] zwolnienie blokady", id, e)
  );
}

/** Na aktualnych stanach nie ma nic do zamówienia — czekająca albo odłożona propozycja jest nieaktualna. */
export async function expirePendingZdAutoProposals(supplierId: string): Promise<number> {
  try {
    return (await query(EXPIRE_OPEN_SQL, [supplierId])).rowCount ?? 0;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    return (await query(EXPIRE_OPEN_LEGACY_SQL, [supplierId])).rowCount ?? 0;
  }
}

/** Decyzja Filipa. Czekająca albo odłożona (zatwierdzenie „mimo to” sprawdza akcja) — druga decyzja nic nie zmienia (false). */
export async function decideZdAutoProposal(input: {
  id: string;
  supplierId: string;
  status: "accepted" | "rejected";
  note: string | null;
  decidedBy: string | null;
  dokId?: number | null;
  finalLines?: Record<string, number> | null;
}): Promise<boolean> {
  const res = await query(
    `UPDATE zd_auto_proposals
        SET status = $3, decision_note = $4, decided_by = $5, decided_at = now(),
            dok_id = $6, final_lines = $7::jsonb
      WHERE id = $1 AND supplier_id = $2 AND status IN ('pending', 'deferred')`,
    [
      input.id,
      input.supplierId,
      input.status,
      input.note,
      input.decidedBy,
      input.dokId ?? null,
      input.finalLines ? JSON.stringify(input.finalLines) : null,
    ]
  );
  return (res.rowCount ?? 0) > 0;
}

/** Drugie ZD tego samego dnia (zamówienie podzielone) — dopisuje linie do zaakceptowanej propozycji. */
export async function addZdAutoProposalFinalLines(input: {
  id: string;
  supplierId: string;
  finalLines: Record<string, number>;
}): Promise<boolean> {
  const res = await query(
    `UPDATE zd_auto_proposals p
        SET final_lines = (
          SELECT jsonb_object_agg(k, to_jsonb(v))
            FROM (
              SELECT k, sum(v::numeric) AS v
                FROM (
                  SELECT key AS k, value::text AS v FROM jsonb_each(coalesce(p.final_lines, '{}'::jsonb))
                  UNION ALL
                  SELECT key, value::text FROM jsonb_each($3::jsonb)
                ) x
               GROUP BY k
            ) y
        )
      WHERE id = $1 AND supplier_id = $2 AND status = 'accepted'`,
    [input.id, input.supplierId, JSON.stringify(input.finalLines)]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Panel dzienny: aktualna czekająca propozycja każdego dostawcy (najnowsza) z nazwą dostawcy.
 * Wiersz harmonogramu pokazuje ją od razu, bez dociągania w przeglądarce. Odłożone (deferred)
 * nie — czekają na kolejny cykl. Kolumny jak SELECT (bez migracji 193/194 też działa).
 */
export async function listPendingZdAutoProposals(): Promise<Array<ZdAutoProposal & { supplierName: string }>> {
  const res = await query<Row & { supplier_name: string }>(
    `SELECT DISTINCT ON (p.supplier_id) p.id, p.supplier_id, p.created_at, p.policy, p.data_od, p.data_do, p.lines,
            p.line_count, p.value_net, p.status, p.decided_at, p.decision_note, p.dok_id, p.final_lines,
            to_jsonb(p.*) -> 'service_order_ids' AS service_order_ids,
            to_jsonb(p.*) ->> 'deferred_reason' AS deferred_reason,
            to_jsonb(p.*) -> 'flags' AS flags,
            jsonb_build_object('min', s.min_order_value, 'currency', s.min_order_currency,
                               'free', to_jsonb(s.*) -> 'free_shipping_threshold') AS supplier_terms,
            s.name AS supplier_name,
            ${EXTRA("p")}
       FROM zd_auto_proposals p
       JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.status = 'pending'
      ORDER BY p.supplier_id, p.created_at DESC`
  );
  return res.rows
    .map((r) => ({ ...map(r), supplierName: r.supplier_name }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "pl"));
}

export type ZdUnconfirmedReconcileResult = {
  supplierId: string;
  proposalId: string;
  /** accepted = ZD odnalezione w Subiekcie; expired = brak ZD po dniu próby; waiting = jeszcze za wcześnie. */
  outcome: "accepted" | "expired" | "waiting";
  dokNr: string | null;
  /** Dzień próby tworzenia ZD (Warszawa). */
  attemptDay: string;
};

/**
 * Nocny przebieg: propozycje z tworzeniem ZD bez potwierdzenia z Subiekta (timeout, zerwane połączenie). ZD dostawcy
 * z dnia próby (linie z harvestu cen), niepowiązane z inną propozycją, z ≥80% jej towarów = zatwierdzona z tym ZD.
 * Brak takiego ZD po dniu próby = wygasa z notatką (blokada nie wisi bez końca). Baza bez migracji 193/199 — nic.
 */
export async function reconcileUnconfirmedZdAutoProposals(todayKey: string): Promise<ZdUnconfirmedReconcileResult[]> {
  let rows: Array<{ id: string; supplier_id: string; lines: ZdAutoProposalLine[]; attempt_day: string; kh_id: number | null }>;
  try {
    rows = (
      await query<{ id: string; supplier_id: string; lines: ZdAutoProposalLine[]; attempt_day: string; kh_id: number | null }>(
        `SELECT p.id, p.supplier_id, p.lines,
                (p.create_attempted_at AT TIME ZONE 'Europe/Warsaw')::date::text AS attempt_day,
                s.subiekt_kh_id AS kh_id
           FROM zd_auto_proposals p
           JOIN suppliers s ON s.id = p.supplier_id
          WHERE p.status IN ('pending', 'deferred') AND p.create_attempted_at IS NOT NULL
            AND p.create_attempted_at < now() - interval '30 minutes'
          ORDER BY p.create_attempted_at`
      )
    ).rows;
  } catch (e) {
    if (isUndefinedColumn(e)) return [];
    throw e;
  }
  const out: ZdUnconfirmedReconcileResult[] = [];
  for (const r of rows) {
    const docs =
      r.kh_id != null
        ? (
            await query<{ dok_id: number; dok_nr: string | null; subiekt_tw_id: number; qty: string | number }>(
              `SELECT l.dok_id, l.dok_nr, l.subiekt_tw_id, l.qty FROM zd_purchase_lines l
                WHERE l.kh_id = $1 AND l.dok_date = $2::date
                  AND NOT EXISTS (SELECT 1 FROM zd_auto_proposals o WHERE o.dok_id = l.dok_id)`,
              [r.kh_id, r.attempt_day]
            )
          ).rows
        : [];
    const byDok = new Map<number, ZdReconcileCandidate & { qtyByTwId: Map<number, number> }>();
    for (const d of docs) {
      const c = byDok.get(d.dok_id) ?? { dokId: d.dok_id, dokNr: d.dok_nr, qtyByTwId: new Map<number, number>() };
      c.qtyByTwId.set(d.subiekt_tw_id, Number(d.qty) || 0);
      byDok.set(d.dok_id, c);
    }
    const match = matchZdForUnconfirmedProposal(
      (r.lines ?? []).map((l) => l.twId),
      [...byDok.values()]
    );
    if (match) {
      const finalLines: Record<string, number> = {};
      for (const [tw, qty] of match.qtyByTwId) finalLines[String(tw)] = qty;
      const note = `${match.dokNr?.trim() || `ZD ${match.dokId}`} odnalezione w Subiekcie po niepotwierdzonym zapisie.`;
      const done = await decideZdAutoProposal({
        id: r.id,
        supplierId: r.supplier_id,
        status: "accepted",
        note,
        decidedBy: null,
        dokId: match.dokId,
        finalLines,
      });
      if (done) {
        await query(`UPDATE zd_auto_proposals SET create_outcome_note = $2 WHERE id = $1`, [r.id, note]);
        out.push({ supplierId: r.supplier_id, proposalId: r.id, outcome: "accepted", dokNr: match.dokNr, attemptDay: r.attempt_day });
      }
      continue;
    }
    if (daysBetweenKeys(r.attempt_day, todayKey) <= ZD_RECONCILE_GIVE_UP_DAYS) {
      out.push({ supplierId: r.supplier_id, proposalId: r.id, outcome: "waiting", dokNr: null, attemptDay: r.attempt_day });
      continue;
    }
    const res = await query(
      `UPDATE zd_auto_proposals
          SET status = 'expired', decided_at = now(), create_outcome_note = $2
        WHERE id = $1 AND status IN ('pending', 'deferred') AND create_attempted_at IS NOT NULL`,
      [r.id, `Subiekt nie potwierdził utworzenia ZD (${r.attempt_day}) i w Subiekcie nie ma pasującego ZD.`]
    );
    if (res.rowCount) out.push({ supplierId: r.supplier_id, proposalId: r.id, outcome: "expired", dokNr: null, attemptDay: r.attempt_day });
  }
  return out;
}
