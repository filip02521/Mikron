import type { IndividualOrderStatus, IndividualRequestKind } from "@/types/database";
import { formatContactHref } from "@/lib/orders/supplier-contact";

export function isInformacjaRequest(order: {
  request_kind?: IndividualRequestKind | null;
}): boolean {
  return order.request_kind === "informacja";
}

/** Pozycje informacyjne nie mają ilości — tylko „czy jest na stanie”. */
export const INFORMACJA_NO_QUANTITY = "-";

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
};

export function getDeliveryProgress(
  orderedQuantity: string,
  deliveredQuantity: string
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
      fractionLabel: delivered > 0 ? `${delivered} dost.` : "—",
      hasNumericQty: false,
    };
  }

  const remaining = Math.max(0, ordered - delivered);
  return {
    ordered,
    delivered,
    remaining,
    fractionLabel: `${delivered}/${ordered} szt.`,
    hasNumericQty: true,
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
