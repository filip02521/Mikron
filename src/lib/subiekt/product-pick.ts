import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import type { SubiektListParams } from "@/lib/subiekt/api";
import type { SubiektProduct } from "@/lib/subiekt/types";

export type SubiektProductPick = {
  symbol: string;
  product: string;
  quantity: string;
  subiektTwId: number;
};

/** Czy fraza wygląda na symbol (krótki kod), a nie na nazwę towaru. */
export function looksLikeProductSymbol(query: string): boolean {
  const q = query.trim();
  if (q.length < 1 || q.length > 32) return false;
  if (/\s/.test(q)) return false;
  return /^[\p{L}\p{N}._\-/]+$/u.test(q);
}

/** Parametry wyszukiwania — nazwa vs symbol (API /products). */
export function productSearchParams(query: string): SubiektListParams {
  const q = query.trim();
  if (looksLikeProductSymbol(q)) {
    return { search: q, symbol: q, pageSize: 12, page: 1 };
  }
  return { search: q, name: q, pageSize: 12, page: 1 };
}

/** Uzupełnia pola linii prośby po wyborze z Subiekta (zamówienie i informacja). */
export function buildProductPickFromSubiekt(
  p: SubiektProduct,
  requestKind: IndividualRequestKind,
  existingQuantity = ""
): SubiektProductPick {
  const sym = (p.tw_Symbol ?? "").trim();
  const name = (p.tw_Nazwa ?? "").trim();
  const symbol = sym || "-";
  const product = name || sym || "";

  const subiektTwId = p.tw_Id;

  if (requestKind === "informacja") {
    return { symbol, product, quantity: "", subiektTwId };
  }

  const prev = existingQuantity.trim();
  const quantity =
    prev && parseOrderQuantity(prev) !== null ? prev : "1";

  return { symbol, product, quantity, subiektTwId };
}

export function formatSubiektProductOption(p: SubiektProduct): {
  title: string;
  subtitle: string;
} {
  const sym = (p.tw_Symbol ?? "").trim();
  const name = (p.tw_Nazwa ?? "").trim();
  if (sym && name) {
    return { title: name, subtitle: `Symbol: ${sym}` };
  }
  return {
    title: name || sym || "—",
    subtitle: name ? (sym ? `Symbol: ${sym}` : "Bez symbolu") : "Bez nazwy w kartotece",
  };
}
