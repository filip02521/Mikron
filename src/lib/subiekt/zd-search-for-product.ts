import type { SubiektListParams } from "@/lib/subiekt/api";
import type { SubiektProduct } from "@/lib/subiekt/types";

const STOP_WORDS = new Set([
  "dla",
  "the",
  "and",
  "z",
  "do",
  "na",
  "w",
  "i",
  "or",
  "mm",
  "cm",
  "szt",
  "kpl",
  "kg",
  "ml",
]);

/** Tokeny z nazwy towaru do wyszukiwania ZD (API nie znajduje po samym symbolu numerycznym). */
export function zdSearchTokensFromProduct(product: SubiektProduct): string[] {
  const name = (product.tw_Nazwa ?? "").trim();
  const symbol = (product.tw_Symbol ?? "").trim();
  const tokens: string[] = [];

  const words = name
    .replace(/["„”]/g, " ")
    .split(/[\s,;/]+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/gi, ""))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length >= 2) {
    tokens.push(`${words[0]} ${words[1]}`);
  }

  const sortedWords = [...words].sort((a, b) => {
    const generic = (w: string) =>
      /^(viva|dental|pro|plus|max|mini|new)$/i.test(w) ? 1 : 0;
    const ga = generic(a);
    const gb = generic(b);
    if (ga !== gb) return ga - gb;
    return b.length - a.length;
  });
  for (const w of sortedWords) {
    tokens.push(w);
  }

  if (symbol && /[a-zA-Ząćęłńóśźż]/i.test(symbol) && symbol.length >= 3) {
    tokens.push(symbol);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 6);
}

/** Kolejne zapytania GET /documents/zd — tylko `search`, bez `name` (zwraca całą bazę). */
export function zdSearchPlansForProduct(
  product: SubiektProduct
): SubiektListParams[] {
  const tokens = zdSearchTokensFromProduct(product);
  if (!tokens.length) return [];

  return tokens.map((search) => ({
    search,
    pageSize: 25,
    page: 1,
  }));
}
