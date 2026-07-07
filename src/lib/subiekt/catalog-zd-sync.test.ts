import { describe, expect, it } from "vitest";
import {
  CATALOG_SYNC_DAYS_BACK,
  catalogSyncDataOd,
  isWarsawCatalogSyncWindow,
  resolveCatalogZdSyncStartState,
  type CatalogZdSyncState,
} from "@/lib/subiekt/catalog-zd-sync";

describe("catalogSyncDataOd", () => {
  it("zwraca datę N dni wstecz", () => {
    const od = catalogSyncDataOd(7);
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expect(od).toBe(expected.toISOString().slice(0, 10));
  });

  it("domyślnie 90 dni", () => {
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

describe("resolveCatalogZdSyncStartState", () => {
  function makeStaleState(overrides?: Partial<CatalogZdSyncState>): CatalogZdSyncState {
    return {
      status: "running",
      runId: "2026-06-28",
      phase: "index",
      dataOd: "2025-07-07",
      indexPage: 15,
      indexPageSize: 25,
      indexTotalPages: 100,
      indexComplete: false,
      importComplete: false,
      indexProcessed: 350,
      indexMapped: 200,
      indexUnmapped: 100,
      indexUnverifiable: 50,
      importProcessedDocs: 0,
      importProducts: 0,
      importLinks: 0,
      importPending: null,
      autoAssignUpdated: 0,
      startedAt: "2026-06-28T02:00:00.000Z",
      finishedAt: null,
      lastDocNumber: "ZD 123/2026",
      lastError: null,
      lastUpdatedAt: "2026-06-28T02:14:00.000Z",
      ...overrides,
    };
  }

  it("odświeża dataOd przy kontynuacji niedokończonego przebiegu (nowy dzień)", () => {
    const stale = makeStaleState();
    const result = resolveCatalogZdSyncStartState(stale, "2026-06-29");
    expect(result.dataOd).toBe(catalogSyncDataOd());
    expect(result.dataOd).not.toBe("2025-07-07");
    expect(result.indexPage).toBe(15);
    expect(result.status).toBe("running");
  });

  it("odświeża dataOd przy wznowieniu zatrzymanego przebiegu (ten sam dzień)", () => {
    const stale = makeStaleState({ runId: "2026-06-29", status: "failed" });
    const result = resolveCatalogZdSyncStartState(stale, "2026-06-29");
    expect(result.dataOd).toBe(catalogSyncDataOd());
    expect(result.dataOd).not.toBe("2025-07-07");
  });

  it("resetuje stan przy ukończonym przebiegu (nowy dzień)", () => {
    const done = makeStaleState({
      status: "done",
      indexComplete: true,
      importComplete: true,
      finishedAt: "2026-06-28T04:30:00.000Z",
    });
    const result = resolveCatalogZdSyncStartState(done, "2026-06-29");
    expect(result.dataOd).toBe(catalogSyncDataOd());
    expect(result.indexPage).toBe(1);
    expect(result.indexProcessed).toBe(0);
  });
});
