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

export type ProductSearchField = "symbol" | "plu" | "name" | "combined";

/** Pole wyszukiwania API dla aktywnego inputu (scalony produkt → combined). */
export function productSuggestSearchField(
  activeField: Exclude<ProductSearchField, "combined">
): ProductSearchField {
  return activeField === "plu" ? "plu" : "combined";
}

/** Scalone pole produktu — równoległe wyszukiwanie po symbolu i nazwie. */
export function isCombinedProductSearchField(
  field: ProductSearchField
): field is "combined" {
  return field === "combined";
}

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

/** Łączy wyniki wyszukiwań Subiekta (kolejność batchy = priorytet). */
export function mergeSubiektProductSearchResults(
  batches: SubiektProduct[][],
  limit = 12
): SubiektProduct[] {
  const out: SubiektProduct[] = [];
  const seen = new Set<number>();

  for (const batch of batches) {
    for (const product of batch) {
      const id = product.tw_Id;
      if (id == null || !Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(product);
      if (out.length >= limit) return out;
    }
  }

  return out;
}

/** Pole Subiekta dla scalonego wyszukiwania (symbol vs nazwa). */
export function inferCombinedProductSearchField(
  query: string
): Exclude<ProductSearchField, "plu" | "combined"> {
  const q = query.trim();
  if (!q) return "name";
  if (!looksLikeProductSymbol(q)) return "name";
  const hasLower = /[a-ząćęłńóśźż]/u.test(q);
  if (hasLower && !/\d/.test(q)) return "name";
  if (q.length > 14) return "name";
  return "symbol";
}

/** Wartość w jednym polu „produkt” (nazwa ma pierwszeństwo). */
export function combinedProductSearchDisplay(value: {
  symbol: string;
  product: string;
}): string {
  const product = value.product.trim();
  const symbol = value.symbol.trim();
  if (product) return value.product;
  if (symbol && symbol !== "-") return value.symbol;
  return "";
}

/** Podgląd symbolu pod polem, gdy w inpucie widać głównie nazwę. */
export function combinedProductSymbolPreview(value: {
  symbol: string;
  product: string;
}): string | null {
  const symbol = value.symbol.trim();
  if (!symbol || symbol === "-") return null;
  const display = combinedProductSearchDisplay(value).trim();
  if (!display || display === symbol) return null;
  return symbol;
}

/** Rozpoznaje wklejkę z listy Subiekta: „SYMBOL — Nazwa”. */
function parseSubiektPasteLabel(query: string): Pick<SubiektProductPick, "symbol" | "product"> | null {
  const m = query.trim().match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (!m) return null;
  const symbol = m[1]!.trim();
  const product = m[2]!.trim();
  if (!symbol || !product) return null;
  return { symbol, product };
}

/** Aktualizacja modelu po wpisie w scalonym polu (bez PLU). */
export function patchFromCombinedProductInput(
  query: string,
  previous?: { symbol: string; product: string }
): Pick<SubiektProductPick, "symbol" | "product"> {
  if (!query.trim()) {
    return { symbol: "", product: "" };
  }

  const pasted = parseSubiektPasteLabel(query);
  if (pasted) return pasted;

  const field = inferCombinedProductSearchField(query);
  if (field === "symbol") {
    return { symbol: query, product: "" };
  }

  const prevDisplay = previous
    ? combinedProductSearchDisplay(previous)
    : "";
  const prevField = prevDisplay.trim()
    ? inferCombinedProductSearchField(prevDisplay)
    : "name";
  const prevSymbol = previous?.symbol?.trim() ?? "";
  const extendingSymbol =
    prevField === "symbol" &&
    Boolean(prevSymbol) &&
    prevSymbol !== "-" &&
    query.trim().toLowerCase().startsWith(prevSymbol.toLowerCase());
  const keepSymbol =
    extendingSymbol ||
    (prevField === "name" &&
      Boolean(previous?.product?.trim()) &&
      Boolean(prevSymbol) &&
      prevSymbol !== "-");

  return {
    product: query,
    symbol: keepSymbol ? previous!.symbol : "",
  };
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
      title: sym ? `${sym} — ${name}` : name,
      subtitle: parts.length ? parts.join(" · ") : "Bez symbolu i kodu",
    };
  }
  return {
    title: sym || plu || "—",
    subtitle: parts.length ? parts.join(" · ") : "Bez nazwy w kartotece",
  };
}
