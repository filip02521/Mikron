import type { SubiektListParams } from "@/lib/subiekt/api";
import { defaultZdSearchDataOd } from "@/lib/subiekt/subiekt-runtime-cache";
import { parseSubiektKhId } from "@/lib/subiekt/parse-kh-id";
import { dedupeAppSuppliersByKhId } from "@/lib/subiekt/dedupe-suppliers-by-kh";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
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

/** Marka z prefiksu nazwy (np. „Renfert-Waxlectric …” → „Renfert”) — API ZD nie znajduje po całym łączniku. */
export function brandTokensFromProductName(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const beforeHyphen = trimmed.split("-")[0]?.trim();
  if (beforeHyphen && beforeHyphen.length >= 3 && !STOP_WORDS.has(beforeHyphen.toLowerCase())) {
    out.push(beforeHyphen);
  }

  const firstWord = trimmed
    .split(/[\s,;/]+/)[0]
    ?.replace(/^[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/gi, "")
    .trim();
  if (
    firstWord &&
    firstWord.length >= 3 &&
    !STOP_WORDS.has(firstWord.toLowerCase()) &&
    firstWord.toLowerCase() !== beforeHyphen?.toLowerCase()
  ) {
    out.push(firstWord);
  }

  return out;
}

/** Tokeny z nazwy towaru do wyszukiwania ZD (API nie znajduje po samym symbolu numerycznym). */
export function zdSearchTokensFromProduct(
  product: SubiektProduct,
  maxTokens = 6
): string[] {
  const name = (product.tw_Nazwa ?? "").trim();
  const symbol = (product.tw_Symbol ?? "").trim();
  const tokens: string[] = [];

  for (const brand of brandTokensFromProductName(name)) {
    tokens.push(brand);
  }

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
  return out.slice(0, maxTokens);
}

const ZD_ORDER_SEARCH_MAX_TOKENS = 3;

/** Kolejne zapytania GET /documents/zd — tylko `search`, bez `name` (zwraca całą bazę). */
export function zdSearchPlansForProduct(
  product: SubiektProduct,
  options?: { maxTokens?: number; pageSize?: number }
): SubiektListParams[] {
  const maxTokens = options?.maxTokens ?? 6;
  const pageSize = options?.pageSize ?? 25;
  const tokens = zdSearchTokensFromProduct(product, maxTokens);
  if (!tokens.length) return [];

  return tokens.map((search) => ({
    search,
    pageSize,
    page: 1,
  }));
}

function dedupeZdSearchPlans(plans: SubiektListParams[]): SubiektListParams[] {
  const dataOd = defaultZdSearchDataOd();
  const seen = new Set<string>();
  const out: SubiektListParams[] = [];
  for (const plan of plans) {
    const key = `${plan.search ?? ""}|${plan.khId ?? ""}|${plan.dataOd ?? dataOd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...plan, dataOd: plan.dataOd ?? dataOd });
  }
  return out;
}

/**
 * Plany ZD przy wyborze towaru — najpierw marka + powiązani kontrahenci (np. Renfert + kh_Id),
 * potem ogólne frazy z nazwy.
 */
export function zdSearchPlansForProductSupplierLookup(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): SubiektListParams[] {
  const dataOd = defaultZdSearchDataOd();
  const tokens = zdSearchTokensFromProduct(product, 8);
  const scopedSuppliers = dedupeAppSuppliersByKhId(appSuppliers);
  const linkedKhIds = [
    ...new Set(
      scopedSuppliers
        .map((s) => parseSubiektKhId(s.subiektKhId))
        .filter((id): id is number => id != null)
    ),
  ];

  const plans: SubiektListParams[] = [];
  const brandTokens = brandTokensFromProductName(product.tw_Nazwa ?? "");

  for (const brand of brandTokens) {
    for (const khId of linkedKhIds) {
      plans.push({ search: brand, khId, dataOd, pageSize: 25, page: 1 });
    }
  }

  for (const search of tokens) {
    for (const khId of linkedKhIds) {
      plans.push({ search, khId, dataOd, pageSize: 25, page: 1 });
    }
    plans.push({ search, dataOd, pageSize: 25, page: 1 });
  }

  return dedupeZdSearchPlans(plans);
}

function withKhId(
  plans: SubiektListParams[],
  subiektKhId?: number | null
): SubiektListParams[] {
  const khId = parseSubiektKhId(subiektKhId);
  if (khId == null) return plans;
  return plans.map((plan) => ({ ...plan, khId }));
}

/** Plany wyszukiwania ZD dla prośby z listy Moje zamówienia (symbol, nazwa, opcj. tw_Id). */
export function zdSearchPlansForOrderInput(input: {
  symbol: string;
  products: string;
  subiekt_tw_id?: number | null;
  subiekt_kh_id?: number | null;
}): SubiektListParams[] {
  const symbol = (input.symbol ?? "").trim();
  const products = (input.products ?? "").trim();

  const listOpts = { maxTokens: ZD_ORDER_SEARCH_MAX_TOKENS, pageSize: 12 };

  const fromProduct = zdSearchPlansForProduct(
    {
      tw_Id:
        typeof input.subiekt_tw_id === "number" && input.subiekt_tw_id > 0
          ? input.subiekt_tw_id
          : 0,
      tw_Symbol: symbol,
      tw_Nazwa: products,
    },
    listOpts
  );
  if (fromProduct.length) return withKhId(fromProduct, input.subiekt_kh_id);

  if (symbol && symbol !== "-") {
    return withKhId(
      [{ search: symbol, pageSize: listOpts.pageSize, page: 1 }],
      input.subiekt_kh_id
    );
  }
  if (products && products !== "Do uzupełnienia") {
    return withKhId(
      [{ search: products.slice(0, 48), pageSize: listOpts.pageSize, page: 1 }],
      input.subiekt_kh_id
    );
  }
  return [];
}
