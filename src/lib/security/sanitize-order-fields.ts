import {
  MAX_PRODUCT_TEXT_LEN,
  MAX_QUANTITY_LEN,
  MAX_SYMBOL_LEN,
  clampText,
} from "@/lib/security/text-limits";

/** Obcina pola zgłoszenia zamówienia przed zapisem / walidacją biznesową. */
export function sanitizeOrderDraftFields(draft: {
  symbol?: string;
  product?: string;
  quantity?: string;
}): { symbol?: string; product?: string; quantity?: string } {
  return {
    symbol:
      draft.symbol !== undefined
        ? clampText(draft.symbol, MAX_SYMBOL_LEN)
        : undefined,
    product:
      draft.product !== undefined
        ? clampText(draft.product, MAX_PRODUCT_TEXT_LEN)
        : undefined,
    quantity:
      draft.quantity !== undefined
        ? clampText(draft.quantity, MAX_QUANTITY_LEN)
        : undefined,
  };
}
