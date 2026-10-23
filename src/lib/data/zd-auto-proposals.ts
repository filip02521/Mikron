import { query } from "@/lib/db/pool";
import { dateToIso } from "@/lib/orders/dates";
import type { ZdProposalFlag, ZdProposalLineFlag } from "@/lib/orders/zd-automat-contract";
import type { ZdSupplierOrderPolicy } from "@/lib/orders/zd-demand-policy";

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
  /** Cena netto za sztukę (ostatnie ZD); null = bez ceny. */
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
};

export type ZdAutoProposalStatus = "pending" | "accepted" | "rejected" | "expired" | "deferred";

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
};

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
  };
}

const SELECT = `SELECT id, supplier_id, created_at, policy, data_od, data_do, lines, line_count, value_net,
                       status, decided_at, decision_note, dok_id, final_lines,
                       to_jsonb(zd_auto_proposals.*) -> 'service_order_ids' AS service_order_ids,
                       to_jsonb(zd_auto_proposals.*) ->> 'deferred_reason' AS deferred_reason,
                       to_jsonb(zd_auto_proposals.*) -> 'flags' AS flags
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

/** Nowa propozycja; poprzednia czekająca wygasa (jedna aktualna na dostawcę). */
export async function createZdAutoProposal(input: {
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
}): Promise<ZdAutoProposal> {
  await query(
    `UPDATE zd_auto_proposals SET status = 'expired', decided_at = now()
      WHERE supplier_id = $1 AND status = 'pending'`,
    [input.supplierId]
  );
  const valueNet = input.lines.reduce((a, l) => a + (l.priceNet != null ? l.priceNet * l.pieces : 0), 0);
  const res = await query<Row>(
    `INSERT INTO zd_auto_proposals (supplier_id, policy, data_od, data_do, lines, line_count, value_net)
     VALUES ($1, $2::jsonb, $3::date, $4::date, $5::jsonb, $6, $7)
     RETURNING id, supplier_id, created_at, policy, data_od, data_do, lines, line_count, value_net,
               status, decided_at, decision_note, dok_id, final_lines,
               to_jsonb(zd_auto_proposals.*) -> 'service_order_ids' AS service_order_ids,
                       to_jsonb(zd_auto_proposals.*) ->> 'deferred_reason' AS deferred_reason,
                       to_jsonb(zd_auto_proposals.*) -> 'flags' AS flags`,
    [
      input.supplierId,
      JSON.stringify(input.policy),
      input.dataOd,
      input.dataDo,
      JSON.stringify(input.lines),
      input.lines.length,
      Math.round(valueNet * 100) / 100,
    ]
  );
  const created = map(res.rows[0]!);
  // Osobno: bez migracji 193 propozycja powstaje dalej, tylko bez usług (akceptacja ich nie dopisze).
  try {
    await query(`UPDATE zd_auto_proposals SET service_order_ids = $2::jsonb WHERE id = $1`, [
      created.id,
      JSON.stringify(input.serviceOrderIds),
    ]);
    created.serviceOrderIds = [...input.serviceOrderIds];
  } catch (e) {
    console.error("[zd-auto-proposals] usługi propozycji (migracja 193?)", e);
  }
  // Osobno, jak wyżej: bez migracji 194 propozycja zostaje czekająca, bez flag.
  if (input.deferredReason || input.flags?.length) {
    try {
      await query(
        `UPDATE zd_auto_proposals
            SET flags = $2::jsonb,
                status = CASE WHEN $3::text IS NULL THEN status ELSE 'deferred' END,
                deferred_reason = $3::text
          WHERE id = $1`,
        [created.id, JSON.stringify(input.flags ?? []), input.deferredReason ?? null]
      );
      created.flags = [...(input.flags ?? [])];
      if (input.deferredReason) {
        created.status = "deferred";
        created.deferredReason = input.deferredReason;
      }
    } catch (e) {
      console.error("[zd-auto-proposals] flagi / odłożenie propozycji (migracja 194?)", e);
    }
  }
  return created;
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
        WHERE id = $1 AND supplier_id = $2 AND status = 'pending' AND create_attempted_at IS NULL`,
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
  await query(`UPDATE zd_auto_proposals SET create_attempted_at = NULL WHERE id = $1 AND status = 'pending'`, [id]).catch(
    (e: unknown) => console.error("[zd-auto-proposals] zwolnienie blokady", id, e)
  );
}

/** Na aktualnych stanach nie ma nic do zamówienia — czekająca propozycja jest nieaktualna. */
export async function expirePendingZdAutoProposals(supplierId: string): Promise<number> {
  const res = await query(
    `UPDATE zd_auto_proposals SET status = 'expired', decided_at = now()
      WHERE supplier_id = $1 AND status = 'pending'`,
    [supplierId]
  );
  return res.rowCount ?? 0;
}

/** Decyzja Filipa. Tylko czekająca propozycja — druga decyzja nic nie zmienia (false). */
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
      WHERE id = $1 AND supplier_id = $2 AND status = 'pending'`,
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

/** Panel dzienny: dostawcy z propozycją ZD czekającą na decyzję (najstarsza pierwsza). */
export async function listPendingZdAutoProposalSuppliers(): Promise<Array<{ supplierId: string; supplierName: string }>> {
  const res = await query<{ supplier_id: string; name: string }>(
    `SELECT DISTINCT ON (a.supplier_id) a.supplier_id, s.name, a.created_at
       FROM zd_auto_proposals a
       JOIN suppliers s ON s.id = a.supplier_id
      WHERE a.status = 'pending'
      ORDER BY a.supplier_id, a.created_at`
  );
  return res.rows
    .map((r) => ({ supplierId: r.supplier_id, supplierName: r.name }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "pl"));
}
