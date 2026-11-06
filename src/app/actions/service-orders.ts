"use server";

import { revalidatePath } from "next/cache";
import { requireServicePanel } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import {
  deleteServiceModelPart,
  fetchOrdersByHelpdeskIds,
  fetchServiceOrdersByClient,
  sendServiceOrderQuote,
  type HelpdeskLinkedOrder,
  fetchServiceOrdersBySerial,
  setServiceModelWarranty,
  insertServiceOrder,
  linkServiceOrderLoaner,
  moveServiceOrder,
  returnServiceOrderPart,
  ServiceOrderStateError,
  clearServiceOrderInvoice,
  setServiceOrderInvoice,
  setServiceOrderNoInvoice,
  setServiceOrderRw,
  waitForServicePart,
  takeServiceOrderPart,
  updateServiceOrderWorkNote,
  upsertServiceModelPart,
  type ServiceActor,
} from "@/lib/data/service-orders";
import {
  formatQuoteAmount,
  parseQuoteAmount,
  SERVICE_INBOUND_LABEL,
  SERVICE_OUTBOUND_LABEL,
  type ServiceInboundMethod,
  type ServiceOutboundMethod,
  normalizeRwNumber,
  SERVICE_ORDER_STATUS_LABEL,
  SERVICE_ORDER_TEXT_MAX,
  type SerialHistoryItem,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";
import { parseDateOnly, toDateOnly } from "@/lib/orders/service-loaners";
import { normalizePurchaseDate, SERVICE_WARRANTY_MONTHS_MAX } from "@/lib/orders/service-warranty";
import { verifySubiektProduct, type VerifiedSubiektProduct } from "@/lib/subiekt/product-verify";
import { fetchClientEquipment, fetchClientRecentInvoices, findInvoiceBuyer, type ClientRecentInvoice } from "@/lib/subiekt/client-equipment";
import { reportServicePartShortage } from "@/lib/data/service-part-report";
import type { ClientEquipmentItem } from "@/lib/subiekt/client-equipment-parse";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import {
  fetchHelpdeskMessages,
  fetchHelpdeskTicket,
  helpdeskStatusId,
  helpdeskWriteEnabled,
  searchHelpdeskTickets,
  setHelpdeskStatus,
} from "@/lib/mikran-shop/helpdesk";
import {
  extractInvoiceNumber,
  isStaffEmail,
  nipDigits,
  parseHelpdeskNumber,
  splitProductSerial,
  type HelpdeskMessage,
  type HelpdeskTicket,
} from "@/lib/mikran-shop/helpdesk-parse";
import { searchSubiektCustomersCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { lookupSubiektKontrahentByKhId } from "@/lib/subiekt/lookup-kontrahent";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

export type ServiceOrderActionResult = { ok: true; message: string; orderId?: string } | { ok: false; message: string };

const ORDERS_PATH = "/serwis/zlecenia";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = Object.keys(SERVICE_ORDER_STATUS_LABEL) as ServiceOrderStatus[];
const INBOUND = Object.keys(SERVICE_INBOUND_LABEL) as ServiceInboundMethod[];
const OUTBOUND = Object.keys(SERVICE_OUTBOUND_LABEL) as ServiceOutboundMethod[];

/**
 * Status zgłoszenia w helpdesku po przyjęciu / wydaniu (tylko z MIKRAN_HELPDESK_WRITE=1, zawsze bez maila).
 * Błąd helpdesku nie cofa zapisu w OnTime — wraca jako dopisek do komunikatu.
 */
async function syncHelpdeskStatus(helpdeskId: number, kind: "accepted" | "done", comment: string): Promise<string> {
  if (!helpdeskWriteEnabled()) return "";
  try {
    await setHelpdeskStatus(helpdeskId, helpdeskStatusId(kind), comment);
    return ` Zgłoszenie #${helpdeskId}: ${kind === "accepted" ? "przyjęte do realizacji" : "zakończone"}.`;
  } catch {
    return ` Statusu zgłoszenia #${helpdeskId} w helpdesku nie zmieniono — zmień go ręcznie.`;
  }
}

function actorOf(user: SessionUser): ServiceActor {
  const name = user.email.split("@")[0] || user.email;
  return { id: user.id === "dev" ? null : user.id, name };
}

function text(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function uuid(v: unknown, what: string): string {
  const id = String(v ?? "").trim();
  if (!UUID_RE.test(id)) throw new ServiceOrderStateError(`Nieprawidłowe ${what}. Odśwież panel.`);
  return id;
}

function twId(v: unknown): number | null {
  const n = Math.trunc(Number(v));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** tw_Id z przeglądarki sprawdzony w Subiekcie; błąd połączenia zamieniony na komunikat. */
async function verifiedProduct(id: number, notFound: string): Promise<VerifiedSubiektProduct> {
  let p: VerifiedSubiektProduct | null;
  try {
    p = await verifySubiektProduct(id);
  } catch {
    throw new ServiceOrderStateError("Nie udało się sprawdzić towaru w Subiekcie. Spróbuj za chwilę.");
  }
  if (!p) throw new ServiceOrderStateError(notFound);
  return p;
}

/** Termin dla klienta: opcjonalny, od dziś do roku w przód. */
function dueDate(v: unknown): string | null {
  const raw = text(v, 10);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ServiceOrderStateError("Termin dla klienta ma zły format.");
  const d = parseDateOnly(raw);
  const now = new Date();
  const min = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const max = new Date(min.getFullYear() + 1, min.getMonth(), min.getDate());
  if (d < min) throw new ServiceOrderStateError("Termin dla klienta nie może być w przeszłości.");
  if (d > max) throw new ServiceOrderStateError("Termin dla klienta może być najwyżej rok od dziś.");
  return toDateOnly(d);
}

async function run(fn: () => Promise<{ message: string; orderId?: string }>, paths: string[] = [ORDERS_PATH]): Promise<ServiceOrderActionResult> {
  try {
    const out = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...out };
  } catch (e) {
    if (e instanceof ServiceOrderStateError) return { ok: false, message: e.message };
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać. Spróbuj ponownie.") };
  }
}

export async function actionCreateServiceOrder(input: {
  clientKhId?: number | null;
  clientName: string;
  clientPhone?: string | null;
  deviceTwId?: number | null;
  deviceName?: string;
  serialNo?: string | null;
  fault: string;
  accessories?: string;
  dueDate?: string | null;
  /** YYYY-MM-DD — z FS/PA na liście sprzętu klienta albo wpisana; podstawa gwarancji. */
  purchaseDate?: string | null;
  purchaseDoc?: string | null;
  /** Numer zgłoszenia z helpdesku mikran.pl, z którego przyjmujemy sprzęt. */
  helpdeskId?: number | null;
  /** Jak sprzęt przyszedł i (przy odbiorze kurierem Mikranu) kiedy kurier ma go odebrać — YYYY-MM-DD. */
  inboundMethod?: string | null;
  inboundPickupDate?: string | null;
}): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const helpdeskId = twId(input.helpdeskId);
    const inboundMethod = INBOUND.find((m) => m === input.inboundMethod) ?? null;
    if (input.inboundMethod && !inboundMethod) throw new ServiceOrderStateError("Nieznany sposób dostarczenia sprzętu. Odśwież okno.");
    const pickupRaw = text(input.inboundPickupDate, 10);
    if (pickupRaw && !/^\d{4}-\d{2}-\d{2}$/.test(pickupRaw)) throw new ServiceOrderStateError("Data odbioru kurierem ma zły format.");
    const inboundPickupDate = inboundMethod === "odbior_mikran" && pickupRaw ? toDateOnly(parseDateOnly(pickupRaw)) : null;
    const purchaseRaw = (input.purchaseDate ?? "").trim();
    const purchaseDate = normalizePurchaseDate(purchaseRaw, new Date());
    if (purchaseRaw && !purchaseDate) throw new ServiceOrderStateError("Data zakupu: wybierz datę z kalendarza, nie późniejszą niż dziś.");
    const clientName = text(input.clientName, SERVICE_ORDER_TEXT_MAX.client);
    if (!clientName) throw new ServiceOrderStateError("Wybierz klienta albo wpisz jego nazwę.");
    const fault = text(input.fault, SERVICE_ORDER_TEXT_MAX.fault);
    if (!fault) throw new ServiceOrderStateError("Opisz usterkę — co zgłasza klient.");
    const deviceId = twId(input.deviceTwId);
    let deviceSymbol: string | null = null;
    let deviceName = text(input.deviceName, SERVICE_ORDER_TEXT_MAX.device);
    if (deviceId) {
      const p = await verifiedProduct(deviceId, "Subiekt nie zna tego modelu. Wybierz go z podpowiedzi albo wpisz nazwę sprzętu ręcznie.");
      deviceSymbol = p.symbol;
      deviceName = p.name;
    }
    if (!deviceName) throw new ServiceOrderStateError("Wybierz model z Subiekta albo wpisz nazwę sprzętu.");
    const order = await insertServiceOrder(
      {
        clientKhId: twId(input.clientKhId),
        clientName,
        clientPhone: text(input.clientPhone, SERVICE_ORDER_TEXT_MAX.phone) || null,
        deviceTwId: deviceId,
        deviceSymbol,
        deviceName,
        serialNo: text(input.serialNo, SERVICE_ORDER_TEXT_MAX.serial) || null,
        fault,
        accessories: text(input.accessories, SERVICE_ORDER_TEXT_MAX.accessories),
        dueDate: dueDate(input.dueDate),
        purchaseDate,
        purchaseDoc: text(input.purchaseDoc, 60) || null,
        helpdeskId,
        inboundMethod,
        inboundPickupDate,
      },
      actorOf(user)
    );
    const synced = helpdeskId ? await syncHelpdeskStatus(helpdeskId, "accepted", `Przyjęto sprzęt: ${order.number} (${deviceName}).`) : "";
    return { message: `Przyjęto ${order.number}: ${deviceName} od ${clientName}.${synced}`, orderId: order.id };
  });
}

export async function actionMoveServiceOrder(input: {
  orderId: string;
  to: string;
  note?: string;
  /** Przy „wydane”: sposób zwrotu (gls / inny_kurier / osobiscie), numer przesyłki, adres wysyłki. */
  outbound?: { method: string; tracking?: string | null; address?: string | null } | null;
}): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const to = STATUSES.find((s) => s === input.to);
    if (!to) throw new ServiceOrderStateError("Nieznany status. Odśwież panel.");
    const note = text(input.note, 300);
    if (to === "anulowane" && !note) throw new ServiceOrderStateError("Wpisz powód anulowania (np. klient zrezygnował).");
    let outbound: { method: ServiceOutboundMethod; tracking: string | null; address: string | null } | null = null;
    if (to === "wydane" && input.outbound) {
      const method = OUTBOUND.find((m) => m === input.outbound!.method);
      if (!method) throw new ServiceOrderStateError("Wybierz, jak sprzęt wraca do klienta.");
      outbound = { method, tracking: text(input.outbound.tracking, 60) || null, address: text(input.outbound.address, 300) || null };
    }
    const o = await moveServiceOrder({ orderId: uuid(input.orderId, "zlecenie"), to, note, outbound }, actorOf(user));
    let synced = "";
    if (to === "wydane" && o.helpdeskId) {
      // Zgłoszenie bywa na kilka urządzeń — „zakończone” dopiero, gdy wydano sprzęt ze wszystkich jego zleceń.
      const all = (await fetchOrdersByHelpdeskIds([o.helpdeskId])).get(o.helpdeskId) ?? [];
      if (all.every((x) => x.status === "wydane")) synced = await syncHelpdeskStatus(o.helpdeskId, "done", `Wydano sprzęt: ${all.map((x) => x.number).join(", ")}.`);
    }
    return { message: `${o.number}: ${SERVICE_ORDER_STATUS_LABEL[to]}.${synced}`, orderId: o.id };
  });
}

/** Wycena po diagnozie: kwota brutto i zakres; zlecenie czeka na decyzję klienta (decyzję zapisuje przejście statusu). */
export async function actionSendServiceQuote(input: { orderId: string; amount: string; note?: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const amount = parseQuoteAmount(String(input.amount ?? ""));
    if (amount == null) throw new ServiceOrderStateError("Wpisz kwotę wyceny w złotych, np. 674,27.");
    const o = await sendServiceOrderQuote({ orderId: uuid(input.orderId, "zlecenie"), amount, note: text(input.note, 1000) }, actorOf(user));
    return { message: `${o.number}: wycena ${formatQuoteAmount(amount)} — czeka na decyzję klienta.`, orderId: o.id };
  });
}

export async function actionUpdateServiceOrderWorkNote(input: { orderId: string; workNote: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const o = await updateServiceOrderWorkNote(
      { orderId: uuid(input.orderId, "zlecenie"), workNote: text(input.workNote, SERVICE_ORDER_TEXT_MAX.workNote) },
      actorOf(user)
    );
    return { message: `${o.number}: zapisano opis prac.`, orderId: o.id };
  });
}

export async function actionTakeServiceOrderPart(input: {
  orderId: string;
  partTwId: number;
  quantity: number;
  /** Model zlecenia — gdy podany i `remember`, część trafia do katalogu tego modelu. */
  rememberForModel?: boolean;
}): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const orderId = uuid(input.orderId, "zlecenie");
      const partId = twId(input.partTwId);
      if (!partId) throw new ServiceOrderStateError("Wybierz część z Subiekta.");
      const qty = Number(input.quantity);
      if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new ServiceOrderStateError("Ilość: liczba całkowita od 1 do 999.");
      const p = await verifiedProduct(partId, "Subiekt nie zna tej części. Wybierz ją z podpowiedzi.");
      const actor = actorOf(user);
      const order = await takeServiceOrderPart({ orderId, partTwId: p.twId, partSymbol: p.symbol, partName: p.name, quantity: qty }, actor);
      let remembered = "";
      if (input.rememberForModel === true && order.deviceTwId && order.deviceTwId !== p.twId) {
        await upsertServiceModelPart(
          {
            modelTwId: order.deviceTwId,
            modelSymbol: order.deviceSymbol,
            modelName: order.deviceName,
            partTwId: p.twId,
            partSymbol: p.symbol,
            partName: p.name,
            defaultQty: qty,
            note: "",
          },
          actor
        );
        remembered = " Zapamiętano w katalogu modelu.";
      }
      return { message: `Pobrano ${qty} szt. ${p.symbol ?? p.name}.${remembered}`, orderId };
    },
    [ORDERS_PATH, "/serwis", "/serwis/modele"]
  );
}

export async function actionReturnServiceOrderPart(input: { orderId: string; partId: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const orderId = uuid(input.orderId, "zlecenie");
      await returnServiceOrderPart({ orderId, partId: uuid(input.partId, "część") }, actorOf(user));
      return { message: "Część oddana — nie trafi do RW.", orderId };
    },
    [ORDERS_PATH, "/serwis"]
  );
}

export async function actionSetServiceOrderRw(input: { orderId: string; rwNumber: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const rw = normalizeRwNumber(String(input.rwNumber ?? ""));
      if (!rw) throw new ServiceOrderStateError("Wpisz numer RW z Subiekta, np. RW 15/MAG/2026.");
      const o = await setServiceOrderRw({ orderId: uuid(input.orderId, "zlecenie"), rwNumber: rw }, actorOf(user));
      return { message: `${o.number}: zapisano ${rw}. Zlecenie rozliczone.`, orderId: o.id };
    },
    [ORDERS_PATH, "/serwis"]
  );
}

export async function actionLinkServiceOrderLoaner(input: { orderId: string; unitId: string | null }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const unitId = input.unitId ? uuid(input.unitId, "egzemplarz") : null;
      const o = await linkServiceOrderLoaner({ orderId: uuid(input.orderId, "zlecenie"), unitId }, actorOf(user));
      return { message: unitId ? `${o.number}: powiązano zamiennik.` : `${o.number}: odpięto zamiennik.`, orderId: o.id };
    },
    [ORDERS_PATH, "/serwis/zamienniki"]
  );
}

export async function actionAddServiceModelPart(input: {
  modelTwId: number;
  partTwId: number;
  defaultQty?: number;
  note?: string;
}): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const modelId = twId(input.modelTwId);
      const partId = twId(input.partTwId);
      if (!modelId) throw new ServiceOrderStateError("Wybierz model z Subiekta.");
      if (!partId) throw new ServiceOrderStateError("Wybierz część z Subiekta.");
      if (modelId === partId) throw new ServiceOrderStateError("Model nie może być swoją częścią.");
      const qty = input.defaultQty == null ? 1 : Number(input.defaultQty);
      if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new ServiceOrderStateError("Ilość: liczba całkowita od 1 do 999.");
      const [model, part] = await Promise.all([
        verifiedProduct(modelId, "Subiekt nie zna tego modelu."),
        verifiedProduct(partId, "Subiekt nie zna tej części."),
      ]);
      await upsertServiceModelPart(
        {
          modelTwId: model.twId,
          modelSymbol: model.symbol,
          modelName: model.name,
          partTwId: part.twId,
          partSymbol: part.symbol,
          partName: part.name,
          defaultQty: qty,
          note: text(input.note, 200),
        },
        actorOf(user)
      );
      return { message: `${part.symbol ?? part.name} w katalogu modelu ${model.symbol ?? model.name}.` };
    },
    [ORDERS_PATH, "/serwis/modele"]
  );
}

export async function actionRemoveServiceModelPart(input: { modelTwId: number; partTwId: number }): Promise<ServiceOrderActionResult> {
  await requireServicePanel("mutate");
  return run(
    async () => {
      const modelId = twId(input.modelTwId);
      const partId = twId(input.partTwId);
      if (!modelId || !partId) throw new ServiceOrderStateError("Nieprawidłowa pozycja katalogu. Odśwież stronę.");
      const removed = await deleteServiceModelPart({ modelTwId: modelId, partTwId: partId });
      if (!removed) throw new ServiceOrderStateError("Tej części już nie ma w katalogu. Odśwież stronę.");
      return { message: "Usunięto część z katalogu modelu." };
    },
    [ORDERS_PATH, "/serwis/modele"]
  );
}

/** Okres gwarancji modelu (miesiące); okres domyślny przywraca model do domyślnego. */
export async function actionSetServiceModelWarranty(input: { modelTwId: number; months: number }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const modelId = twId(input.modelTwId);
      if (!modelId) throw new ServiceOrderStateError("Wybierz model z Subiekta.");
      const months = Number(input.months);
      if (!Number.isInteger(months) || months <= 0 || months > SERVICE_WARRANTY_MONTHS_MAX) {
        throw new ServiceOrderStateError(`Gwarancja: liczba miesięcy od 1 do ${SERVICE_WARRANTY_MONTHS_MAX}.`);
      }
      const model = await verifiedProduct(modelId, "Subiekt nie zna tego modelu.");
      await setServiceModelWarranty({ modelTwId: model.twId, modelSymbol: model.symbol, modelName: model.name, months }, actorOf(user));
      return { message: `Gwarancja ${model.symbol ?? model.name}: ${months} mies.` };
    },
    [ORDERS_PATH, "/serwis/modele"]
  );
}

export type ClientEquipmentActionResult =
  | { ok: true; items: ClientEquipmentItem[]; invoicesScanned: number; truncated: boolean }
  | { ok: false; message: string };

/** Sprzęt kupiony przez klienta (pozycje FS i PA z numerami seryjnymi w uwagach) — do wyboru przy przyjęciu. */
export async function actionServiceClientEquipment(khId: number): Promise<ClientEquipmentActionResult> {
  await requireServicePanel("read");
  const id = twId(khId);
  if (!id) return { ok: false, message: "Wybierz klienta z podpowiedzi Subiekta." };
  try {
    return { ok: true, ...(await fetchClientEquipment(id)) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się pobrać faktur i paragonów klienta z Subiekta.") };
  }
}

export async function actionWaitForServicePart(input: {
  orderId: string;
  partTwId?: number | null;
  /** Nazwa części wpisana ręcznie, gdy nie ma jej w Subiekcie. */
  partName?: string;
  quantity: number;
  /** Złóż od razu prośbę do zakupów (tylko części z cechą „Części serwisowe”). */
  report: boolean;
}): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(
    async () => {
      const orderId = uuid(input.orderId, "zlecenie");
      const qty = Number(input.quantity);
      if (!Number.isInteger(qty) || qty <= 0 || qty > 999) throw new ServiceOrderStateError("Ilość: liczba całkowita od 1 do 999.");
      const partId = twId(input.partTwId);
      let part: { twId: number | null; symbol: string | null; name: string };
      if (partId) {
        const p = await verifiedProduct(partId, "Subiekt nie zna tej części. Wybierz ją z podpowiedzi albo wpisz nazwę.");
        part = { twId: p.twId, symbol: p.symbol, name: p.name };
      } else {
        const name = text(input.partName, 200);
        if (!name) throw new ServiceOrderStateError("Wybierz część, na którą czeka zlecenie.");
        part = { twId: null, symbol: null, name };
      }
      const order = await waitForServicePart({ orderId, part, qty, note: "" }, actorOf(user));
      let reported = "";
      if (input.report === true) {
        if (!part.twId) {
          reported = " Nie zgłoszono zakupom — część spoza Subiekta.";
        } else {
          // Czekanie jest już zapisane; nieudane zgłoszenie tylko to mówi (można zgłosić z ekranu części).
          try {
            const res = await reportServicePartShortage({ twId: part.twId, quantity: qty, note: order.number }, user);
            reported = res.ok ? ` ${res.message}` : ` Nie zgłoszono zakupom: ${res.message}`;
          } catch (e) {
            reported = ` Nie zgłoszono zakupom: ${userFacingErrorText(e, "błąd zapisu prośby")}.`;
          }
        }
      }
      return { message: `${order.number} czeka na ${qty} szt. ${part.symbol ?? part.name}.${reported}`, orderId };
    },
    [ORDERS_PATH, "/serwis"]
  );
}

export async function actionSetServiceOrderInvoice(input: { orderId: string; fsId?: number | null; fsNumber: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const fsNumber = text(input.fsNumber, 60).replace(/\s+/g, " ");
    if (!fsNumber || !/\d/.test(fsNumber)) throw new ServiceOrderStateError("Wybierz fakturę klienta albo wpisz jej numer, np. FS 2362/M/10/2026.");
    const o = await setServiceOrderInvoice({ orderId: uuid(input.orderId, "zlecenie"), fsId: twId(input.fsId), fsNumber }, actorOf(user));
    return { message: `${o.number}: faktura ${fsNumber}.`, orderId: o.id };
  });
}

export async function actionSetServiceOrderNoInvoice(input: { orderId: string; reason: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const reason = text(input.reason, 200);
    if (!reason) throw new ServiceOrderStateError("Wpisz powód, np. naprawa gwarancyjna.");
    const o = await setServiceOrderNoInvoice({ orderId: uuid(input.orderId, "zlecenie"), reason }, actorOf(user));
    return { message: `${o.number}: bez faktury (${reason}).`, orderId: o.id };
  });
}

export async function actionClearServiceOrderInvoice(input: { orderId: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const o = await clearServiceOrderInvoice({ orderId: uuid(input.orderId, "zlecenie") }, actorOf(user));
    return { message: `${o.number}: faktura do wpisania od nowa.`, orderId: o.id };
  });
}

export type ClientInvoicesActionResult =
  | { ok: true; invoices: ClientRecentInvoice[] }
  | { ok: false; message: string };

/** Ostatnie faktury klienta (90 dni) — do wskazania faktury za naprawę przy wydaniu. */
export async function actionServiceClientInvoices(khId: number): Promise<ClientInvoicesActionResult> {
  await requireServicePanel("read");
  const id = twId(khId);
  if (!id) return { ok: false, message: "Klient spoza Subiekta — wpisz numer faktury ręcznie." };
  try {
    return { ok: true, invoices: await fetchClientRecentInvoices(id) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się pobrać faktur klienta z Subiekta.") };
  }
}

export type SerialHistoryActionResult = { ok: true; items: SerialHistoryItem[] } | { ok: false; message: string };

/** Wcześniejsze zlecenia tego samego egzemplarza (numer seryjny) — przy przyjęciu i w panelu zlecenia. */
export async function actionServiceSerialHistory(input: { serial: string; excludeOrderId?: string | null }): Promise<SerialHistoryActionResult> {
  await requireServicePanel("read");
  const serial = text(input.serial, SERVICE_ORDER_TEXT_MAX.serial);
  const exclude = input.excludeOrderId && UUID_RE.test(input.excludeOrderId) ? input.excludeOrderId : null;
  try {
    return { ok: true, items: await fetchServiceOrdersBySerial(serial, exclude) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się sprawdzić historii egzemplarza.") };
  }
}

export type HelpdeskIntakeDraft = {
  helpdeskId: number;
  test: boolean;
  /** Klient z Subiekta (dopasowany jednoznacznie); bez dopasowania nazwa ze zgłoszenia bez kh_Id. */
  client: { khId: number | null; name: string; phone: string | null };
  /** Po czym znaleziono klienta w Subiekcie; null — nie znaleziono. */
  clientMatch: "nip" | "faktura" | "email" | null;
  phone: string;
  deviceName: string;
  /** Numer seryjny wydzielony z pola „Produkt” zgłoszenia („Turbina SN 4321”); pusty, gdy go nie było. */
  serial: string;
  fault: string;
  /** Numer faktury tak, jak go podał klient — do podświetlenia sprzętu z tej faktury. */
  invoiceId: string;
  /** Faktura ze zgłoszenia znaleziona w Subiekcie (pełny numer); null — nie podano albo nie ma takiej. */
  invoiceFound: string | null;
  /** Zlecenia już założone z tego zgłoszenia (zgłoszenie bywa na kilka urządzeń) — ostrzeżenie, nie blokada. */
  existingOrders: HelpdeskLinkedOrder[];
};

export type HelpdeskIntakeResult = { ok: true; draft: HelpdeskIntakeDraft } | { ok: false; message: string };

/** Zgłoszenie z helpdesku mikran.pl zamienione na szkic przyjęcia: klient po NIP, telefon, sprzęt, opis usterki. */
export async function actionServiceHelpdeskDraft(rawNumber: string | number): Promise<HelpdeskIntakeResult> {
  await requireServicePanel("read");
  const id = typeof rawNumber === "number" ? twId(rawNumber) : parseHelpdeskNumber(String(rawNumber ?? ""));
  if (!id) return { ok: false, message: "Wpisz numer zgłoszenia z helpdesku (same cyfry, np. 1234)." };
  try {
    const { mode, ticket } = await fetchHelpdeskTicket(id);
    if (mode === "off") return { ok: false, message: "Helpdesk mikran.pl nie jest podłączony (brak kluczy API). Przyjmij sprzęt ręcznie." };
    if (!ticket) return { ok: false, message: `Nie ma zgłoszenia #${id} w helpdesku. Sprawdź numer.` };
    const existingOrders = (await fetchOrdersByHelpdeskIds([id])).get(id) ?? [];
    const name = (ticket.company || ticket.name).slice(0, SERVICE_ORDER_TEXT_MAX.client);
    const product = splitProductSerial(ticket.product);
    const asClient = (k: SubiektKontrahent): HelpdeskIntakeDraft["client"] => ({
      khId: k.kh_Id,
      name: String(k.adr_NazwaPelna || k.adr_Nazwa || k.kh_Symbol || name).trim(),
      phone: String(k.adr_Telefon || k.kh_Telefon || "").trim() || null,
    });
    let client: HelpdeskIntakeDraft["client"] = { khId: null, name, phone: null };
    let clientMatch: HelpdeskIntakeDraft["clientMatch"] = null;
    // Faktura ze zgłoszenia: potwierdza zakup i wskazuje kupującego, gdy NIP nie pasuje. Błąd Subiekta = brak trafienia.
    // Numer faktury bywa w polu produktu albo w opisie („faktura nr 1617/M/09/2025. Marathon…”).
    const invoiceNo = extractInvoiceNumber(ticket.invoiceId, ticket.product, ticket.comment) || ticket.invoiceId.trim();
    const invoice = invoiceNo ? await findInvoiceBuyer(invoiceNo).catch(() => null) : null;
    // Tylko jednoznaczne trafienia; po kolei: NIP, faktura, e-mail. Brak Subiekta — zostaje nazwa ze zgłoszenia.
    const nip = nipDigits(ticket.vat);
    if (nip) {
      const found = await searchSubiektCustomersCached({ search: nip, pageSize: 5, page: 1, includeBlocked: true }).catch(() => null);
      const hits = (found?.data ?? []).filter((k) => nipDigits(String(k.adr_NIP ?? "")) === nip);
      if (hits.length === 1) [client, clientMatch] = [asClient(hits[0]!), "nip"];
    }
    if (!clientMatch && invoice) {
      const k = await lookupSubiektKontrahentByKhId(invoice.khId).catch(() => null);
      if (k) [client, clientMatch] = [asClient(k), "faktura"];
    }
    const email = ticket.email.trim().toLowerCase();
    // Zgłoszenie założone przez serwis ma e-mail pracownika — po nim klienta nie szukamy.
    if (!clientMatch && email && !isStaffEmail(email) && name.length >= 2) {
      const found = await searchSubiektCustomersCached({ search: name.slice(0, 60), pageSize: 12, page: 1, includeBlocked: true }).catch(() => null);
      const hits = (found?.data ?? []).filter((k) => String(k.kh_EMail ?? "").trim().toLowerCase() === email);
      if (hits.length === 1) [client, clientMatch] = [asClient(hits[0]!), "email"];
    }
    return {
      ok: true,
      draft: {
        helpdeskId: id,
        test: ticket.test,
        client,
        clientMatch,
        phone: ticket.telephone.slice(0, SERVICE_ORDER_TEXT_MAX.phone),
        deviceName: product.name.slice(0, SERVICE_ORDER_TEXT_MAX.device),
        serial: product.serial.slice(0, SERVICE_ORDER_TEXT_MAX.serial),
        fault: ticket.comment.slice(0, SERVICE_ORDER_TEXT_MAX.fault),
        invoiceId: invoiceNo,
        // Faktura innego klienta niż dopasowany po NIP nie jest jego zakupem — nie podświetlamy jej.
        invoiceFound: invoice && (clientMatch !== "nip" || invoice.khId === client.khId) ? invoice.number : null,
        existingOrders,
      },
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się pobrać zgłoszenia z helpdesku. Spróbuj za chwilę.") };
  }
}

export type HelpdeskSearchResult = { ok: true; tickets: (HelpdeskTicket & { orders: HelpdeskLinkedOrder[] })[] } | { ok: false; message: string };

/** Szukanie zgłoszenia przy przyjęciu: cały helpdesk (wszystkie statusy i osoby), z już założonymi zleceniami. */
export async function actionServiceHelpdeskSearch(query: string): Promise<HelpdeskSearchResult> {
  await requireServicePanel("read");
  const q = text(query, 80);
  if (q.length < 2) return { ok: true, tickets: [] };
  try {
    const { mode, tickets } = await searchHelpdeskTickets(q);
    if (mode === "off") return { ok: false, message: "Helpdesk mikran.pl nie jest podłączony (brak kluczy API)." };
    const linked = await fetchOrdersByHelpdeskIds(tickets.map((t) => t.id));
    return { ok: true, tickets: tickets.map((t) => ({ ...t, orders: linked.get(t.id) ?? [] })) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się przeszukać helpdesku. Spróbuj za chwilę.") };
  }
}

export type HelpdeskThreadResult = { ok: true; messages: HelpdeskMessage[] } | { ok: false; message: string };

/** Rozmowa z klientem w zgłoszeniu (tylko odczyt) — do karty zlecenia. */
export async function actionServiceHelpdeskThread(helpdeskId: number): Promise<HelpdeskThreadResult> {
  await requireServicePanel("read");
  const id = twId(helpdeskId);
  if (!id) return { ok: false, message: "Nieprawidłowy numer zgłoszenia." };
  try {
    const { mode, messages } = await fetchHelpdeskMessages(id);
    if (mode === "off") return { ok: false, message: "Helpdesk mikran.pl nie jest podłączony (brak kluczy API)." };
    return { ok: true, messages };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się pobrać rozmowy ze zgłoszenia. Spróbuj za chwilę.") };
  }
}

export type RelatedCasesResult =
  | {
      ok: true;
      /** Inne zlecenia tego klienta (kh_Id) i tego egzemplarza (numer seryjny), bez bieżącego. */
      clientOrders: SerialHistoryItem[];
      serialOrders: SerialHistoryItem[];
      /** Inne zgłoszenia z helpdesku po numerze seryjnym i nazwie klienta, bez zgłoszenia tego zlecenia. */
      tickets: HelpdeskTicket[];
      helpdeskError: string | null;
    }
  | { ok: false; message: string };

/** Powiązane sprawy w karcie zlecenia: duplikaty zgłoszeń, powroty tego samego sprzętu, inne naprawy klienta. */
export async function actionServiceRelatedCases(input: {
  orderId: string;
  clientKhId: number | null;
  clientName: string;
  serialNo: string | null;
  helpdeskId: number | null;
}): Promise<RelatedCasesResult> {
  await requireServicePanel("read");
  const orderId = UUID_RE.test(String(input.orderId ?? "")) ? input.orderId : null;
  if (!orderId) return { ok: false, message: "Nieprawidłowe zlecenie. Odśwież panel." };
  try {
    const serial = text(input.serialNo, SERVICE_ORDER_TEXT_MAX.serial);
    const kh = twId(input.clientKhId);
    const [clientOrders, serialOrders] = await Promise.all([
      kh ? fetchServiceOrdersByClient(kh, orderId) : Promise.resolve([]),
      serial ? fetchServiceOrdersBySerial(serial, orderId) : Promise.resolve([]),
    ]);
    let tickets: HelpdeskTicket[] = [];
    let helpdeskError: string | null = null;
    try {
      const terms = [serial, text(input.clientName, 80)].filter((t) => t.length >= 4);
      const found = await Promise.all(terms.map((t) => searchHelpdeskTickets(t)));
      const seen = new Set<number>(input.helpdeskId ? [input.helpdeskId] : []);
      for (const f of found) for (const t of f.tickets) if (!seen.has(t.id)) (seen.add(t.id), tickets.push(t));
      tickets = tickets.slice(0, 8);
    } catch (e) {
      helpdeskError = userFacingErrorText(e, "Helpdesk nie odpowiedział.");
    }
    return { ok: true, clientOrders, serialOrders: serialOrders.filter((x) => !clientOrders.some((c) => c.id === x.id)), tickets, helpdeskError };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać powiązanych spraw.") };
  }
}
