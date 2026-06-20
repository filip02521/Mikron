import type { ProductZdLookupResult } from "@/lib/subiekt/product-zd-lookup";

export const PRODUCT_ZD_LOOKUP_LAST_RESULT_KEY = "mikron.productZdLookup.lastResult";

export type ProductZdLookupLastResult = {
  productLabel: string;
  symbol: string;
  productName: string;
  subiektTwId: number;
  mikranCode: string;
  result: ProductZdLookupResult;
  checkedAt: string;
};

export type ProductZdLookupStockOutPrefill = {
  symbol: string;
  product: string;
  subiektTwId: number;
  mikranCode: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function readProductZdLookupLastResult(): ProductZdLookupLastResult | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PRODUCT_ZD_LOOKUP_LAST_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductZdLookupLastResult;
    if (!parsed?.symbol || !parsed?.productName || !parsed?.result) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProductZdLookupLastResult(value: ProductZdLookupLastResult): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(PRODUCT_ZD_LOOKUP_LAST_RESULT_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function buildProductZdLookupLastResult(input: {
  symbol: string;
  productName: string;
  subiektTwId: number;
  mikranCode?: string | null;
  result: ProductZdLookupResult;
}): ProductZdLookupLastResult {
  const symbol = input.symbol.trim() || "-";
  const productName = input.productName.trim() || symbol;
  return {
    productLabel: symbol !== "-" ? `${symbol} · ${productName}` : productName,
    symbol,
    productName,
    subiektTwId: input.subiektTwId,
    mikranCode: input.mikranCode?.trim() ?? "",
    result: input.result,
    checkedAt: new Date().toISOString(),
  };
}

export function productZdLookupStockOutPrefillFromLast(
  last: ProductZdLookupLastResult
): ProductZdLookupStockOutPrefill {
  return {
    symbol: last.symbol,
    product: last.productName,
    subiektTwId: last.subiektTwId,
    mikranCode: last.mikranCode,
  };
}
