import { describe, expect, it } from "vitest";
import {
  CRON_JOB_DEFINITIONS,
  evaluateCronJob,
  buildCronMonitorSnapshot,
} from "./cron-monitor";
import type { CronRunPayload } from "./cron-run-log";
import type { MailSendLog } from "@/types/database";

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
      catalogState: {
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
      },
    });
    expect(row.statusLabel).toBe("OK — zakończono dziś");
    expect(row.tone).toBe("success");
  });

  it("scheduled mails po 10:00 są OK tylko gdy istnieje sent dla bieżącego okresu", () => {
    const scheduledDef = CRON_JOB_DEFINITIONS.find((j) => j.id === "scheduled_mails")!;
    const now = new Date("2026-08-17T08:30:00.000Z"); // 10:30 Warszawa
    const run: CronRunPayload = {
      ok: true,
      at: "2026-08-17T06:00:00.000Z",
      detail: { skipped: true, reason: "lock_held", warsawDateKey: "2026-08-17" },
    };
    const sentLog: MailSendLog = {
      id: "log-1",
      job_id: "ivoclar_weekly",
      period_key: "2026-W33",
      attempt_no: 1,
      trigger_kind: "cron",
      triggered_by: null,
      status: "sent",
      period_from: "2026-08-10",
      period_to: "2026-08-16",
      subject: "Ivoclar weekly",
      resend_message_ids: ["msg-1"],
      recipient_snapshot: [],
      attachment_manifest: [],
      summary: {},
      events: [],
      error_message: null,
      had_warnings: false,
      started_at: "2026-08-17T05:59:00.000Z",
      finished_at: "2026-08-17T06:02:00.000Z",
      created_at: "2026-08-17T05:59:00.000Z",
    };
    const row = evaluateCronJob(scheduledDef, run, now, { scheduledMailSentLog: sentLog });
    expect(row.stale).toBe(false);
    expect(row.tone).toBe("success");
    expect(row.statusLabel).toBe("OK — wysłano");
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
        informacja_stock_sync: null,
        scheduled_mails: null,
      },
      new Date("2026-06-18T06:30:00.000Z")
    );
    expect(snapshot.jobs.length).toBe(7);
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
        informacja_stock_sync: null,
        scheduled_mails: null,
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

  it("scheduled mails po 10:00 bez sent są zaległe nawet gdy ostatni cron był skipped", () => {
    const snapshot = buildCronMonitorSnapshot(
      {
        morning_routine: null,
        process_deliveries: null,
        morning_sync: null,
        zd_eta_sync: null,
        catalog_zd_sync: null,
        informacja_stock_sync: null,
        scheduled_mails: {
          ok: true,
          at: "2026-08-17T06:00:00.000Z",
          detail: {
            skipped: true,
            reason: "lock_held",
            warsawDateKey: "2026-08-17",
          },
        },
      },
      new Date("2026-08-17T08:30:00.000Z")
    );
    const scheduled = snapshot.jobs.find((j) => j.id === "scheduled_mails");
    expect(scheduled?.stale).toBe(true);
    expect(scheduled?.tone).toBe("warning");
  });
});
