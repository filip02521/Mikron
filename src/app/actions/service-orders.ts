"use server";

import { revalidatePath } from "next/cache";
import { requireServicePanel } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import {
  deleteServiceModelPart,
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
  normalizeRwNumber,
  SERVICE_ORDER_STATUS_LABEL,
  SERVICE_ORDER_TEXT_MAX,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";
import { parseDateOnly, toDateOnly } from "@/lib/orders/service-loaners";
import { normalizePurchaseDate, SERVICE_WARRANTY_MONTHS_MAX } from "@/lib/orders/service-warranty";
import { verifySubiektProduct, type VerifiedSubiektProduct } from "@/lib/subiekt/product-verify";
import { fetchClientEquipment, fetchClientRecentInvoices, type ClientRecentInvoice } from "@/lib/subiekt/client-equipment";
import { reportServicePartShortage } from "@/lib/data/service-part-report";
import type { ClientEquipmentItem } from "@/lib/subiekt/client-equipment-parse";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export type ServiceOrderActionResult = { ok: true; message: string; orderId?: string } | { ok: false; message: string };

const ORDERS_PATH = "/serwis/zlecenia";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = Object.keys(SERVICE_ORDER_STATUS_LABEL) as ServiceOrderStatus[];

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
}): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
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
      },
      actorOf(user)
    );
    return { message: `Przyjęto ${order.number}: ${deviceName} od ${clientName}.`, orderId: order.id };
  });
}

export async function actionMoveServiceOrder(input: { orderId: string; to: string; note?: string }): Promise<ServiceOrderActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const to = STATUSES.find((s) => s === input.to);
    if (!to) throw new ServiceOrderStateError("Nieznany status. Odśwież panel.");
    const note = text(input.note, 300);
    if (to === "anulowane" && !note) throw new ServiceOrderStateError("Wpisz powód anulowania (np. klient zrezygnował).");
    const o = await moveServiceOrder({ orderId: uuid(input.orderId, "zlecenie"), to, note }, actorOf(user));
    return { message: `${o.number}: ${SERVICE_ORDER_STATUS_LABEL[to]}.`, orderId: o.id };
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
