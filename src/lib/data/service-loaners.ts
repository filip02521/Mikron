import type { PoolClient } from "pg";
import { query, withClient } from "@/lib/db/pool";
import type { LoanerEvent, LoanerEventType, LoanerStatus, LoanerUnit } from "@/lib/orders/service-loaners";

type UnitRow = {
  id: string;
  code: string;
  serial_no: string | null;
  subiekt_tw_id: number;
  tw_symbol: string | null;
  tw_name: string;
  condition: string;
  status: LoanerStatus;
  current_kh_id: number | null;
  current_client_name: string | null;
  current_client_phone: string | null;
  current_since: Date | null;
  planned_return: string | Date | null;
  note: string;
  created_at: Date;
};

type EventRow = {
  id: string | number;
  unit_id: string;
  at: Date;
  type: LoanerEventType;
  kh_id: number | null;
  client_name: string | null;
  planned_return: string | Date | null;
  condition: string | null;
  note: string;
  actor_name: string | null;
};

const UNIT_COLS = `id, code, serial_no, subiekt_tw_id, tw_symbol, tw_name, condition, status,
  current_kh_id, current_client_name, current_client_phone, current_since,
  to_char(planned_return, 'YYYY-MM-DD') AS planned_return, note, created_at`;

function mapUnit(r: UnitRow): LoanerUnit {
  return {
    id: r.id,
    code: r.code,
    serialNo: r.serial_no,
    subiektTwId: Number(r.subiekt_tw_id),
    twSymbol: r.tw_symbol,
    twName: r.tw_name,
    condition: r.condition,
    status: r.status,
    currentKhId: r.current_kh_id != null ? Number(r.current_kh_id) : null,
    currentClientName: r.current_client_name,
    currentClientPhone: r.current_client_phone,
    currentSince: r.current_since ? new Date(r.current_since).toISOString() : null,
    plannedReturn: r.planned_return ? String(r.planned_return).slice(0, 10) : null,
    note: r.note,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function mapEvent(r: EventRow): LoanerEvent {
  return {
    id: Number(r.id),
    unitId: r.unit_id,
    at: new Date(r.at).toISOString(),
    type: r.type,
    khId: r.kh_id != null ? Number(r.kh_id) : null,
    clientName: r.client_name,
    plannedReturn: r.planned_return ? String(r.planned_return).slice(0, 10) : null,
    condition: r.condition,
    note: r.note,
    actorName: r.actor_name,
  };
}

export async function fetchLoanerFleet(): Promise<{ units: LoanerUnit[]; events: LoanerEvent[] }> {
  const [units, events] = await Promise.all([
    query<UnitRow>(`SELECT ${UNIT_COLS} FROM service_loaner_units WHERE status <> 'wycofany' ORDER BY code`),
    query<EventRow>(
      `SELECT e.id, e.unit_id, e.at, e.type, e.kh_id, e.client_name,
              to_char(e.planned_return, 'YYYY-MM-DD') AS planned_return, e.condition, e.note, e.actor_name
         FROM service_loaner_events e
         JOIN service_loaner_units u ON u.id = e.unit_id AND u.status <> 'wycofany'
        ORDER BY e.at, e.id`
    ),
  ]);
  return { units: units.rows.map(mapUnit), events: events.rows.map(mapEvent) };
}

export async function fetchLoanerCodes(): Promise<string[]> {
  const res = await query<{ code: string }>(`SELECT code FROM service_loaner_units`);
  return res.rows.map((r) => r.code);
}

/** Konflikt stanu (np. ktoś inny właśnie wydał ten egzemplarz) — komunikat dla użytkownika. */
export class LoanerStateError extends Error {}

export type LoanerActor = { id: string | null; name: string };

async function inTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      const out = await fn(c);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

async function lockUnit(c: PoolClient, unitId: string): Promise<LoanerUnit> {
  const res = await c.query<UnitRow>(`SELECT ${UNIT_COLS} FROM service_loaner_units WHERE id = $1 FOR UPDATE`, [unitId]);
  const row = res.rows[0];
  if (!row) throw new LoanerStateError("Nie ma takiego egzemplarza. Odśwież listę.");
  return mapUnit(row);
}

async function addEvent(
  c: PoolClient,
  unitId: string,
  type: LoanerEventType,
  actor: LoanerActor,
  extra: { khId?: number | null; clientName?: string | null; plannedReturn?: string | null; condition?: string | null; note?: string } = {}
): Promise<void> {
  await c.query(
    `INSERT INTO service_loaner_events (unit_id, type, kh_id, client_name, planned_return, condition, note, actor_id, actor_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      unitId,
      type,
      extra.khId ?? null,
      extra.clientName ?? null,
      extra.plannedReturn ?? null,
      extra.condition ?? null,
      extra.note ?? "",
      actor.id,
      actor.name,
    ]
  );
}

export async function insertLoanerUnit(
  input: { code: string; serialNo: string | null; twId: number; twSymbol: string | null; twName: string; condition: string; note: string },
  actor: LoanerActor
): Promise<string> {
  return inTx(async (c) => {
    const dup = await c.query(`SELECT 1 FROM service_loaner_units WHERE lower(trim(code)) = lower(trim($1))`, [input.code]);
    if (dup.rowCount) throw new LoanerStateError(`Numer ${input.code} jest już zajęty.`);
    const res = await c.query<{ id: string }>(
      `INSERT INTO service_loaner_units (code, serial_no, subiekt_tw_id, tw_symbol, tw_name, condition, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [input.code, input.serialNo, input.twId, input.twSymbol, input.twName, input.condition, input.note, actor.id]
    );
    const id = res.rows[0]!.id;
    await addEvent(c, id, "created", actor, { condition: input.condition, note: input.twSymbol ?? "" });
    return id;
  });
}

export async function issueLoanerUnit(
  input: { unitId: string; khId: number | null; clientName: string; clientPhone: string | null; plannedReturn: string; note: string },
  actor: LoanerActor
): Promise<LoanerUnit> {
  return inTx(async (c) => {
    const u = await lockUnit(c, input.unitId);
    if (u.status !== "na_stanie") {
      throw new LoanerStateError(`${u.code} nie jest na stanie${u.currentClientName ? ` (jest u: ${u.currentClientName})` : ""}.`);
    }
    await c.query(
      `UPDATE service_loaner_units
          SET status = 'u_klienta', current_kh_id = $2, current_client_name = $3, current_client_phone = $4,
              current_since = now(), planned_return = $5, updated_at = now()
        WHERE id = $1`,
      [u.id, input.khId, input.clientName, input.clientPhone, input.plannedReturn]
    );
    await addEvent(c, u.id, "issued", actor, {
      khId: input.khId,
      clientName: input.clientName,
      plannedReturn: input.plannedReturn,
      note: input.note,
    });
    return { ...u, status: "u_klienta", currentClientName: input.clientName };
  });
}

export async function returnLoanerUnit(
  input: { unitId: string; condition: string; needsService: boolean; note: string },
  actor: LoanerActor
): Promise<LoanerUnit> {
  return inTx(async (c) => {
    const u = await lockUnit(c, input.unitId);
    if (u.status !== "u_klienta") throw new LoanerStateError(`${u.code} nie jest u klienta.`);
    const next: LoanerStatus = input.needsService ? "przeglad" : "na_stanie";
    await c.query(
      `UPDATE service_loaner_units
          SET status = $2, condition = $3, current_kh_id = NULL, current_client_name = NULL, current_client_phone = NULL,
              current_since = NULL, planned_return = NULL, updated_at = now()
        WHERE id = $1`,
      [u.id, next, input.condition]
    );
    await addEvent(c, u.id, "returned", actor, {
      khId: u.currentKhId,
      clientName: u.currentClientName,
      condition: input.condition,
      note: input.note,
    });
    if (input.needsService) await addEvent(c, u.id, "service_start", actor, { note: input.note });
    return { ...u, status: next };
  });
}

export async function extendLoanerUnit(
  input: { unitId: string; plannedReturn: string },
  actor: LoanerActor
): Promise<LoanerUnit> {
  return inTx(async (c) => {
    const u = await lockUnit(c, input.unitId);
    if (u.status !== "u_klienta") throw new LoanerStateError(`${u.code} nie jest u klienta.`);
    await c.query(`UPDATE service_loaner_units SET planned_return = $2, updated_at = now() WHERE id = $1`, [u.id, input.plannedReturn]);
    await addEvent(c, u.id, "extended", actor, { clientName: u.currentClientName, plannedReturn: input.plannedReturn });
    return { ...u, plannedReturn: input.plannedReturn };
  });
}

export async function endLoanerService(
  input: { unitId: string; condition: string; note: string },
  actor: LoanerActor
): Promise<LoanerUnit> {
  return inTx(async (c) => {
    const u = await lockUnit(c, input.unitId);
    if (u.status !== "przeglad") throw new LoanerStateError(`${u.code} nie jest w przeglądzie.`);
    await c.query(`UPDATE service_loaner_units SET status = 'na_stanie', condition = $2, updated_at = now() WHERE id = $1`, [
      u.id,
      input.condition,
    ]);
    await addEvent(c, u.id, "service_end", actor, { condition: input.condition, note: input.note });
    return { ...u, status: "na_stanie" };
  });
}

export async function startLoanerService(input: { unitId: string; note: string }, actor: LoanerActor): Promise<LoanerUnit> {
  return inTx(async (c) => {
    const u = await lockUnit(c, input.unitId);
    if (u.status !== "na_stanie") throw new LoanerStateError(`${u.code} nie jest na stanie.`);
    await c.query(`UPDATE service_loaner_units SET status = 'przeglad', updated_at = now() WHERE id = $1`, [u.id]);
    await addEvent(c, u.id, "service_start", actor, { note: input.note });
    return { ...u, status: "przeglad" };
  });
}
