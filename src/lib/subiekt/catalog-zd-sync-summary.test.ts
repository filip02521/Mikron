import { describe, expect, it } from "vitest";
import {
  catalogZdSyncNeedsContinue,
  summarizeCatalogZdSync,
} from "@/lib/subiekt/catalog-zd-sync-summary";
import { resolveCatalogZdSyncStartState } from "@/lib/subiekt/catalog-zd-sync";
import type { CatalogZdSyncState } from "@/lib/subiekt/catalog-zd-sync";

function baseState(overrides: Partial<CatalogZdSyncState> = {}): CatalogZdSyncState {
  return {
    status: "running",
    runId: "2026-05-28",
    phase: "index",
    dataOd: "2026-05-07",
    indexPage: 2,
    indexPageSize: 25,
    indexTotalPages: 4,
    indexComplete: false,
    importComplete: false,
    indexProcessed: 10,
    indexMapped: 8,
    indexUnmapped: 1,
    indexUnverifiable: 1,
    importProcessedDocs: 0,
    importProducts: 0,
    importLinks: 0,
    importPending: null,
    autoAssignUpdated: 0,
    startedAt: "2026-05-28T01:00:00.000Z",
    finishedAt: null,
    lastDocNumber: null,
    lastError: null,
    lastUpdatedAt: "2026-05-28T01:05:00.000Z",
    ...overrides,
  };
}

describe("resolveCatalogZdSyncStartState", () => {
  it("force nie zeruje postępu tego samego dnia", () => {
    const prev = baseState({ indexProcessed: 42, indexPage: 3 });
    const next = resolveCatalogZdSyncStartState(prev, prev.runId, { force: true });
    expect(next.indexProcessed).toBe(42);
    expect(next.status).toBe("running");
  });

  it("reset tworzy świeży stan", () => {
    const prev = baseState({ indexProcessed: 42 });
    const next = resolveCatalogZdSyncStartState(prev, prev.runId, { reset: true });
    expect(next.indexProcessed).toBe(0);
    expect(next.indexPage).toBe(1);
  });
});

describe("catalogZdSyncNeedsContinue", () => {
  it("wymaga kontynuacji gdy indeks lub import nieukończony", () => {
    expect(catalogZdSyncNeedsContinue(baseState({ status: "idle" }))).toBe(true);
    expect(catalogZdSyncNeedsContinue(baseState({ status: "running" }))).toBe(true);
    expect(
      catalogZdSyncNeedsContinue(
        baseState({ status: "running", indexComplete: true, importComplete: false })
      )
    ).toBe(true);
    expect(
      catalogZdSyncNeedsContinue(
        baseState({ status: "idle", indexComplete: true, importComplete: false })
      )
    ).toBe(true);
    expect(
      catalogZdSyncNeedsContinue(
        baseState({ status: "done", indexComplete: true, importComplete: true })
      )
    ).toBe(false);
  });
});

describe("summarizeCatalogZdSync", () => {
  it("buduje nagłówek i linie szczegółów", () => {
    const summary = summarizeCatalogZdSync(baseState(), {
      ok: true,
      at: "2026-05-28T02:00:00.000Z",
      detail: { timedOut: true },
    });
    expect(summary.headline).toContain("W toku");
    expect(summary.detailLines.some((l) => l.includes("Indeks:"))).toBe(true);
    expect(summary.needsContinue).toBe(true);
    expect(summary.progressPercent).not.toBeNull();
  });
});
