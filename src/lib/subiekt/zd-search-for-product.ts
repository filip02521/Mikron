import type { SubiektListParams } from "@/lib/subiekt/api";
import {
  zdContractorInitialDataOd,
  zdContractorRecentDataOd,
  zdPlacementListWindowForApi,
  zdProductSearchDataOd,
} from "@/lib/subiekt/zd-search-scope";
import { parseSubiektKhId } from "@/lib/subiekt/parse-kh-id";
import { collectKhIdsForSupplierRef } from "@/lib/data/supplier-subiekt-kh";
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

/** Kod alfanumeryczny z końca nazwy (np. „Komet węglik H364RNF” → H364RNF). */
export function extractAlphanumericProductCodeFromName(name: string): string {
  const tokens = name
    .trim()
    .split(/[\s,;/]+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/gi, ""))
    .filter(Boolean);

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!;
    if (
      token.length >= 4 &&
      token.length <= 32 &&
      /[a-zA-Ząćęłńóśźż]/i.test(token) &&
      /\d/.test(token)
    ) {
      return token;
    }
  }
  return "";
}

/** Symbol do wyszukiwania ZD — tw_Symbol albo kod wyciągnięty z nazwy. */
export function effectiveProductSymbol(product: SubiektProduct): string {
  const sym = (product.tw_Symbol ?? "").trim();
  if (sym && sym !== "-") {
    const hasLetters = /[a-zA-Ząćęłńóśźż]/i.test(sym);
    const isLongNumeric = /^\d{6,}$/.test(sym);
    if (hasLetters || isLongNumeric) return sym;
  }
  const name = (product.tw_Nazwa ?? "").trim();
  const fromName = name.match(/\b(\d{6,})\b/g);
  if (fromName?.length) return fromName[fromName.length - 1]!;
  const alnum = extractAlphanumericProductCodeFromName(name);
  if (alnum) return alnum;
  return sym && sym !== "-" ? sym : "";
}

/** Marka z prefiksu nazwy (np. „Renfert-Waxlectric …” → „Renfert”) — API ZD nie znajduje po całym łączniku. */
export function brandTokensFromProductName(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  let beforeHyphen: string | undefined;
  if (trimmed.includes("-")) {
    beforeHyphen = trimmed.split("-")[0]?.trim();
    if (beforeHyphen && beforeHyphen.length >= 3 && !STOP_WORDS.has(beforeHyphen.toLowerCase())) {
      out.push(beforeHyphen);
    }
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

/** Tokeny do wyszukiwania ZD (marka/nazwa + czasem symbol). */
export function zdSearchTokensFromProduct(
  product: SubiektProduct,
  maxTokens = 6
): string[] {
  const name = (product.tw_Nazwa ?? "").trim();
  const symbol = effectiveProductSymbol(product);
  const tokens: string[] = [];

  // Symbol jako token bywa kluczowy przy dopasowaniu dostawcy (szczególnie numeryczne kody).
  // Musi mieć wysoką priorytetyzację, bo lista tokenów jest ucinana do `maxTokens`.
  let symbolToken: string | null = null;
  if (symbol && symbol.length >= 3) {
    const hasLetters = /[a-zA-Ząćęłńóśźż]/i.test(symbol);
    const isNumeric = /^\d+$/.test(symbol);
    if (hasLetters || (isNumeric && symbol.length >= 6)) {
      symbolToken = symbol;
    }
  }

  for (const brand of brandTokensFromProductName(name)) {
    tokens.push(brand);
  }
  if (symbolToken) tokens.push(symbolToken);

  const words = name
    .replace(/["„”]/g, " ")
    // ZD search lepiej działa na “gołych” tokenach niż na ciągach typu "MT3+tarcza".
    .replace(/[+\-/]/g, " ")
    .split(/[\s,;]+/)
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

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  if (!symbolToken) return out.slice(0, maxTokens);

  // Gwarancja: jeśli zdecydowaliśmy, że symbol jest istotny, nie może wypaść przez limit.
  const limited = out.slice(0, maxTokens);
  if (limited.some((t) => t.toLowerCase() === symbolToken.toLowerCase())) return limited;
  // Podmień ostatni token, zachowując priorytet wcześniejszych.
  if (limited.length === 0) return [symbolToken];
  return [...limited.slice(0, Math.max(0, maxTokens - 1)), symbolToken];
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
  const dataOd = zdProductSearchDataOd();
  const seen = new Set<string>();
  const out: SubiektListParams[] = [];
  for (const plan of plans) {
    const key = `${plan.search ?? ""}|${plan.symbol ?? ""}|${plan.khId ?? ""}|${plan.dataOd ?? dataOd}`;
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
  const dataOd = zdContractorRecentDataOd();
  const tokens = zdSearchTokensFromProduct(product, 8);
  const scopedSuppliers = dedupeAppSuppliersByKhId(appSuppliers);
  const linkedKhIds = [
    ...new Set(
      scopedSuppliers.flatMap((s) => collectKhIdsForSupplierRef(s))
    ),
  ];

  const plans: SubiektListParams[] = [];
  const brandTokens = brandTokensFromProductName(product.tw_Nazwa ?? "");
  const symbol = effectiveProductSymbol(product);

  if (symbol.length >= 3) {
    plans.push({ symbol, dataOd, pageSize: 25, page: 1 });
    for (const khId of linkedKhIds) {
      plans.push({ symbol, khId, dataOd, pageSize: 25, page: 1 });
    }
  }

  for (const brand of brandTokens) {
    for (const khId of linkedKhIds) {
      plans.push({ search: brand, khId, dataOd, pageSize: 25, page: 1 });
    }
    plans.push({ search: brand, dataOd, pageSize: 25, page: 1 });
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

function orderInputAsProduct(input: {
  symbol: string;
  products: string;
  subiekt_tw_id?: number | null;
}): SubiektProduct {
  return {
    tw_Id:
      typeof input.subiekt_tw_id === "number" && input.subiekt_tw_id > 0
        ? input.subiekt_tw_id
        : 0,
    tw_Symbol: input.symbol,
    tw_Nazwa: input.products,
  };
}

/** Plany wyszukiwania ZD dla prośby z listy Moje zamówienia (symbol, nazwa, opcj. tw_Id). */
export function zdSearchPlansForOrderInput(input: {
  symbol: string;
  products: string;
  subiekt_tw_id?: number | null;
  subiekt_kh_id?: number | null;
  /** Data zamówienia / zgłoszenia — poszerza dataOd wstecz (np. prośba z lutego). */
  placementAt?: string | null;
}): SubiektListParams[] {
  const symbol = (input.symbol ?? "").trim();
  const products = (input.products ?? "").trim();
  const listWindow = input.placementAt?.trim()
    ? zdPlacementListWindowForApi(input.placementAt)
    : { dataOd: zdContractorInitialDataOd() };
  const dataOd = listWindow.dataOd;
  const dataDo = listWindow.dataDo;
  const listOpts = { maxTokens: ZD_ORDER_SEARCH_MAX_TOKENS, pageSize: 12 };
  const product = orderInputAsProduct({ symbol, products, subiekt_tw_id: input.subiekt_tw_id });
  const effectiveSymbol = effectiveProductSymbol(product);
  const plans: SubiektListParams[] = [];

  const withDateWindow = (plan: SubiektListParams): SubiektListParams => ({
    ...plan,
    dataOd,
    ...(dataDo ? { dataDo } : {}),
  });

  const orderTwId = Math.trunc(Number(input.subiekt_tw_id));
  if (Number.isFinite(orderTwId) && orderTwId > 0) {
    plans.push(
      withDateWindow({
        id: orderTwId,
        pageSize: 25,
        page: 1,
      })
    );
  }

  // Symbol pierwszy — precyzyjniejszy niż marka z nazwy (np. H364RNF przy symbol „-”).
  if (effectiveSymbol.length >= 3) {
    plans.push(
      withDateWindow({
        symbol: effectiveSymbol,
        pageSize: listOpts.pageSize,
        page: 1,
      })
    );
  }

  const effectiveLower = effectiveSymbol.toLowerCase();
  for (const plan of zdSearchPlansForProduct(product, listOpts)) {
    const search = plan.search?.trim();
    if (search && effectiveLower && search.toLowerCase() === effectiveLower) continue;
    plans.push(withDateWindow(plan));
  }

  if (!plans.length) {
    if (symbol && symbol !== "-") {
      plans.push(
        withDateWindow({ search: symbol, pageSize: listOpts.pageSize, page: 1 })
      );
    } else if (products && products !== "Do uzupełnienia") {
      plans.push(
        withDateWindow({
          search: products.slice(0, 48),
          pageSize: listOpts.pageSize,
          page: 1,
        })
      );
    }
  }

  return withKhId(plans, input.subiekt_kh_id);
}

/** Jak wyżej, ale dla wielu kh_Id dostawcy (główny + aliasy) — deduplikacja planów. */
export function zdSearchPlansForOrderWithKhIds(
  input: Omit<Parameters<typeof zdSearchPlansForOrderInput>[0], "subiekt_kh_id">,
  khIds: readonly number[]
): SubiektListParams[] {
  const scoped = khIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!scoped.length) return zdSearchPlansForOrderInput({ ...input, subiekt_kh_id: null });

  const plans = scoped.flatMap((khId) =>
    zdSearchPlansForOrderInput({ ...input, subiekt_kh_id: khId })
  );
  return dedupeZdSearchPlans(plans);
}

function zdLiveSearchPlanScore(
  plan: SubiektListParams,
  primaryKhId: number | null
): number {
  let score = 0;
  const symbol = plan.symbol?.trim() ?? "";
  const search = plan.search?.trim() ?? "";

  if (plan.id != null && Number(plan.id) > 0) score += 120;
  if (symbol.length >= 3) score += 100;
  if (symbol && search && symbol === search) score += 50;
  if (primaryKhId != null && plan.khId === primaryKhId) score += 40;
  else if (plan.khId != null) score += 8;

  if (search.length >= 4 && /[a-zA-Ząćęłńóśźż]/i.test(search) && /\d/.test(search)) {
    score += 15;
  }

  return score;
}

/**
 * Wybiera najlepsze plany live search (limit np. 3) — symbol + główny kh_Id na początku.
 */
export function prioritizeZdLiveSearchPlans(
  plans: readonly SubiektListParams[],
  options?: { primaryKhId?: number | null; maxPlans?: number }
): SubiektListParams[] {
  const maxPlans = options?.maxPlans ?? plans.length;
  if (maxPlans <= 0 || !plans.length) return [];

  const primaryKhId =
    options?.primaryKhId != null && Number.isFinite(options.primaryKhId)
      ? Math.trunc(options.primaryKhId)
      : null;

  return [...plans]
    .sort((a, b) => {
      const scoreDiff = zdLiveSearchPlanScore(b, primaryKhId) - zdLiveSearchPlanScore(a, primaryKhId);
      if (scoreDiff !== 0) return scoreDiff;
      const searchA = a.search ?? "";
      const searchB = b.search ?? "";
      if (searchA.length !== searchB.length) return searchA.length - searchB.length;
      return searchA.localeCompare(searchB, "pl");
    })
    .slice(0, maxPlans);
}
