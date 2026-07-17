import type { CronJobId, CronRunPayload } from "@/lib/services/cron-run-log";
import { CRON_JOB_IDS, readAllCronRuns } from "@/lib/services/cron-run-log";
import type { CatalogZdSyncState } from "@/lib/subiekt/catalog-zd-sync";
import { catalogZdSyncNeedsContinue } from "@/lib/subiekt/catalog-zd-sync-summary";
import {
  formatWarsawDateTime,
  isWarsawBusinessDay,
  isWarsawWorkHours,
  todayInWarsaw,
  warsawDateKeyFromIso,
  warsawNowParts,
} from "@/lib/time/warsaw";
import { subDays } from "date-fns";
import { formatDateString } from "@/lib/orders/dates";

export type CronMonitorTone = "success" | "warning" | "danger" | "neutral";

export type CronJobDefinition = {
  id: CronJobId;
  label: string;
  schedule: string;
  endpoint: string;
  scheduled: boolean;
  description: string;
};

export const CRON_JOB_DEFINITIONS: CronJobDefinition[] = [
  {
    id: "morning_routine",
    label: "Poranna rutyna",
    schedule: "pn–pt 6:00 (Warszawa)",
    endpoint: "/api/cron/morning",
    scheduled: true,
    description: "Harmonogramy dostawców, domknięcie dostaw w kolejce, retencja historii.",
  },
  {
    id: "process_deliveries",
    label: "Domykanie dostaw",
    schedule: "pn–pt co godz. 8:00–18:00",
    endpoint: "/api/cron/process-deliveries",
    scheduled: true,
    description: "Backup — pozycje z wpisaną ilością dostarczoną → status i e-mail do handlowca.",
  },
  {
    id: "zd_eta_sync",
    label: "Terminy ZD (prośby)",
    schedule: "pn–pt co 2 h 8:00–18:00",
    endpoint: "/api/cron/zd-eta-sync",
    scheduled: true,
    description: "Synchronizacja terminów ZD z Subiekta na aktywnych prośbach handlowców.",
  },
  {
    id: "catalog_zd_sync",
    label: "Katalog z ZD",
    schedule: "codziennie 2:00–4:40 co 20 min",
    endpoint: "/api/cron/catalog-zd-sync",
    scheduled: true,
    description: "Indeks ZD, import linii do katalogu, auto-przypisanie dostawców. Szczegóły na /admin/produkty.",
  },
  {
    id: "morning_sync",
    label: "Tylko harmonogramy",
    schedule: "ręcznie (test)",
    endpoint: "/api/cron/morning-sync",
    scheduled: false,
    description: "Przeliczenie terminów dostawców bez dostaw i retencji — do testów serwisowych.",
  },
];

export type CronJobMonitorRow = {
  id: CronJobId;
  label: string;
  schedule: string;
  endpoint: string;
  scheduled: boolean;
  description: string;
  tone: CronMonitorTone;
  statusLabel: string;
  lastAt: string | null;
  lastAtFormatted: string;
  stale: boolean;
  skipped: boolean;
  skipReason: string | null;
  ok: boolean | null;
  error: string | null;
  summaryLines: string[];
};

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

function runDetail(run: CronRunPayload | null): Record<string, unknown> | undefined {
  return run?.detail as Record<string, unknown> | undefined;
}

function isSkippedRun(run: CronRunPayload | null): boolean {
  return runDetail(run)?.skipped === true;
}

function skipReason(run: CronRunPayload | null): string | null {
  const reason = runDetail(run)?.reason;
  return typeof reason === "string" ? reason : null;
}

function runWarsawDateKey(run: CronRunPayload | null): string | null {
  if (!run) return null;
  const fromDetail = runDetail(run)?.warsawDateKey;
  if (typeof fromDetail === "string" && fromDetail) return fromDetail;
  return warsawDateKeyFromIso(run.at);
}

function summarizeRunDetail(jobId: CronJobId, run: CronRunPayload | null): string[] {
  if (!run) return ["Brak zapisanego uruchomienia w bazie."];
  const detail = runDetail(run) ?? {};
  const lines: string[] = [];

  if (detail.skipped === true && typeof detail.reason === "string") {
    lines.push(`Pominięto: ${detail.reason}`);
  }

  switch (jobId) {
    case "morning_routine": {
      if (typeof detail.schedulesProcessed === "number") {
        lines.push(`Harmonogramy: ${detail.schedulesProcessed}`);
      }
      if (typeof detail.deliveriesProcessed === "number") {
        lines.push(`Domknięte dostawy: ${detail.deliveriesProcessed}`);
      }
      if (detail.deliveriesSkipped === true) {
        lines.push(
          `Dostawy pominięte (${typeof detail.deliveriesSkipReason === "string" ? detail.deliveriesSkipReason : "lock"})`
        );
      }
      if (detail.historyRetentionSkipped === true) {
        lines.push("Retencja historii: pominięta (już wykonana dziś)");
      } else if (typeof detail.historyIndividualDeleted === "number") {
        const total =
          Number(detail.historyIndividualDeleted ?? 0) +
          Number(detail.historyNormalDeleted ?? 0) +
          Number(detail.warehouseReceiptsDeleted ?? 0);
        if (total > 0) {
          lines.push(`Retencja: usunięto ${total} wpisów historii`);
        }
      }
      break;
    }
    case "process_deliveries": {
      if (typeof detail.processed === "number") {
        lines.push(`Przetworzono: ${detail.processed}`);
      }
      if (typeof detail.emailSent === "number") {
        lines.push(`E-maile: ${detail.emailSent}`);
      }
      if (detail.emailNotConfigured === true) {
        lines.push("E-mail nie skonfigurowany");
      }
      break;
    }
    case "zd_eta_sync": {
      if (typeof detail.updated === "number") lines.push(`Zaktualizowano terminów: ${detail.updated}`);
      if (typeof detail.cleared === "number" && detail.cleared > 0) {
        lines.push(`Wyczyszczono: ${detail.cleared}`);
      }
      if (typeof detail.processed === "number") lines.push(`Sprawdzono: ${detail.processed}`);
      if (detail.timedOut === true) lines.push("Limit czasu — kontynuacja przy następnym wywołaniu");
      if (detail.subiektOffline === true) lines.push("Subiekt offline");
      break;
    }
    case "catalog_zd_sync": {
      if (typeof detail.phase === "string") lines.push(`Faza: ${detail.phase}`);
      if (typeof detail.runId === "string") lines.push(`Run: ${detail.runId}`);
      if (typeof detail.importProcessedDocs === "number") {
        lines.push(`Import: ${detail.importProcessedDocs} dokumentów`);
      }
      if (typeof detail.importPending === "number") {
        lines.push(`Kolejka importu: ${detail.importPending}`);
      }
      if (detail.timedOut === true) {
        lines.push("Limit czasu — stan zapisany, kontynuacja w kolejnym slocie nocnym");
      }
      if (detail.subiektOffline === true) lines.push("Subiekt offline");
      break;
    }
    case "morning_sync": {
      if (typeof detail.schedulesProcessed === "number") {
        lines.push(`Harmonogramy: ${detail.schedulesProcessed}`);
      }
      break;
    }
  }

  if (Array.isArray(detail.issues) && detail.issues.length) {
    lines.push(`Uwagi: ${(detail.issues as string[]).slice(0, 2).join("; ")}`);
  }

  return lines.length ? lines : ["Uruchomienie bez dodatkowych metryk."];
}

function isMorningRoutineStale(run: CronRunPayload | null, now: Date): boolean {
  const { hour, isWeekend, dateKey } = warsawNowParts(now);
  if (isWeekend || hour < 7) return false;
  if (!run) return true;
  if (isSkippedRun(run) && skipReason(run) === "already_ran_today") return false;
  const runKey = runWarsawDateKey(run);
  return runKey !== dateKey;
}

function isWorkHoursJobStale(
  run: CronRunPayload | null,
  now: Date,
  maxHours: number
): boolean {
  if (!isWarsawBusinessDay(now)) return false;
  if (!isWarsawWorkHours(now)) return false;
  if (!run) return true;
  if (isSkippedRun(run)) return false;
  return hoursSince(run.at, now) > maxHours;
}

function isCatalogTimedOutContinuation(run: CronRunPayload): boolean {
  const detail = runDetail(run);
  return (
    detail?.timedOut === true &&
    detail?.subiektOffline !== true &&
    !run.error
  );
}

function isCatalogSyncStale(
  run: CronRunPayload | null,
  now: Date,
  catalogState?: CatalogZdSyncState | null
): boolean {
  const { hour, dateKey } = warsawNowParts(now);

  if (catalogState?.status === "done" && catalogState.runId === dateKey) {
    return false;
  }

  if (catalogState && catalogState.runId === dateKey && !catalogState.importComplete) {
    // Po nocnym oknie (po ~5:00) sync powinien być domknięty lub świadomie w toku ręcznie.
    if (hour >= 9) return true;
    return false;
  }

  if (
    catalogState &&
    catalogState.runId !== dateKey &&
    catalogState.status !== "done" &&
    catalogZdSyncNeedsContinue(catalogState)
  ) {
    return true;
  }

  if (hour < 5) return false;
  if (!run) return true;
  if (isSkippedRun(run) && skipReason(run) === "outside_warsaw_night_window") {
    return hoursSince(run.at, now) > 30;
  }
  const runKey = runWarsawDateKey(run);
  if (runKey === dateKey) return false;
  const yesterdayKey = formatDateString(subDays(todayInWarsaw(now), 1));
  if (hour < 9 && runKey === yesterdayKey) return false;
  return hoursSince(run.at, now) > 30;
}

function evaluateCatalogCronStatus(
  run: CronRunPayload | null,
  stale: boolean,
  catalogState?: CatalogZdSyncState | null,
  now = new Date()
): { tone: CronMonitorTone; statusLabel: string } {
  const { dateKey } = warsawNowParts(now);

  if (catalogState?.status === "failed" || catalogState?.lastError) {
    return { tone: stale ? "danger" : "warning", statusLabel: "Błąd synchronizacji" };
  }

  if (catalogState?.status === "done" && catalogState.runId === dateKey) {
    return { tone: "success", statusLabel: "OK — zakończono dziś" };
  }

  if (run && isCatalogTimedOutContinuation(run)) {
    if (stale) {
      return {
        tone: "warning",
        statusLabel: "Nie dokończono w nocy — kontynuuj na /admin/produkty",
      };
    }
    return { tone: "neutral", statusLabel: "Kontynuacja nocna (limit czasu)" };
  }

  if (catalogState?.status === "running") {
    return {
      tone: stale ? "warning" : "neutral",
      statusLabel: stale ? "Import w toku — wymaga uwagi" : "W toku",
    };
  }

  if (run && !run.ok) {
    return { tone: stale ? "danger" : "warning", statusLabel: "Błąd lub ostrzeżenie" };
  }

  if (stale) {
    return { tone: "warning", statusLabel: "Zaległe" };
  }

  return { tone: "success", statusLabel: "OK" };
}

export function evaluateCronJob(
  job: CronJobDefinition,
  run: CronRunPayload | null,
  now = new Date(),
  catalogState?: CatalogZdSyncState | null
): CronJobMonitorRow {
  const skipped = isSkippedRun(run);
  const stale = job.scheduled
    ? job.id === "morning_routine"
      ? isMorningRoutineStale(run, now)
      : job.id === "catalog_zd_sync"
        ? isCatalogSyncStale(run, now, catalogState)
        : job.id === "process_deliveries"
          ? isWorkHoursJobStale(run, now, 2.5)
          : job.id === "zd_eta_sync"
            ? isWorkHoursJobStale(run, now, 3.5)
            : false
    : false;

  let tone: CronMonitorTone;
  let statusLabel: string;

  if (job.id === "catalog_zd_sync") {
    if (!run && !catalogState) {
      tone = stale ? "warning" : "neutral";
      statusLabel = stale ? "Brak danych — zaległe" : "Brak zapisanego stanu";
    } else {
      const catalogStatus = evaluateCatalogCronStatus(run, stale, catalogState, now);
      tone = catalogStatus.tone;
      statusLabel = catalogStatus.statusLabel;
    }
  } else if (!run) {
    tone = job.scheduled ? "warning" : "neutral";
    statusLabel = job.scheduled ? "Nigdy nie uruchomiono" : "Tylko ręcznie";
  } else if (skipped) {
    tone = stale ? "warning" : "neutral";
    statusLabel = stale ? "Pominięto — sprawdź harmonogram" : "Pominięto (okno czasowe)";
  } else if (!run.ok) {
    tone = stale ? "danger" : "warning";
    statusLabel = "Błąd lub ostrzeżenie";
  } else if (stale) {
    tone = "warning";
    statusLabel = "Zaległe";
  } else {
    tone = "success";
    statusLabel = "OK";
  }

  return {
    id: job.id,
    label: job.label,
    schedule: job.schedule,
    endpoint: job.endpoint,
    scheduled: job.scheduled,
    description: job.description,
    tone,
    statusLabel,
    lastAt: run?.at ?? null,
    lastAtFormatted: run?.at ? formatWarsawDateTime(run.at) : "—",
    stale,
    skipped,
    skipReason: skipReason(run),
    ok: run?.ok ?? null,
    error: run?.error ?? null,
    summaryLines: summarizeRunDetail(job.id, run),
  };
}

export function buildCronMonitorSnapshot(
  runs: Record<CronJobId, CronRunPayload | null>,
  now = new Date(),
  catalogState?: CatalogZdSyncState | null
): { jobs: CronJobMonitorRow[]; generatedAt: string; issueCount: number } {
  const jobs = CRON_JOB_DEFINITIONS.map((def) =>
    evaluateCronJob(def, runs[def.id], now, def.id === "catalog_zd_sync" ? catalogState : undefined)
  );
  const issueCount = jobs.filter(
    (job) =>
      job.scheduled &&
      (job.tone === "warning" || job.tone === "danger") &&
      job.statusLabel !== "Kontynuacja nocna (limit czasu)" &&
      job.statusLabel !== "W toku"
  ).length;
  return { jobs, generatedAt: now.toISOString(), issueCount };
}

export async function fetchCronMonitorSnapshot(now = new Date()) {
  const { readCatalogZdSyncState } = await import("@/lib/subiekt/catalog-zd-sync");
  const [runs, catalogState] = await Promise.all([readAllCronRuns(), readCatalogZdSyncState()]);
  return buildCronMonitorSnapshot(runs, now, catalogState);
}

/** Weryfikacja spójności listy jobów w logu. */
export function cronJobIdsInSync(): boolean {
  return CRON_JOB_IDS.length === CRON_JOB_DEFINITIONS.length;
}
