import { describe, expect, it } from "vitest";
import { parseServicePartReport, pickServicePartSupplier, servicePartRequestNote } from "./service-part-report";

describe("parseServicePartReport", () => {
  it("accepts a positive integer quantity and trims the note", () => {
    expect(parseServicePartReport({ twId: 91002, quantity: 4, note: "  ZS/26/11/014 " })).toEqual({
      ok: true,
      twId: 91002,
      quantity: 4,
      note: "ZS/26/11/014",
    });
  });
  it("rejects zero, fractions and oversized quantities", () => {
    expect(parseServicePartReport({ twId: 1, quantity: 0 }).ok).toBe(false);
    expect(parseServicePartReport({ twId: 1, quantity: 1.5 }).ok).toBe(false);
    expect(parseServicePartReport({ twId: 1, quantity: 10000 }).ok).toBe(false);
  });
  it("rejects a bad product id", () => {
    expect(parseServicePartReport({ twId: -3, quantity: 1 }).ok).toBe(false);
  });
});

describe("servicePartRequestNote", () => {
  it("marks the request as coming from the service team", () => {
    expect(servicePartRequestNote("")).toBe("Zgłoszenie serwisu");
    expect(servicePartRequestNote("ZS/26/11/014")).toBe("Zgłoszenie serwisu: ZS/26/11/014");
  });
});

describe("pickServicePartSupplier", () => {
  const pinned = { supplierId: "p", supplierName: "Przypięty", isActive: true };
  const last = { supplierId: "l", supplierName: "Ostatni", isActive: true };
  it("prefers the supplier pinned in Kreator ZD", () => {
    expect(pickServicePartSupplier({ pinned, lastZd: last })).toMatchObject({ supplierId: "p", source: "kreator" });
  });
  it("falls back to the last ZD supplier when nothing is pinned or the pin is inactive", () => {
    expect(pickServicePartSupplier({ pinned: null, lastZd: last })).toMatchObject({ supplierId: "l", source: "historia" });
    expect(pickServicePartSupplier({ pinned: { ...pinned, isActive: false }, lastZd: last })?.supplierId).toBe("l");
  });
  it("returns null when no active source exists (request goes to verification)", () => {
    expect(pickServicePartSupplier({ pinned: null, lastZd: { ...last, isActive: false } })).toBeNull();
  });
});
