import type { PoolClient } from "pg";
import { query, withClient } from "@/lib/db/pool";
import {
  canMoveServiceOrder,
  canSetServiceOrderRw,
  isClosedServiceOrder,
  nextServiceOrderNumber,
  SERVICE_ORDER_STATUS_LABEL,
  type ServiceOrder,
  type ServiceOrderEvent,
  type ServiceOrderEventType,
  type ServiceOrderPart,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";

/** Konflikt stanu zlecenia (ktoś inny zmienił je w międzyczasie, RW już wpisane) — komunikat dla użytkownika. */
export class ServiceOrderStateError extends Error {}

export type ServiceActor = { id: string | null; name: string };

type OrderRow = {
  id: string;
  number: string;
  client_kh_id: number | null;
  client_name: string;
  client_phone: string | null;
  device_tw_id: number | null;
  device_symbol: string | null;
  device_name: string;
  serial_no: string | null;
  fault: string;
  accessories: string;
  work_note: string;
  due_date: string | null;
  status: ServiceOrderStatus;
  loaner_unit_id: string | null;
  rw_number: string | null;
  rw_at: Date | null;
  closed_at: Date | null;
  created_at: Date;
};

type PartRow = {
  id: string;
  order_id: string;
  part_tw_id: number;
  part_symbol: string | null;
  part_name: string;
  quantity: number;
  taken_at: Date;
  taken_by_name: string | null;
};

type EventRow = {
  id: string | number;
  order_id: string;
  at: Date;
  type: ServiceOrderEventType;
  from_status: ServiceOrderStatus | null;
  to_status: ServiceOrderStatus | null;
  note: string;
  actor_name: string | null;
};

const ORDER_COLS = `id, number, client_kh_id, client_name, client_phone, device_tw_id, device_symbol, device_name,
  serial_no, fault, accessories, work_note, to_char(due_date, 'YYYY-MM-DD') AS due_date, status, loaner_unit_id,
  rw_number, rw_at, closed_at, created_at`;

function mapOrder(r: OrderRow): ServiceOrder {
  return {
    id: r.id,
    number: r.number,
    clientKhId: r.client_kh_id != null ? Number(r.client_kh_id) : null,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    deviceTwId: r.device_tw_id != null ? Number(r.device_tw_id) : null,
    deviceSymbol: r.device_symbol,
    deviceName: r.device_name,
    serialNo: r.serial_no,
    fault: r.fault,
    accessories: r.accessories,
    workNote: r.work_note,
    dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null,
    status: r.status,
    loanerUnitId: r.loaner_unit_id,
    rwNumber: r.rw_number,
    rwAt: r.rw_at ? new Date(r.rw_at).toISOString() : null,
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function mapPart(r: PartRow): ServiceOrderPart & { orderId: string } {
  return {
    id: r.id,
    orderId: r.order_id,
    partTwId: Number(r.part_tw_id),
    partSymbol: r.part_symbol,
    partName: r.part_name,
    quantity: Number(r.quantity),
    takenAt: new Date(r.taken_at).toISOString(),
    takenByName: r.taken_by_name,
  };
}

function mapEvent(r: EventRow): ServiceOrderEvent {
  return {
    id: Number(r.id),
    orderId: r.order_id,
    at: new Date(r.at).toISOString(),
    type: r.type,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    note: r.note,
    actorName: r.actor_name,
  };
}

/** Zamknięte zlecenia na liście: z ostatnich 60 dni. Zamknięte bez RW zostają zawsze, aż ktoś wpisze RW. */
const CLOSED_VISIBLE_DAYS = 60;

export type ServiceOrderBoard = {
  orders: ServiceOrder[];
  parts: (ServiceOrderPart & { orderId: string })[];
  events: ServiceOrderEvent[];
};

export async function fetchServiceOrderBoard(): Promise<ServiceOrderBoard> {
  const orders = await query<OrderRow>(
    `SELECT ${ORDER_COLS} FROM service_orders o
      WHERE o.status NOT IN ('wydane', 'anulowane')
         OR o.closed_at > now() - make_interval(days => $1)
         OR (o.rw_number IS NULL AND EXISTS (SELECT 1 FROM service_order_parts p WHERE p.order_id = o.id))
      ORDER BY o.created_at DESC`,
    [CLOSED_VISIBLE_DAYS]
  );
  const ids = orders.rows.map((r) => r.id);
  if (!ids.length) return { orders: [], parts: [], events: [] };
  const [parts, events] = await Promise.all([
    query<PartRow>(
      `SELECT id, order_id, part_tw_id, part_symbol, part_name, quantity, taken_at, taken_by_name
         FROM service_order_parts WHERE order_id = ANY($1::uuid[]) ORDER BY taken_at, id`,
      [ids]
    ),
    query<EventRow>(
      `SELECT id, order_id, at, type, from_status, to_status, note, actor_name
         FROM service_order_events WHERE order_id = ANY($1::uuid[]) ORDER BY at, id`,
      [ids]
    ),
  ]);
  return { orders: orders.rows.map(mapOrder), parts: parts.rows.map(mapPart), events: events.rows.map(mapEvent) };
}

/**
 * Części pobrane do zleceń, a jeszcze bez RW — w Subiekcie wciąż są na stanie, więc panel części
 * odejmuje je od „dostępne”.
 */
export async function fetchPendingRwQtyByTw(): Promise<Map<number, number>> {
  const res = await query<{ part_tw_id: number; qty: string | number }>(
    `SELECT p.part_tw_id, SUM(p.quantity) AS qty
       FROM service_order_parts p
       JOIN service_orders o ON o.id = p.order_id
      WHERE o.rw_number IS NULL
      GROUP BY p.part_tw_id`
  );
  return new Map(res.rows.map((r) => [Number(r.part_tw_id), Number(r.qty)]));
}

/** Zlecenia powiązane z egzemplarzem zamiennika (panel egzemplarza pokazuje, do czego jest wydany). */
export async function fetchOrderNumbersByLoaner(): Promise<Map<string, string>> {
  const res = await query<{ loaner_unit_id: string; number: string }>(
    `SELECT DISTINCT ON (loaner_unit_id) loaner_unit_id, number
       FROM service_orders
      WHERE loaner_unit_id IS NOT NULL AND status <> 'anulowane'
      ORDER BY loaner_unit_id, created_at DESC`
  );
  return new Map(res.rows.map((r) => [r.loaner_unit_id, r.number]));
}

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

async function lockOrder(c: PoolClient, orderId: string): Promise<ServiceOrder> {
  const res = await c.query<OrderRow>(`SELECT ${ORDER_COLS} FROM service_orders WHERE id = $1 FOR UPDATE`, [orderId]);
  const row = res.rows[0];
  if (!row) throw new ServiceOrderStateError("Nie ma takiego zlecenia. Odśwież listę.");
  return mapOrder(row);
}

async function addEvent(
  c: PoolClient,
  orderId: string,
  type: ServiceOrderEventType,
  actor: ServiceActor,
  extra: { fromStatus?: ServiceOrderStatus | null; toStatus?: ServiceOrderStatus | null; note?: string } = {}
): Promise<void> {
  await c.query(
    `INSERT INTO service_order_events (order_id, type, from_status, to_status, note, actor_id, actor_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orderId, type, extra.fromStatus ?? null, extra.toStatus ?? null, extra.note ?? "", actor.id, actor.name]
  );
}

export type ServiceOrderIntake = {
  clientKhId: number | null;
  clientName: string;
  clientPhone: string | null;
  deviceTwId: number | null;
  deviceSymbol: string | null;
  deviceName: string;
  serialNo: string | null;
  fault: string;
  accessories: string;
  dueDate: string | null;
};

export async function insertServiceOrder(input: ServiceOrderIntake, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    // Jeden numer naraz: dwa przyjęcia w tej samej sekundzie nie dostaną tego samego ZS.
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('service_orders_number'))`);
    const now = new Date();
    const prefix = `ZS/${String(now.getFullYear() % 100).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/`;
    const existing = await c.query<{ number: string }>(`SELECT number FROM service_orders WHERE number LIKE $1`, [`${prefix}%`]);
    const number = nextServiceOrderNumber(existing.rows.map((r) => r.number), now);
    const res = await c.query<OrderRow>(
      `INSERT INTO service_orders (number, client_kh_id, client_name, client_phone, device_tw_id, device_symbol, device_name,
         serial_no, fault, accessories, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${ORDER_COLS}`,
      [
        number,
        input.clientKhId,
        input.clientName,
        input.clientPhone,
        input.deviceTwId,
        input.deviceSymbol,
        input.deviceName,
        input.serialNo,
        input.fault,
        input.accessories,
        input.dueDate,
        actor.id,
      ]
    );
    const order = mapOrder(res.rows[0]!);
    await addEvent(c, order.id, "created", actor, { toStatus: "przyjete", note: input.fault });
    return order;
  });
}

export async function moveServiceOrder(
  input: { orderId: string; to: ServiceOrderStatus; note: string },
  actor: ServiceActor
): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (o.status === input.to) return o;
    if (!canMoveServiceOrder(o.status, input.to)) {
      throw new ServiceOrderStateError(
        `Zlecenie ${o.number} ma status „${SERVICE_ORDER_STATUS_LABEL[o.status]}” — nie można go zmienić na „${SERVICE_ORDER_STATUS_LABEL[input.to]}”. Odśwież panel.`
      );
    }
    const closing = isClosedServiceOrder(input.to);
    await c.query(
      `UPDATE service_orders SET status = $2, closed_at = CASE WHEN $3 THEN now() ELSE NULL END, updated_at = now() WHERE id = $1`,
      [o.id, input.to, closing]
    );
    await addEvent(c, o.id, "status", actor, { fromStatus: o.status, toStatus: input.to, note: input.note });
    return { ...o, status: input.to };
  });
}

export async function updateServiceOrderWorkNote(input: { orderId: string; workNote: string }, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (o.workNote === input.workNote) return o;
    if (isClosedServiceOrder(o.status)) throw new ServiceOrderStateError(`Zlecenie ${o.number} jest zamknięte — opisu prac nie można już zmienić.`);
    await c.query(`UPDATE service_orders SET work_note = $2, updated_at = now() WHERE id = $1`, [o.id, input.workNote]);
    await addEvent(c, o.id, "note", actor, { note: input.workNote ? "Zmieniono opis prac" : "Usunięto opis prac" });
    return { ...o, workNote: input.workNote };
  });
}

export async function takeServiceOrderPart(
  input: { orderId: string; partTwId: number; partSymbol: string | null; partName: string; quantity: number },
  actor: ServiceActor
): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (o.rwNumber) throw new ServiceOrderStateError(`Zlecenie ${o.number} ma już RW (${o.rwNumber}). Nowe części — nowe zlecenie albo korekta w Subiekcie.`);
    if (o.status === "anulowane") throw new ServiceOrderStateError(`Zlecenie ${o.number} jest anulowane.`);
    await c.query(
      `INSERT INTO service_order_parts (order_id, part_tw_id, part_symbol, part_name, quantity, taken_by, taken_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [o.id, input.partTwId, input.partSymbol, input.partName, input.quantity, actor.id, actor.name]
    );
    await addEvent(c, o.id, "part_taken", actor, { note: `${input.quantity} szt. ${input.partSymbol ?? input.partName}` });
    return o;
  });
}

export async function returnServiceOrderPart(input: { orderId: string; partId: string }, actor: ServiceActor): Promise<void> {
  await inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (o.rwNumber) throw new ServiceOrderStateError(`RW ${o.rwNumber} jest już wpisane — części nie można oddać w OnTime. Zrób korektę w Subiekcie.`);
    const del = await c.query<PartRow>(
      `DELETE FROM service_order_parts WHERE id = $1 AND order_id = $2
       RETURNING id, order_id, part_tw_id, part_symbol, part_name, quantity, taken_at, taken_by_name`,
      [input.partId, o.id]
    );
    const p = del.rows[0];
    if (!p) throw new ServiceOrderStateError("Tej części już nie ma na zleceniu. Odśwież panel.");
    await addEvent(c, o.id, "part_returned", actor, { note: `${p.quantity} szt. ${p.part_symbol ?? p.part_name}` });
  });
}

export async function setServiceOrderRw(input: { orderId: string; rwNumber: string }, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (o.rwNumber) throw new ServiceOrderStateError(`Zlecenie ${o.number} ma już RW ${o.rwNumber}.`);
    if (!canSetServiceOrderRw(o.status)) {
      throw new ServiceOrderStateError(`RW wpisz po naprawie — zlecenie ${o.number} jest „${SERVICE_ORDER_STATUS_LABEL[o.status]}”.`);
    }
    const parts = await c.query(`SELECT 1 FROM service_order_parts WHERE order_id = $1 LIMIT 1`, [o.id]);
    if (!parts.rowCount) throw new ServiceOrderStateError(`Zlecenie ${o.number} nie ma pobranych części — RW nie jest potrzebne.`);
    await c.query(`UPDATE service_orders SET rw_number = $2, rw_at = now(), updated_at = now() WHERE id = $1`, [o.id, input.rwNumber]);
    await addEvent(c, o.id, "rw", actor, { note: input.rwNumber });
    return { ...o, rwNumber: input.rwNumber };
  });
}

/**
 * Powiązanie z egzemplarzem zamiennika, który jest u tego klienta. Egzemplarz wydaje się na tablicy
 * zamienników — tu tylko zapisujemy, do którego zlecenia należy.
 */
export async function linkServiceOrderLoaner(input: { orderId: string; unitId: string | null }, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (input.unitId === o.loanerUnitId) return o;
    let code: string | null = null;
    if (input.unitId && isClosedServiceOrder(o.status)) {
      throw new ServiceOrderStateError(`Zlecenie ${o.number} jest zamknięte — nie można powiązać zamiennika.`);
    }
    if (input.unitId) {
      const u = await c.query<{ code: string; status: string }>(`SELECT code, status FROM service_loaner_units WHERE id = $1`, [input.unitId]);
      const row = u.rows[0];
      if (!row) throw new ServiceOrderStateError("Nie ma takiego egzemplarza. Odśwież panel.");
      if (row.status !== "u_klienta") throw new ServiceOrderStateError(`${row.code} nie jest wydany. Najpierw wydaj go na tablicy zamienników.`);
      const taken = await c.query<{ number: string }>(
        `SELECT number FROM service_orders WHERE loaner_unit_id = $1 AND id <> $2 LIMIT 1`,
        [input.unitId, o.id]
      );
      if (taken.rows[0]) throw new ServiceOrderStateError(`${row.code} jest już powiązany ze zleceniem ${taken.rows[0].number}.`);
      code = row.code;
    }
    await c.query(`UPDATE service_orders SET loaner_unit_id = $2, updated_at = now() WHERE id = $1`, [o.id, input.unitId]);
    await addEvent(c, o.id, input.unitId ? "loaner_linked" : "loaner_unlinked", actor, { note: code ?? "" });
    return { ...o, loanerUnitId: input.unitId };
  });
}

// --- Katalog części dla modelu (BOM) ---

export type ServiceModelPart = {
  modelTwId: number;
  modelSymbol: string | null;
  modelName: string;
  partTwId: number;
  partSymbol: string | null;
  partName: string;
  defaultQty: number;
  note: string;
};

type ModelPartRow = {
  model_tw_id: number;
  model_symbol: string | null;
  model_name: string;
  part_tw_id: number;
  part_symbol: string | null;
  part_name: string;
  default_qty: number;
  note: string;
};

function mapModelPart(r: ModelPartRow): ServiceModelPart {
  return {
    modelTwId: Number(r.model_tw_id),
    modelSymbol: r.model_symbol,
    modelName: r.model_name,
    partTwId: Number(r.part_tw_id),
    partSymbol: r.part_symbol,
    partName: r.part_name,
    defaultQty: Number(r.default_qty),
    note: r.note,
  };
}

export async function fetchServiceModelParts(): Promise<ServiceModelPart[]> {
  const res = await query<ModelPartRow>(
    `SELECT model_tw_id, model_symbol, model_name, part_tw_id, part_symbol, part_name, default_qty, note
       FROM service_model_parts ORDER BY model_name, part_symbol NULLS LAST, part_name`
  );
  return res.rows.map(mapModelPart);
}

export async function upsertServiceModelPart(
  input: Omit<ServiceModelPart, "note"> & { note: string },
  actor: ServiceActor
): Promise<void> {
  await query(
    `INSERT INTO service_model_parts (model_tw_id, model_symbol, model_name, part_tw_id, part_symbol, part_name, default_qty, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (model_tw_id, part_tw_id) DO UPDATE SET
       model_symbol = EXCLUDED.model_symbol, model_name = EXCLUDED.model_name,
       part_symbol = EXCLUDED.part_symbol, part_name = EXCLUDED.part_name,
       default_qty = EXCLUDED.default_qty, note = EXCLUDED.note`,
    [
      input.modelTwId,
      input.modelSymbol,
      input.modelName,
      input.partTwId,
      input.partSymbol,
      input.partName,
      input.defaultQty,
      input.note,
      actor.id,
    ]
  );
}

export async function deleteServiceModelPart(input: { modelTwId: number; partTwId: number }): Promise<boolean> {
  const res = await query(`DELETE FROM service_model_parts WHERE model_tw_id = $1 AND part_tw_id = $2`, [input.modelTwId, input.partTwId]);
  return (res.rowCount ?? 0) > 0;
}

/** Modele, które były w naprawie (do podpowiedzi „bez katalogu” na stronie katalogu). */
export async function fetchRepairedModels(): Promise<{ twId: number; symbol: string | null; name: string; orders: number }[]> {
  const res = await query<{ device_tw_id: number; device_symbol: string | null; device_name: string; n: string | number }>(
    `SELECT device_tw_id, MAX(device_symbol) AS device_symbol, MAX(device_name) AS device_name, COUNT(*) AS n
       FROM service_orders
      WHERE device_tw_id IS NOT NULL AND status <> 'anulowane'
      GROUP BY device_tw_id
      ORDER BY COUNT(*) DESC
      LIMIT 12`
  );
  return res.rows.map((r) => ({ twId: Number(r.device_tw_id), symbol: r.device_symbol, name: r.device_name, orders: Number(r.n) }));
}
