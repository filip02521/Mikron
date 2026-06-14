import type { IndividualOrder } from "@/types/database";
import { polishPozycjeLabel } from "@/lib/email/polish-plural";

/** Ile unikalnych handlowców jest w podanych pozycjach. */
export function countSalesPeopleInOrders(
  orders: IndividualOrder[],
  orderIds: string[]
): number {
  const ids = new Set<string>();
  for (const id of orderIds) {
    const order = orders.find((o) => o.id === id);
    if (order?.sales_person_id) ids.add(order.sales_person_id);
  }
  return ids.size;
}

function handlowiecLabel(count: number): string {
  if (count === 1) return "1 handlowiec";
  return `${count} handlowców`;
}

/** Etykieta przycisku zbiorczego (dostawa / informacja). */
export function batchNotifyButtonLabel(
  orders: IndividualOrder[],
  orderIds: string[],
  opts?: { prefix?: string; unit?: "pozycja" | "osoba" }
): string {
  const prefix = opts?.prefix ?? "Grupa";
  const unit = opts?.unit ?? "pozycja";
  const n = orderIds.length;
  const people = countSalesPeopleInOrders(orders, orderIds);
  const countLabel =
    unit === "osoba" ? `${n} ${n === 1 ? "osoba" : n < 5 ? "osoby" : "osób"}` : `${n}`;
  if (n <= 1) return prefix;
  if (people <= 1) {
    return unit === "osoba"
      ? `${prefix} — ${countLabel} · mail do handlowca`
      : `${prefix} (${n}) · mail do handlowca`;
  }
  return unit === "osoba"
    ? `${prefix} — ${countLabel} · ${handlowiecLabel(people)}`
    : `${prefix} (${n}) · ${handlowiecLabel(people)}`;
}

export function selectedSaveButtonLabel(selectedCount: number): string {
  if (selectedCount <= 1) return "Zapisz zaznaczone";
  return `Zapisz zaznaczone (${selectedCount})`;
}

/** Czy akcja w magazynie wymaga potwierdzenia (grupowa / wielu odbiorców). */
export function requiresQueueBatchConfirm(orderIds: string[]): boolean {
  return orderIds.length > 1;
}

/** Treść modala przed zbiorczym zapisem dostawy w kolejce. */
export function batchDeliveryConfirmMessage(
  orders: IndividualOrder[],
  orderIds: string[],
  opts?: { fullQuantity?: boolean }
): string {
  const n = orderIds.length;
  const people = countSalesPeopleInOrders(orders, orderIds);
  const emailPart =
    people <= 1
      ? "Handlowiec dostanie e-mail o przyjęciu towaru."
      : `${people} handlowców dostanie osobne e-maile o przyjęciu towaru.`;
  const qtyPart = opts?.fullQuantity
    ? "Dla każdej pozycji zostanie zapisana pełna zamówiona ilość (Całość)."
    : "Zostanie zapisana ilość z kolumny „Dost.” dla każdej zaznaczonej pozycji.";
  return `Zapiszesz dostawę dla ${polishPozycjeLabel(n)}. ${qtyPart} ${emailPart} Sprawdź zaznaczenie — błędny zapis utrudni późniejszą korektę.`;
}

/** Treść modala przed zbiorczym powiadomieniem informacyjnym. */
export function batchInformacjaConfirmMessage(
  orders: IndividualOrder[],
  orderIds: string[]
): string {
  const n = orderIds.length;
  const people = countSalesPeopleInOrders(orders, orderIds);
  const emailPart =
    people <= 1
      ? "Handlowiec dostanie e-mail, że towar jest na magazynie."
      : `${people} handlowców dostanie osobne e-maile, że towar jest na magazynie.`;
  return `Wyślesz powiadomienie dla ${polishPozycjeLabel(n)}. ${emailPart} Sprawdź listę — po wysłaniu trzeba będzie ręcznie wyjaśniać ewentualne pomyłki.`;
}

export type BatchOperationToast = {
  text: string;
  tone: "success" | "error";
  /** Dłuższy toast gdy zapis OK, ale mail do handlowca nie poszedł. */
  durationMs?: number;
};

export const QUEUE_EMAIL_WARNING_TOAST_MS = 15_000;

function withEmailWarningDuration(toast: BatchOperationToast): BatchOperationToast {
  if (toast.tone !== "error" || !/e-mail|mail/i.test(toast.text)) return toast;
  return { ...toast, durationMs: QUEUE_EMAIL_WARNING_TOAST_MS };
}

/** Spójny komunikat po zbiorczym zapisie dostaw. */
export function formatDeliveryBatchToast(result: {
  saved: number;
  emailSent: number;
  errors: string[];
  emailError?: string;
}): BatchOperationToast {
  const partial = result.errors.length > 0;
  const emailPart = result.emailError
    ? ` Uwaga e-mail: ${result.emailError}`
    : result.emailSent === 0
      ? ""
      : result.emailSent === 1
        ? " · wysłano mail do handlowca"
        : ` · wysłano ${result.emailSent} maile (po handlowcu)`;
  const errPart = partial
    ? ` Uwagi (${result.errors.length}): ${result.errors.slice(0, 2).join("; ")}${result.errors.length > 2 ? "…" : ""}`
    : "";

  return withEmailWarningDuration({
    text: `Zapisano ${polishPozycjeLabel(result.saved)}${emailPart}${errPart}`,
    tone: partial || result.emailError ? "error" : "success",
  });
}

/** Spójny komunikat po zbiorczym powiadomieniu informacyjnym. */
export function formatInformacjaBatchToast(result: {
  updated: number;
  skipped?: number;
  requested?: number;
  emailSent: number;
  emailError?: string;
}): BatchOperationToast {
  const emailPart = result.emailError
    ? ` Uwaga: ${result.emailError}`
    : result.emailSent === 0
      ? ""
      : result.emailSent === 1
        ? " · wysłano mail"
        : ` · wysłano ${result.emailSent} maile (po handlowcu)`;
  const skipPart =
    result.skipped && result.skipped > 0
      ? ` · ${result.skipped} pominięto (już zamknięte lub nieaktualne)`
      : "";

  const partialSkip = (result.skipped ?? 0) > 0;

  return withEmailWarningDuration({
    text: `Powiadomiono: ${polishPozycjeLabel(result.updated)}${emailPart}${skipPart}`,
    tone: result.emailError || partialSkip ? "error" : "success",
  });
}
