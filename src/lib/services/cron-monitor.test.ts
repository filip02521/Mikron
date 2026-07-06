import { describe, expect, it } from "vitest";
import {
  CRON_JOB_DEFINITIONS,
  evaluateCronJob,
  buildCronMonitorSnapshot,
} from "./cron-monitor";
import type { CronRunPayload } from "./cron-run-log";

const morningDef = CRON_JOB_DEFINITIONS.find((j) => j.id === "morning_routine")!;

describe("evaluateCronJob", () => {
  it("oznacza poranną rutynę jako zaległą po 7:00 w dni robocze bez dzisiejszego runu", () => {
    const now = new Date("2026-06-18T06:30:00.000Z"); // 8:30 Warszawa CEST
    const row = evaluateCronJob(morningDef, null, now);
    expect(row.stale).toBe(true);
    expect(row.tone).toBe("warning");
  });

  it("akceptuje poranną rutynę z dzisiejszym warsawDateKey", () => {
    const now = new Date("2026-06-18T06:30:00.000Z");
    const run: CronRunPayload = {
      ok: true,
      at: "2026-06-18T04:05:00.000Z",
      detail: { warsawDateKey: "2026-06-18", schedulesProcessed: 12 },
    };
    const row = evaluateCronJob(morningDef, run, now);
    expect(row.stale).toBe(false);
    expect(row.tone).toBe("success");
  });

  it("nie oznacza skip already_ran_today jako zaległy", () => {
    const now = new Date("2026-06-18T06:30:00.000Z");
    const run: CronRunPayload = {
      ok: true,
      at: now.toISOString(),
      detail: { skipped: true, reason: "already_ran_today", warsawDateKey: "2026-06-18" },
    };
    const row = evaluateCronJob(morningDef, run, now);
    expect(row.stale).toBe(false);
  });

  it("katalog done w bazie bez wpisu cron nie pokazuje „nigdy nie uruchomiono”", () => {
    const catalogDef = CRON_JOB_DEFINITIONS.find((j) => j.id === "catalog_zd_sync")!;
    const now = new Date("2026-06-18T06:30:00.000Z");
    const row = evaluateCronJob(catalogDef, null, now, {
      status: "done",
      runId: "2026-06-18",
      phase: "import",
      dataOd: "2025-06-18",
      indexPage: 1,
      indexPageSize: 25,
      indexTotalPages: 1,
      indexComplete: true,
      importComplete: true,
      indexProcessed: 100,
      indexMapped: 90,
      indexUnmapped: 5,
      indexUnverifiable: 5,
      importProcessedDocs: 10,
      importProducts: 50,
      importLinks: 50,
      importPending: 0,
      autoAssignUpdated: 0,
      lastUpdatedAt: "2026-06-18T04:30:00.000Z",
      startedAt: "2026-06-18T02:00:00.000Z",
      finishedAt: "2026-06-18T04:30:00.000Z",
      lastDocNumber: null,
      lastError: null,
    });
    expect(row.statusLabel).toBe("OK — zakończono dziś");
    expect(row.tone).toBe("success");
  });
});

describe("buildCronMonitorSnapshot", () => {
  it("liczy joby wymagające uwagi", () => {
    const snapshot = buildCronMonitorSnapshot(
      {
        morning_routine: null,
        process_deliveries: {
          ok: true,
          at: new Date().toISOString(),
          detail: { processed: 1 },
        },
        morning_sync: null,
        catalog_zd_sync: null,
        zd_eta_sync: null,
      },
      new Date("2026-06-18T06:30:00.000Z")
    );
    expect(snapshot.jobs.length).toBe(5);
    expect(snapshot.issueCount).toBeGreaterThan(0);
  });

  it("timeout katalogu nocą nie liczy się jako błąd krytyczny", () => {
    const snapshot = buildCronMonitorSnapshot(
      {
        morning_routine: null,
        process_deliveries: null,
        morning_sync: null,
        zd_eta_sync: null,
        catalog_zd_sync: {
          ok: false,
          at: "2026-06-23T00:24:00.000Z",
          detail: {
            timedOut: true,
            phase: "import",
            runId: "2026-06-23",
            importPending: 42,
          },
        },
      },
      new Date("2026-06-23T00:30:00.000Z"),
      {
        status: "running",
        runId: "2026-06-23",
        phase: "import",
        dataOd: "2025-06-23",
        indexPage: 1,
        indexPageSize: 25,
        indexTotalPages: 1,
        indexComplete: true,
        importComplete: false,
        indexProcessed: 100,
        indexMapped: 90,
        indexUnmapped: 5,
        indexUnverifiable: 5,
        importProcessedDocs: 10,
        importProducts: 50,
        importLinks: 50,
        importPending: 42,
        autoAssignUpdated: 0,
        lastUpdatedAt: "2026-06-23T00:24:00.000Z",
        startedAt: "2026-06-23T00:00:00.000Z",
        finishedAt: null,
        lastDocNumber: null,
        lastError: null,
      }
    );
    const catalog = snapshot.jobs.find((j) => j.id === "catalog_zd_sync");
    expect(catalog?.statusLabel).toBe("Kontynuacja nocna (limit czasu)");
    expect(catalog?.tone).toBe("neutral");
  });
});
