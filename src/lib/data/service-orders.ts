import { SERVICE_WARRANTY_DEFAULT_MONTHS, warrantyUntil } from "@/lib/orders/service-warranty";
import type { PoolClient } from "pg";
import { servicePartRequestNote } from "@/lib/orders/service-part-report";
import { query, withClient } from "@/lib/db/pool";
import {
  canMoveServiceOrder,
  canSetServiceOrderInvoice,
  formatQuoteAmount,
  SERVICE_OUTBOUND_LABEL,
  type ServiceInboundMethod,
  type ServiceOutboundMethod,
  type ServiceQuoteDecision,
  canSetServiceOrderRw,
  isClosedServiceOrder,
  nextServiceOrderNumber,
  serialKey,
  type SerialHistoryItem,
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
  fs_id: number | null;
  fs_number: string | null;
  no_invoice_reason: string | null;
  waiting_part_tw_id: number | null;
  waiting_part_symbol: string | null;
  waiting_part_name: string | null;
  waiting_part_qty: number | null;
  waiting_since: Date | null;
  purchase_date: string | null;
  purchase_doc: string | null;
  warranty_until: string | null;
  helpdesk_id: number | null;
  quote_amount: string | number | null;
  quote_note: string;
  quote_sent_at: Date | null;
  quote_decision: ServiceQuoteDecision | null;
  quote_decided_at: Date | null;
  inbound_method: ServiceInboundMethod | null;
  inbound_pickup_date: string | null;
  outbound_method: ServiceOutboundMethod | null;
  outbound_tracking: string | null;
  outbound_address: string | null;
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
  rw_number, rw_at, fs_id, fs_number, no_invoice_reason, waiting_part_tw_id, waiting_part_symbol, waiting_part_name,
  waiting_part_qty, waiting_since, to_char(purchase_date, 'YYYY-MM-DD') AS purchase_date, purchase_doc,
  to_char(warranty_until, 'YYYY-MM-DD') AS warranty_until, helpdesk_id,
  quote_amount, quote_note, quote_sent_at, quote_decision, quote_decided_at,
  inbound_method, to_char(inbound_pickup_date, 'YYYY-MM-DD') AS inbound_pickup_date, outbound_method, outbound_tracking, outbound_address,
  closed_at, created_at`;

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
    fsId: r.fs_id != null ? Number(r.fs_id) : null,
    fsNumber: r.fs_number,
    noInvoiceReason: r.no_invoice_reason,
    waitingPart: r.waiting_part_name
      ? {
          twId: r.waiting_part_tw_id != null ? Number(r.waiting_part_tw_id) : null,
          symbol: r.waiting_part_symbol,
          name: r.waiting_part_name,
          qty: Number(r.waiting_part_qty ?? 1),
          since: r.waiting_since ? new Date(r.waiting_since).toISOString() : null,
          requestStatus: null,
        }
      : null,
    purchaseDate: r.purchase_date,
    purchaseDoc: r.purchase_doc,
    warrantyUntil: r.warranty_until,
    helpdeskId: r.helpdesk_id != null ? Number(r.helpdesk_id) : null,
    quote: {
      amount: r.quote_amount != null ? Number(r.quote_amount) : null,
      note: r.quote_note ?? "",
      sentAt: r.quote_sent_at ? new Date(r.quote_sent_at).toISOString() : null,
      decision: r.quote_decision,
      decidedAt: r.quote_decided_at ? new Date(r.quote_decided_at).toISOString() : null,
    },
    inbound: { method: r.inbound_method, pickupDate: r.inbound_pickup_date },
    outbound: { method: r.outbound_method, tracking: r.outbound_tracking, address: r.outbound_address },
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
  const mapped = orders.rows.map(mapOrder);
  // Status prośby o część, na którą zlecenie czeka: prośba ma uwagę „Zgłoszenie serwisu: ZS/…” (zgłoszenie z panelu).
  const waiting = mapped.filter((o) => o.waitingPart?.twId);
  if (waiting.length) {
    const req = await query<{ note: string; subiekt_tw_id: number; status: string }>(
      `SELECT DISTINCT ON (sales_request_note, subiekt_tw_id) sales_request_note AS note, subiekt_tw_id, status::text AS status
         FROM individual_orders
        WHERE sales_request_note = ANY($1::text[])
        ORDER BY sales_request_note, subiekt_tw_id, created_at DESC`,
      [waiting.map((o) => servicePartRequestNote(o.number))]
    );
    for (const o of waiting) {
      const hit = req.rows.find((r) => r.note === servicePartRequestNote(o.number) && Number(r.subiekt_tw_id) === o.waitingPart!.twId);
      if (hit) o.waitingPart = { ...o.waitingPart!, requestStatus: hit.status };
    }
  }
  return { orders: mapped, parts: parts.rows.map(mapPart), events: events.rows.map(mapEvent) };
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

export type HelpdeskLinkedOrder = { id: string; number: string; deviceName: string; serialNo: string | null; status: ServiceOrderStatus };

/** Zlecenia założone z danych zgłoszeń (bez anulowanych): numer zgłoszenia → jego zlecenia (jedno zgłoszenie bywa na kilka urządzeń). */
export async function fetchOrdersByHelpdeskIds(ids: number[]): Promise<Map<number, HelpdeskLinkedOrder[]>> {
  if (!ids.length) return new Map();
  const res = await query<{ helpdesk_id: number; id: string; number: string; device_name: string; serial_no: string | null; status: ServiceOrderStatus }>(
    `SELECT helpdesk_id, id, number, device_name, serial_no, status FROM service_orders
      WHERE helpdesk_id = ANY($1::int[]) AND status <> 'anulowane' ORDER BY created_at`,
    [ids]
  );
  const out = new Map<number, HelpdeskLinkedOrder[]>();
  for (const r of res.rows) {
    const k = Number(r.helpdesk_id);
    out.set(k, [...(out.get(k) ?? []), { id: r.id, number: r.number, deviceName: r.device_name, serialNo: r.serial_no, status: r.status }]);
  }
  return out;
}

/** Zlecenia powiązane z egzemplarzem zamiennika (panel egzemplarza pokazuje, do czego jest wydany). */
export async function fetchOrderNumbersByLoaner(): Promise<Map<string, { id: string; number: string }>> {
  const res = await query<{ loaner_unit_id: string; id: string; number: string }>(
    `SELECT DISTINCT ON (loaner_unit_id) loaner_unit_id, id, number
       FROM service_orders
      WHERE loaner_unit_id IS NOT NULL AND status <> 'anulowane'
      ORDER BY loaner_unit_id, created_at DESC`
  );
  return new Map(res.rows.map((r) => [r.loaner_unit_id, { id: r.id, number: r.number }]));
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
  /** YYYY-MM-DD, już sprawdzona (normalizePurchaseDate); null — nieznana. */
  purchaseDate: string | null;
  purchaseDoc: string | null;
  helpdeskId: number | null;
  inboundMethod: ServiceInboundMethod | null;
  inboundPickupDate: string | null;
};

export async function insertServiceOrder(input: ServiceOrderIntake, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    // Jeden numer naraz: dwa przyjęcia w tej samej sekundzie nie dostaną tego samego ZS.
    await c.query(`SELECT pg_advisory_xact_lock(hashtext('service_orders_number'))`);
    const now = new Date();
    const prefix = `ZS/${String(now.getFullYear() % 100).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/`;
    const existing = await c.query<{ number: string }>(`SELECT number FROM service_orders WHERE number LIKE $1`, [`${prefix}%`]);
    const number = nextServiceOrderNumber(existing.rows.map((r) => r.number), now);
    // Koniec gwarancji liczony tu, nie w przeglądarce: okres modelu z katalogu albo domyślny.
    let warranty: string | null = null;
    if (input.purchaseDate) {
      const months = input.deviceTwId
        ? (await c.query<{ months: number }>(`SELECT months FROM service_model_warranty WHERE model_tw_id = $1`, [input.deviceTwId])).rows[0]?.months
        : undefined;
      warranty = warrantyUntil(input.purchaseDate, months ?? SERVICE_WARRANTY_DEFAULT_MONTHS);
    }
    const res = await c.query<OrderRow>(
      `INSERT INTO service_orders (number, client_kh_id, client_name, client_phone, device_tw_id, device_symbol, device_name,
         serial_no, fault, accessories, due_date, created_by, purchase_date, purchase_doc, warranty_until, helpdesk_id,
         inbound_method, inbound_pickup_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
        input.purchaseDate,
        input.purchaseDate ? input.purchaseDoc : null,
        warranty,
        input.helpdeskId,
        input.inboundMethod,
        input.inboundPickupDate,
      ]
    );
    const order = mapOrder(res.rows[0]!);
    await addEvent(c, order.id, "created", actor, {
      toStatus: "przyjete",
      note: input.helpdeskId ? `Ze zgłoszenia helpdesku #${input.helpdeskId}. ${input.fault}`.slice(0, 1000) : input.fault,
    });
    return order;
  });
}

export async function moveServiceOrder(
  input: {
    orderId: string;
    to: ServiceOrderStatus;
    note: string;
    /** Przy „wydane”: jak sprzęt wraca do klienta (zapis w zleceniu i w historii). */
    outbound?: { method: ServiceOutboundMethod; tracking: string | null; address: string | null } | null;
  },
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
    if (input.to === "czeka_na_czesc") {
      throw new ServiceOrderStateError("Wybierz, na jaką część czeka zlecenie.");
    }
    if (input.to === "czeka_na_akceptacje") {
      throw new ServiceOrderStateError("Wpisz kwotę wyceny — zlecenie poczeka na decyzję klienta.");
    }
    // Wyjście z „czeka na decyzję klienta” do naprawy albo do wydania to decyzja klienta — zapisana w zleceniu.
    const decision: ServiceQuoteDecision | null =
      o.status === "czeka_na_akceptacje" ? (input.to === "w_naprawie" ? "accepted" : input.to === "gotowe" ? "rejected" : null) : null;
    // Powrót z wyceny do diagnozy wycofuje wycenę — nowa kwota przyjdzie z kolejnym zapisem wyceny.
    const quoteWithdrawn = o.status === "czeka_na_akceptacje" && input.to === "diagnoza";
    if (quoteWithdrawn) {
      await c.query(
        `UPDATE service_orders SET quote_amount = NULL, quote_note = '', quote_sent_at = NULL, quote_decision = NULL, quote_decided_at = NULL WHERE id = $1`,
        [o.id]
      );
      await addEvent(c, o.id, "quote_decision", actor, { note: "Wycena wycofana — powrót do diagnozy" });
    }
    if (decision) {
      await c.query(`UPDATE service_orders SET quote_decision = $2, quote_decided_at = now() WHERE id = $1`, [o.id, decision]);
      await addEvent(c, o.id, "quote_decision", actor, { note: decision === "accepted" ? "Klient akceptuje wycenę" : "Klient odmawia — zwrot bez naprawy" });
    }
    if (input.to === "wydane" && input.outbound) {
      await c.query(
        `UPDATE service_orders SET outbound_method = $2, outbound_tracking = $3, outbound_address = $4 WHERE id = $1`,
        [o.id, input.outbound.method, input.outbound.tracking, input.outbound.address]
      );
      await addEvent(c, o.id, "shipment", actor, {
        note: [SERVICE_OUTBOUND_LABEL[input.outbound.method], input.outbound.tracking, input.outbound.address].filter(Boolean).join(" · "),
      });
    }
    const closing = isClosedServiceOrder(input.to);
    // Wyjście z „czeka na część” kończy czekanie — część zostaje w historii (zdarzenie waiting_part).
    await c.query(
      `UPDATE service_orders
          SET status = $2, closed_at = CASE WHEN $3 THEN now() ELSE NULL END, updated_at = now(),
              waiting_part_tw_id = NULL, waiting_part_symbol = NULL, waiting_part_name = NULL,
              waiting_part_qty = NULL, waiting_since = NULL
        WHERE id = $1`,
      [o.id, input.to, closing]
    );
    await addEvent(c, o.id, "status", actor, { fromStatus: o.status, toStatus: input.to, note: input.note });
    return {
      ...o,
      status: input.to,
      waitingPart: null,
      quote: quoteWithdrawn
        ? { amount: null, note: "", sentAt: null, decision: null, decidedAt: null }
        : decision
          ? { ...o.quote, decision, decidedAt: new Date().toISOString() }
          : o.quote,
      outbound: input.to === "wydane" && input.outbound ? { ...input.outbound } : o.outbound,
    };
  });
}

/** Wycena po diagnozie: kwota brutto i zakres → status „czeka na decyzję klienta” (wiadomość do klienta idzie helpdeskiem). */
export async function sendServiceOrderQuote(
  input: { orderId: string; amount: number; note: string },
  actor: ServiceActor
): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (!canMoveServiceOrder(o.status, "czeka_na_akceptacje")) {
      throw new ServiceOrderStateError(
        `Zlecenie ${o.number} ma status „${SERVICE_ORDER_STATUS_LABEL[o.status]}” — wycenę wysyła się po diagnozie. Odśwież panel.`
      );
    }
    await c.query(
      `UPDATE service_orders
          SET status = 'czeka_na_akceptacje', updated_at = now(), quote_amount = $2, quote_note = $3, quote_sent_at = now(),
              quote_decision = NULL, quote_decided_at = NULL
        WHERE id = $1`,
      [o.id, input.amount, input.note]
    );
    await addEvent(c, o.id, "status", actor, { fromStatus: o.status, toStatus: "czeka_na_akceptacje" });
    await addEvent(c, o.id, "quote", actor, { note: [formatQuoteAmount(input.amount), input.note].filter(Boolean).join(" — ").slice(0, 1000) });
    const now = new Date().toISOString();
    return { ...o, status: "czeka_na_akceptacje", quote: { amount: input.amount, note: input.note, sentAt: now, decision: null, decidedAt: null } };
  });
}

/** „Czeka na część”: status + która część (z Subiekta albo sama nazwa) i ile. Zgłoszenie do zakupów robi akcja. */
export async function waitForServicePart(
  input: { orderId: string; part: { twId: number | null; symbol: string | null; name: string }; qty: number; note: string },
  actor: ServiceActor
): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (!canMoveServiceOrder(o.status, "czeka_na_czesc")) {
      throw new ServiceOrderStateError(
        `Zlecenie ${o.number} ma status „${SERVICE_ORDER_STATUS_LABEL[o.status]}” — nie może czekać na część. Odśwież panel.`
      );
    }
    await c.query(
      `UPDATE service_orders
          SET status = 'czeka_na_czesc', updated_at = now(), waiting_part_tw_id = $2, waiting_part_symbol = $3,
              waiting_part_name = $4, waiting_part_qty = $5, waiting_since = now()
        WHERE id = $1`,
      [o.id, input.part.twId, input.part.symbol, input.part.name, input.qty]
    );
    await addEvent(c, o.id, "status", actor, { fromStatus: o.status, toStatus: "czeka_na_czesc", note: input.note });
    await addEvent(c, o.id, "waiting_part", actor, { note: `${input.qty} szt. ${input.part.symbol ?? input.part.name}` });
    return {
      ...o,
      status: "czeka_na_czesc",
      waitingPart: { twId: input.part.twId, symbol: input.part.symbol, name: input.part.name, qty: input.qty, since: new Date().toISOString(), requestStatus: null },
    };
  });
}

/** Faktura za naprawę (od „gotowe”): z listy FS klienta (fsId) albo numer wpisany ręcznie. Zastępuje „bez faktury”. */
export async function setServiceOrderInvoice(
  input: { orderId: string; fsId: number | null; fsNumber: string },
  actor: ServiceActor
): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (!canSetServiceOrderInvoice(o.status)) {
      throw new ServiceOrderStateError(`Fakturę wpisz przy wydaniu — zlecenie ${o.number} jest „${SERVICE_ORDER_STATUS_LABEL[o.status]}”.`);
    }
    await c.query(
      `UPDATE service_orders SET fs_id = $2, fs_number = $3, fs_at = now(), no_invoice_reason = NULL, updated_at = now() WHERE id = $1`,
      [o.id, input.fsId, input.fsNumber]
    );
    await addEvent(c, o.id, "invoice", actor, { note: input.fsNumber });
    return { ...o, fsId: input.fsId, fsNumber: input.fsNumber, noInvoiceReason: null };
  });
}

/** Naprawa bez faktury (gwarancja, bezpłatna) — z powodem; zamyka brak faktury na liście dokumentów. */
export async function setServiceOrderNoInvoice(input: { orderId: string; reason: string }, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (!canSetServiceOrderInvoice(o.status)) {
      throw new ServiceOrderStateError(`Zlecenie ${o.number} jest „${SERVICE_ORDER_STATUS_LABEL[o.status]}” — faktury tu nie dotyczy.`);
    }
    await c.query(
      `UPDATE service_orders SET fs_id = NULL, fs_number = NULL, fs_at = NULL, no_invoice_reason = $2, updated_at = now() WHERE id = $1`,
      [o.id, input.reason]
    );
    await addEvent(c, o.id, "invoice", actor, { note: `Bez faktury: ${input.reason}` });
    return { ...o, fsId: null, fsNumber: null, noInvoiceReason: input.reason };
  });
}

/** Zmiana zdania: faktura albo „bez faktury” wraca do pustej (np. wpisany zły numer). */
export async function clearServiceOrderInvoice(input: { orderId: string }, actor: ServiceActor): Promise<ServiceOrder> {
  return inTx(async (c) => {
    const o = await lockOrder(c, input.orderId);
    if (!o.fsNumber && !o.noInvoiceReason) return o;
    await c.query(
      `UPDATE service_orders SET fs_id = NULL, fs_number = NULL, fs_at = NULL, no_invoice_reason = NULL, updated_at = now() WHERE id = $1`,
      [o.id]
    );
    await addEvent(c, o.id, "invoice_cleared", actor, { note: o.fsNumber ?? "bez faktury" });
    return { ...o, fsId: null, fsNumber: null, noInvoiceReason: null };
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

/**
 * Zlecenia z tym samym numerem seryjnym (bez spacji i wielkości liter), najnowsze pierwsze — historia egzemplarza
 * przy przyjęciu i w panelu zlecenia. Krótkie numery (< 4 znaki) nic nie znajdują, żeby nie łapać przypadkowych.
 */
export async function fetchServiceOrdersBySerial(serial: string, excludeOrderId: string | null, limit = 5): Promise<SerialHistoryItem[]> {
  const key = serialKey(serial);
  if (key.length < 4) return [];
  const res = await query<{
    id: string;
    number: string;
    status: ServiceOrderStatus;
    device_name: string;
    created_at: Date;
    closed_at: Date | null;
    fault: string;
    work_note: string;
  }>(
    `SELECT id, number, status, device_name, created_at, closed_at, fault, work_note
       FROM service_orders
      WHERE upper(regexp_replace(coalesce(serial_no, ''), '\\s+', '', 'g')) = $1
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      ORDER BY created_at DESC
      LIMIT $3`,
    [key, excludeOrderId, limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    deviceName: r.device_name,
    createdAt: new Date(r.created_at).toISOString(),
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    fault: r.fault,
    workNote: r.work_note,
  }));
}

export type ServiceModelWarranty = { modelTwId: number; modelSymbol: string | null; modelName: string; months: number };

/** Okresy gwarancji modeli różne od domyślnego (24 mies.). */
export async function fetchServiceModelWarranties(): Promise<ServiceModelWarranty[]> {
  const res = await query<{ model_tw_id: number; model_symbol: string | null; model_name: string; months: number }>(
    `SELECT model_tw_id, model_symbol, model_name, months FROM service_model_warranty ORDER BY model_name`
  );
  return res.rows.map((r) => ({ modelTwId: Number(r.model_tw_id), modelSymbol: r.model_symbol, modelName: r.model_name, months: Number(r.months) }));
}

/** Okres gwarancji modelu; okres równy domyślnemu usuwa wpis (model wraca do domyślnego). */
export async function setServiceModelWarranty(input: ServiceModelWarranty, actor: ServiceActor): Promise<void> {
  if (input.months === SERVICE_WARRANTY_DEFAULT_MONTHS) {
    await query(`DELETE FROM service_model_warranty WHERE model_tw_id = $1`, [input.modelTwId]);
    return;
  }
  await query(
    `INSERT INTO service_model_warranty (model_tw_id, model_symbol, model_name, months, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (model_tw_id) DO UPDATE SET
       model_symbol = EXCLUDED.model_symbol, model_name = EXCLUDED.model_name, months = EXCLUDED.months,
       updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [input.modelTwId, input.modelSymbol, input.modelName, input.months, actor.id]
  );
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

/** Inne zlecenia tego samego klienta (kh_Id z Subiekta), najnowsze najpierw — powiązane sprawy w karcie zlecenia. */
export async function fetchServiceOrdersByClient(khId: number, excludeOrderId: string | null, limit = 8): Promise<SerialHistoryItem[]> {
  if (!Number.isSafeInteger(khId) || khId <= 0) return [];
  const res = await query<{
    id: string;
    number: string;
    status: ServiceOrderStatus;
    device_name: string;
    created_at: Date;
    closed_at: Date | null;
    fault: string;
    work_note: string;
  }>(
    `SELECT id, number, status, device_name, created_at, closed_at, fault, work_note
       FROM service_orders
      WHERE client_kh_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)
      ORDER BY created_at DESC
      LIMIT $3`,
    [khId, excludeOrderId, limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    deviceName: r.device_name,
    createdAt: new Date(r.created_at).toISOString(),
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    fault: r.fault,
    workNote: r.work_note,
  }));
}
