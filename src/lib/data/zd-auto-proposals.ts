import { query } from "@/lib/db/pool";
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
};

export type ZdAutoProposalStatus = "pending" | "accepted" | "rejected" | "expired";

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
};

const iso = (v: Date | string) => new Date(v).toISOString();
const dateKey = (v: Date | string) => (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

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
  };
}

const SELECT = `SELECT id, supplier_id, created_at, policy, data_od, data_do, lines, line_count, value_net,
                       status, decided_at, decision_note, dok_id, final_lines
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
               status, decided_at, decision_note, dok_id, final_lines`,
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
  return map(res.rows[0]!);
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
