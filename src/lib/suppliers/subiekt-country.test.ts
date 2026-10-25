import { describe, expect, it } from "vitest";
import { supplierCountryMismatchesLocation } from "@/lib/suppliers/subiekt-country";

describe("supplierCountryMismatchesLocation", () => {
  it("Lokalizacja POLSKA z adresem za granicą i odwrotnie — rozjazd (audyt: DT Shop, Ivoclar EXCEL)", () => {
    expect(supplierCountryMismatchesLocation(22, "POLSKA")).toBe(true);
    expect(supplierCountryMismatchesLocation(1, "ZAGRANICA")).toBe(true);
    expect(supplierCountryMismatchesLocation(1, "IMPORT")).toBe(true);
  });
  it("zgodne albo bez danych — bez rozjazdu", () => {
    expect(supplierCountryMismatchesLocation(1, "POLSKA")).toBe(false);
    expect(supplierCountryMismatchesLocation(22, "ZAGRANICA")).toBe(false);
    expect(supplierCountryMismatchesLocation(null, "POLSKA")).toBe(false);
    expect(supplierCountryMismatchesLocation(1, null)).toBe(false);
  });
});
