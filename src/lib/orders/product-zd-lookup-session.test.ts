import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProductZdLookupLastResult,
  readProductZdLookupLastResult,
  writeProductZdLookupLastResult,
} from "@/lib/orders/product-zd-lookup-session";

describe("product-zd-lookup-session", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
    vi.stubGlobal("window", { sessionStorage: globalThis.sessionStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zapisuje i odczytuje ostatni wynik", () => {
    const value = buildProductZdLookupLastResult({
      symbol: "ABC",
      productName: "Produkt ABC",
      subiektTwId: 42,
      mikranCode: "123",
      result: {
        status: "found",
        supplierId: "s1",
        supplierName: "Renfert",
        matches: [
          {
            dokId: 1,
            dokNr: "ZD/1",
            deadline: "2026-06-20",
            supplierId: "s1",
            supplierName: "Renfert",
            quantity: 2,
          },
        ],
      },
    });

    writeProductZdLookupLastResult(value);
    expect(readProductZdLookupLastResult()?.productLabel).toBe("ABC · Produkt ABC");
  });

  it("ignoruje uszkodzony JSON", () => {
    storage["mikron.productZdLookup.lastResult"] = "{ broken";
    expect(readProductZdLookupLastResult()).toBeNull();
  });
});
