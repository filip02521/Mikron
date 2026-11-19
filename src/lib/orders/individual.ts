import type { IndividualOrderStatus, IndividualRequestKind } from "@/types/database";
import { formatContactHref } from "@/lib/orders/supplier-contact";
import { plKlapka } from "@/lib/ui/polish-plurals";

/**
 * Jednostka ilości pozycji: zęby tylko w całych klapkach (1 klapka / 2 klapki / 5 klapek),
 * reszta towaru w sztukach.
 */
export function orderUnit(count: number, isTeeth?: boolean | null): string {
  return isTeeth ? plKlapka(count) : "szt.";
}

/** Po „z” (dopełniacz): „2 z 5 szt.”, „0 z 1 klapki”, „2 z 3 klapek”. */
export function orderUnitGenitive(count: number, isTeeth?: boolean | null): string {
  if (!isTeeth) return "szt.";
  return Math.abs(Math.trunc(count)) === 1 ? "klapki" : "klapek";
}

export function isInformacjaRequest(order: {
  request_kind?: IndividualRequestKind | null;
}): boolean {
  return order.request_kind === "informacja";
}

/** Pozycje informacyjne nie mają ilości — tylko „czy jest na stanie”. */
export const INFORMACJA_NO_QUANTITY = "-";

/** Etykieta ilości w UI (panel, kolejka, Moje). */
export function formatOrderQuantityLabel(
  quantity?: string | null,
  requestKind?: IndividualRequestKind | null
): string {
  if (requestKind === "informacja") return "-";
  const t = quantity?.trim();
  if (!t || t === INFORMACJA_NO_QUANTITY) return "-";
  return t;
}

export function quantityForRequestKind(
  requestKind: IndividualRequestKind | undefined,
  quantity?: string
): string {
  if (requestKind === "informacja") return INFORMACJA_NO_QUANTITY;
  const q = quantity?.trim();
  return q ? q : INFORMACJA_NO_QUANTITY;
}

export function parseOrderQuantity(quantity: string): number | null {
  const n = parseInt(quantity, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type DeliveryProgress = {
  ordered: number | null;
  delivered: number;
  remaining: number | null;
  fractionLabel: string;
  hasNumericQty: boolean;
  /** Pozycja zębowa — ilość w klapkach. */
  isTeeth: boolean;
};

export function getDeliveryProgress(
  orderedQuantity: string,
  deliveredQuantity: string,
  isTeeth = false
): DeliveryProgress {
  const ordered = parseOrderQuantity(orderedQuantity);
  const deliveredRaw = parseInt(deliveredQuantity, 10);
  const delivered =
    Number.isFinite(deliveredRaw) && deliveredRaw >= 0 ? deliveredRaw : 0;

  if (ordered == null) {
    return {
      ordered: null,
      delivered,
      remaining: null,
      fractionLabel: delivered > 0 ? `${delivered} dost.` : "-",
      hasNumericQty: false,
      isTeeth,
    };
  }

  const remaining = Math.max(0, ordered - delivered);
  return {
    ordered,
    delivered,
    remaining,
    fractionLabel: `${delivered}/${ordered} ${orderUnit(ordered, isTeeth)}`,
    hasNumericQty: true,
    isTeeth,
  };
}

export type OrderFulfillmentProgress = DeliveryProgress & {
  /** Wycofane sztuki (0 gdy brak rezygnacji). */
  cancelled: number;
  /** Aktywne zamówienie = ordered − cancelled. */
  activeOrdered: number | null;
  /** Szacunek brakujących u dostawcy = activeOrdered − delivered. */
  supplierRemaining: number | null;
};

export function getOrderFulfillmentProgress(
  orderedQuantity: string,
  deliveredQuantity: string,
  cancelledQuantity?: string | null,
  isTeeth = false
): OrderFulfillmentProgress {
  const base = getDeliveryProgress(orderedQuantity, deliveredQuantity, isTeeth);
  const cancelledRaw = parseOrderQuantity(cancelledQuantity ?? "");
  const cancelled = cancelledRaw ?? 0;

  if (!base.hasNumericQty || base.ordered == null) {
    return {
      ...base,
      cancelled,
      activeOrdered: null,
      supplierRemaining: null,
    };
  }

  const activeOrdered = Math.max(0, base.ordered - cancelled);
  const supplierRemaining = Math.max(0, activeOrdered - base.delivered);

  let fractionLabel = base.fractionLabel;
  if (cancelled > 0) {
    if (base.delivered > 0) {
      fractionLabel = `${base.delivered} na magazynie · ${cancelled} wycofane z ${base.ordered} ${orderUnitGenitive(base.ordered, isTeeth)}`;
    } else {
      fractionLabel = `${activeOrdered} z ${base.ordered} ${orderUnitGenitive(base.ordered, isTeeth)} · ${cancelled} wycofane`;
    }
  }

  return {
    ...base,
    cancelled,
    activeOrdered,
    supplierRemaining,
    fractionLabel,
  };
}

export const INDIVIDUAL_STATUS_LABELS: Record<IndividualOrderStatus, string> = {
  Nowe: "Nowe",
  Weryfikacja: "Weryfikacja danych",
  Zamowione: "Oczekuje na dostawę",
  Czesciowo_zrealizowane: "Częściowo zrealizowane",
  Zrealizowane: "Zrealizowane",
  Anulowane: "Anulowane",
};

export function resolveStatusFromDeliveredQuantity(
  orderedQuantity: string,
  deliveredQuantity: string
): IndividualOrderStatus {
  const ordered = parseInt(orderedQuantity, 10);
  const delivered = parseInt(deliveredQuantity, 10);
  if (isNaN(delivered) || delivered < 0) return "Zamowione";
  if (isNaN(ordered)) {
    return delivered > 0 ? "Zrealizowane" : "Zamowione";
  }
  if (delivered === 0) return "Zamowione";
  if (delivered >= ordered) return "Zrealizowane";
  return "Czesciowo_zrealizowane";
}

export function isMissingProduct(product: string): boolean {
  const lower = product.toLowerCase().trim();
  const keywords = [
    "brak",
    "nie ma",
    "niedostępny",
    "wyprzedany",
    "brakuje",
    "brak na magazynie",
  ];
  return keywords.some((k) => lower.includes(k));
}

/** Zgodne z buildSupplierContactUi — jeden parser kontaktu. */
export function formatContactNote(
  note: string,
  contact: string,
  extraInfo?: string
): string {
  return formatContactHref(note, contact, extraInfo);
}
