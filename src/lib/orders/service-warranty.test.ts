import { describe, expect, it } from "vitest";
import {
  normalizePurchaseDate,
  SERVICE_WARRANTY_DEFAULT_MONTHS,
  warrantyLabel,
  warrantyMonthsFor,
  warrantyStatus,
  warrantyUntil,
} from "@/lib/orders/service-warranty";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("warrantyUntil", () => {
  it("ten sam dzień N miesięcy później", () => {
    expect(warrantyUntil("2024-03-15", 24)).toBe("2026-03-15");
    expect(warrantyUntil("2025-11-05", 12)).toBe("2026-11-05");
  });
  it("brak dnia w miesiącu docelowym → ostatni dzień miesiąca (także luty przestępny)", () => {
    expect(warrantyUntil("2024-01-31", 1)).toBe("2024-02-29");
    expect(warrantyUntil("2025-01-31", 1)).toBe("2025-02-28");
    expect(warrantyUntil("2024-08-31", 24)).toBe("2026-08-31");
  });
});

describe("warrantyStatus", () => {
  it("ostatni dzień gwarancji jeszcze się liczy, następny już nie", () => {
    expect(warrantyStatus("2026-11-05", day(2026, 11, 5)).state).toBe("active");
    expect(warrantyStatus("2026-11-04", day(2026, 11, 5)).state).toBe("expired");
  });
  it("bez daty końca — nieznana", () => {
    expect(warrantyStatus(null, day(2026, 11, 5))).toEqual({ state: "unknown", until: null });
  });
});

describe("warrantyMonthsFor", () => {
  it("okres modelu z katalogu albo domyślne 24", () => {
    const byModel = new Map([[10, 36]]);
    expect(warrantyMonthsFor(10, byModel)).toBe(36);
    expect(warrantyMonthsFor(11, byModel)).toBe(SERVICE_WARRANTY_DEFAULT_MONTHS);
    expect(warrantyMonthsFor(null, byModel)).toBe(24);
  });
});

describe("normalizePurchaseDate", () => {
  const today = day(2026, 11, 5);
  it("przyjmuje poprawną datę do dziś włącznie", () => {
    expect(normalizePurchaseDate("2026-11-05", today)).toBe("2026-11-05");
    expect(normalizePurchaseDate(" 2020-02-29 ", today)).toBe("2020-02-29");
  });
  it("odrzuca przyszłość, daty sprzed 2000, nieistniejące dni i śmieci", () => {
    expect(normalizePurchaseDate("2026-11-06", today)).toBeNull();
    expect(normalizePurchaseDate("1999-12-31", today)).toBeNull();
    expect(normalizePurchaseDate("2025-02-30", today)).toBeNull();
    expect(normalizePurchaseDate("05.11.2026", today)).toBeNull();
    expect(normalizePurchaseDate("", today)).toBeNull();
    expect(normalizePurchaseDate(null, today)).toBeNull();
  });
});

describe("warrantyLabel", () => {
  it("krótki opis stanu", () => {
    expect(warrantyLabel({ state: "active", until: "2027-03-15" })).toBe("Gwarancja do 15.03.2027");
    expect(warrantyLabel({ state: "expired", until: "2025-03-15" })).toBe("Po gwarancji (15.03.2025)");
    expect(warrantyLabel({ state: "unknown", until: null })).toBe("Brak daty zakupu");
  });
});
