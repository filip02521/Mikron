import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import type { SubiektListParams } from "@/lib/subiekt/api";
import type { SubiektProduct } from "@/lib/subiekt/types";

function safeTrim(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v).trim();
  return String(v).trim();
}

export type SubiektProductPick = {
  symbol: string;
  product: string;
  quantity: string;
  subiektTwId: number;
  mikranCode: string;
};

export type ProductSearchField = "symbol" | "plu" | "name";

/** Minimalna długość frazy — PLU może być jednocyfrowe (np. 1). */
export function minProductSearchLength(field: ProductSearchField): number {
  return field === "plu" ? 1 : 2;
}

/** Czy fraza wygląda na symbol (krótki kod), a nie na nazwę towaru. */
export function looksLikeProductSymbol(query: string): boolean {
  const q = query.trim();
  if (q.length < 1 || q.length > 32) return false;
  if (/\s/.test(q)) return false;
  return /^[\p{L}\p{N}._\-/]+$/u.test(q);
}

/** Parametry wyszukiwania — symbol, Kod Mikran (PLU) lub nazwa. */
export function productSearchParams(
  query: string,
  field?: ProductSearchField
): SubiektListParams {
  const q = query.trim();
  const base = { search: q, pageSize: 12, page: 1 };

  if (field === "plu") {
    // Subiekt bywa tak skonfigurowany, że bez `search` endpoint nic nie zwraca.
    // Zawężenie do faktycznego tw_PLU robimy po stronie aplikacji (actions/subiekt.ts).
    return { ...base, plu: q };
  }
  if (field === "symbol") {
    return { ...base, symbol: q };
  }
  if (field === "name") {
    return { ...base, name: q };
  }

  if (looksLikeProductSymbol(q)) {
    return { ...base, symbol: q };
  }
  return { ...base, name: q };
}

/** Uzupełnia pola linii prośby po wyborze z Subiekta (zamówienie i informacja). */
export function buildProductPickFromSubiekt(
  p: SubiektProduct,
  requestKind: IndividualRequestKind,
  existingQuantity = ""
): SubiektProductPick {
  const sym = safeTrim(p.tw_Symbol);
  const name = safeTrim(p.tw_Nazwa);
  const plu = safeTrim(p.tw_PLU);
  const symbol = sym || "-";
  const product = name || sym || "";
  const mikranCode = plu;

  const subiektTwId = p.tw_Id;

  if (requestKind === "informacja") {
    return { symbol, product, quantity: "", subiektTwId, mikranCode };
  }

  const prev = existingQuantity.trim();
  const quantity =
    prev && parseOrderQuantity(prev) !== null ? prev : "1";

  return { symbol, product, quantity, subiektTwId, mikranCode };
}

export function formatSubiektProductOption(p: SubiektProduct): {
  title: string;
  subtitle: string;
} {
  const sym = safeTrim(p.tw_Symbol);
  const name = safeTrim(p.tw_Nazwa);
  const plu = safeTrim(p.tw_PLU);
  const parts = [
    sym ? `Symbol: ${sym}` : null,
    plu ? `Kod Mikran: ${plu}` : null,
  ].filter(Boolean);

  if (name) {
    return {
      title: name,
      subtitle: parts.length ? parts.join(" · ") : "Bez symbolu i kodu",
    };
  }
  return {
    title: sym || plu || "—",
    subtitle: parts.length ? parts.join(" · ") : "Bez nazwy w kartotece",
  };
}
