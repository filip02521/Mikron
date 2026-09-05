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

/** Kod SKU z myślnikami (np. RS-F2-GPCL-41) w nazwie produktu. */
export function extractHyphenatedProductSku(name: string): string {
  const match = name.match(/\b([A-Za-z]{2,}(?:-[A-Za-z0-9]{1,12}){2,})\b/);
  return match?.[1] ?? "";
}

/** Kod alfanumeryczny z końca nazwy (np. „Komet węglik H364RNF” → H364RNF). */
export function extractAlphanumericProductCodeFromName(name: string): string {
  const hyphenated = extractHyphenatedProductSku(name);
  if (hyphenated) return hyphenated;

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
