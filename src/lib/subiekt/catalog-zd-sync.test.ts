import { describe, expect, it } from "vitest";
import {
  CATALOG_SYNC_DAYS_BACK,
  catalogSyncDataOd,
  isWarsawCatalogSyncWindow,
} from "@/lib/subiekt/catalog-zd-sync";

describe("catalogSyncDataOd", () => {
  it("zwraca datę N dni wstecz", () => {
    const od = catalogSyncDataOd(7);
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expect(od).toBe(expected.toISOString().slice(0, 10));
  });

  it("domyślnie 21 dni", () => {
    const od = catalogSyncDataOd();
    const expected = new Date();
    expected.setDate(expected.getDate() - CATALOG_SYNC_DAYS_BACK);
    expect(od).toBe(expected.toISOString().slice(0, 10));
  });
});

describe("isWarsawCatalogSyncWindow", () => {
  it("true między 1:00 a 4:59 Warszawa", () => {
    const winter = new Date("2026-01-15T01:30:00+01:00");
    expect(isWarsawCatalogSyncWindow(winter)).toBe(true);
  });

  it("false w południe", () => {
    const noon = new Date("2026-01-15T12:00:00+01:00");
    expect(isWarsawCatalogSyncWindow(noon)).toBe(false);
  });
});
