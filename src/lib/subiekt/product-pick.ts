import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import type { SubiektListParams } from "@/lib/subiekt/api";
import type { SubiektProduct } from "@/lib/subiekt/types";

export function subiektFieldText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v).trim();
  return String(v).trim();
}

function safeTrim(v: unknown): string {
  return subiektFieldText(v);
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

/** Normalizacja kodu Mikran (tw_PLU) — wiodące zera. */
export function normalizeSubiektPlu(value: unknown): string {
  const raw = subiektFieldText(value);
  if (/^\d+$/.test(raw)) return raw.replace(/^0+(?=\d)/, "");
  return raw;
}

/**
 * Wyniki wyszukiwania po tw_PLU w modalu ZD.
 * Najpierw dokładny PLU; gdy API zwróciło symbole numeryczne — zostaw je (inaczej „18080500” ginie).
 */
export function filterPluSuggestResultsForZdLookup(
  products: readonly SubiektProduct[],
  query: string
): SubiektProduct[] {
  const qn = normalizeSubiektPlu(query);
  const exact = products.filter((product) => normalizeSubiektPlu(product.tw_PLU) === qn);
  if (exact.length) return exact;

  const qLower = query.trim().toLowerCase();
  const bySymbol = products.filter((product) => {
    const sym = subiektFieldText(product.tw_Symbol).toLowerCase();
    return sym === qLower || sym.startsWith(`${qLower} `) || sym.startsWith(qLower);
  });
  if (bySymbol.length) return bySymbol;

  return [...products];
}

/** Typowe odmiany w nazwach towarów — API Subiekta nie znajduje np. „rapidu” zamiast „rapid”. */
const PRODUCT_NAME_QUERY_REWRITES: readonly [RegExp, string][] = [
  [/\brapidu\b/giu, "rapid"],
  [/\bmonomeru\b/giu, "monomer"],
  [/\bproszku\b/giu, "proszek"],
  [/\bżywicy\b/giu, "żywica"],
  [/\bfolii\b/giu, "folia"],
];

function pushUniqueProductNameQuery(variants: string[], value: string): void {
  const v = value.trim().replace(/\s+/g, " ");
  if (!v) return;
  if (variants.some((existing) => existing.toLowerCase() === v.toLowerCase())) return;
  variants.push(v);
}

/** Warianty frazy do wyszukiwania po nazwie (modal ZD, naturalny język). */
export function expandProductNameSearchQueries(query: string): string[] {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return [];

  const variants: string[] = [];
  pushUniqueProductNameQuery(variants, q);

  let rewritten = q;
  for (const [pattern, replacement] of PRODUCT_NAME_QUERY_REWRITES) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  pushUniqueProductNameQuery(variants, rewritten);

  const tokens = rewritten.split(" ").filter(Boolean);
  pushUniqueProductNameQuery(
    variants,
    tokens.filter((token) => token.length > 1 || /\d/u.test(token)).join(" ")
  );

  const volume = tokens.find((token) => /^\d+(?:[.,]\d+)?\s*(?:l|ml|g|kg)$/iu.test(token));
  const keywords = tokens.filter((token) => token.length > 2 && !/^\d/u.test(token));
  if (volume && keywords.length) {
    const main =
      keywords.find((token) =>
        /rapid|villacryl|erkoflex|formlabs|monomer|proszek|żywica/i.test(token)
      ) ?? keywords[keywords.length - 1]!;
    pushUniqueProductNameQuery(variants, `${main} ${volume}`);
  }

  return variants;
}

function productNameQueryTokens(query: string): string[] {
  return expandProductNameSearchQueries(query)
    .flatMap((variant) => variant.toLowerCase().split(/\s+/))
    .filter((token) => token.length > 1 || /\d/u.test(token));
}

/** Priorytet: dokładny symbol, potem PLU, na końcu warianty typu OUTLET+symbol. */
export function rankSubiektProductsForLookupQuery(
  products: readonly SubiektProduct[],
  query: string
): SubiektProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...products];
  const nameTokens = [...new Set(productNameQueryTokens(query))];

  const score = (product: SubiektProduct): number => {
    const symbol = subiektFieldText(product.tw_Symbol).toLowerCase();
    const plu = subiektFieldText(product.tw_PLU).toLowerCase();
    const name = subiektFieldText(product.tw_Nazwa).toLowerCase();
    let points = 0;
    if (symbol === q) points = Math.max(points, 100);
    if (symbol.startsWith(`${q} `) || symbol.startsWith(q)) points = Math.max(points, 90);
    if (plu === q || normalizeSubiektPlu(product.tw_PLU) === normalizeSubiektPlu(q)) {
      points = Math.max(points, 95);
    }
    if (symbol.endsWith(q) && symbol.length > q.length) points = Math.max(points, 40);
    if (symbol.includes(q)) points = Math.max(points, 30);
    if (name.includes(q)) points = Math.max(points, 60);
    if (nameTokens.length) {
      const matched = nameTokens.filter((token) => name.includes(token)).length;
      if (matched === nameTokens.length) points = Math.max(points, 70);
      else if (matched > 0) points = Math.max(points, 25 + matched * 10);
    }
    return points;
  };

  return [...products].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return subiektFieldText(a.tw_Symbol).localeCompare(subiektFieldText(b.tw_Symbol), "pl");
  });
}

/** W modalu lookup ZD: same cyfry → kod Mikran (PLU), inaczej symbol lub nazwa. */
export function inferProductZdLookupSearchField(
  query: string
): Exclude<ProductSearchField, "combined"> {
  const q = query.trim();
  if (/^\d{1,12}$/.test(q)) return "plu";
  return inferCombinedProductSearchField(q);
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
