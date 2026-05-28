import type { CatalogZdSyncState } from "@/lib/subiekt/catalog-zd-sync";
import type { CronRunPayload } from "@/lib/services/cron-run-log";

export type CatalogZdSyncSummary = {
  headline: string;
  detailLines: string[];
  progressPercent: number | null;
  needsContinue: boolean;
  statusTone: "neutral" | "success" | "warning" | "error";
};

const STATUS_LABEL: Record<CatalogZdSyncState["status"], string> = {
  idle: "Bezczynny",
  running: "W toku",
  done: "Zakończony",
  failed: "Błąd",
};

const PHASE_LABEL: Record<CatalogZdSyncState["phase"], string> = {
  index: "Indeks ZD → dostawca",
  import: "Import linii do katalogu",
};

function formatWarsawShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 19).replace("T", " ");
}

export function catalogZdSyncNeedsContinue(state: CatalogZdSyncState | null | undefined): boolean {
  if (!state) return false;
  if (state.status === "running") return false;
  if (state.status === "failed") return true;
  if (state.status === "done") return false;
  return !state.indexComplete || !state.importComplete;
}

export function catalogZdSyncIsRunning(state: CatalogZdSyncState | null | undefined): boolean {
  return state?.status === "running";
}

export function summarizeCatalogZdSync(
  state: CatalogZdSyncState | null | undefined,
  lastCron: CronRunPayload | null | undefined
): CatalogZdSyncSummary {
  if (!state) {
    return {
      headline: "Brak zapisanego stanu synchronizacji",
      detailLines: lastCron?.at
        ? [
            `Ostatni cron: ${formatWarsawShort(lastCron.at)}${lastCron.ok ? "" : " (błąd)"}`,
          ]
        : ["Uruchom nocny cron na serwerze w firmie lub test ręczny poniżej."],
      progressPercent: null,
      needsContinue: false,
      statusTone: "neutral",
    };
  }

  const phaseLabel = PHASE_LABEL[state.phase];
  const statusLabel = STATUS_LABEL[state.status];
  const needsContinue = catalogZdSyncNeedsContinue(state);

  let progressPercent: number | null = null;
  if (state.phase === "index" && state.indexTotalPages != null && state.indexTotalPages > 0) {
    const pageProgress = Math.min(state.indexPage, state.indexTotalPages) / state.indexTotalPages;
    progressPercent = state.indexComplete ? 50 : Math.round(pageProgress * 50);
  } else if (state.indexComplete) {
    if (state.importPending != null && state.importPending > 0) {
      const done = state.importProcessedDocs;
      const total = done + state.importPending;
      progressPercent = total > 0 ? 50 + Math.round((done / total) * 50) : 75;
    } else if (state.importComplete) {
      progressPercent = 100;
    } else {
      progressPercent = 55;
    }
  }

  const headlineParts = [statusLabel, phaseLabel];
  if (needsContinue && state.status !== "running") headlineParts.push("— wymaga kontynuacji");
  const headline = headlineParts.join(" · ");

  const detailLines: string[] = [
    `Zakres od ${state.dataOd} · run ${state.runId}`,
    `Indeks: ${state.indexProcessed} ZD (mapowane ${state.indexMapped}, bez mapy ${state.indexUnmapped}, niepewne ${state.indexUnverifiable})${
      state.indexComplete ? " ✓" : state.indexTotalPages != null ? ` · strona ${state.indexPage}/${state.indexTotalPages}` : ""
    }`,
    `Import: ${state.importProcessedDocs} dokumentów · ${state.importProducts} produktów · ${state.importLinks} powiązań${
      state.importPending != null ? ` · kolejka ${state.importPending}` : ""
    }${state.importComplete ? " ✓" : ""}`,
    `Auto-przypisanie dostawcy w prośbach: ${state.autoAssignUpdated}`,
  ];

  if (state.lastDocNumber) {
    detailLines.push(`Ostatni dokument: ${state.lastDocNumber}`);
  }
  if (state.finishedAt) {
    detailLines.push(`Zakończono: ${formatWarsawShort(state.finishedAt)}`);
  } else if (state.startedAt) {
    detailLines.push(`Start: ${formatWarsawShort(state.startedAt)} · aktualizacja ${formatWarsawShort(state.lastUpdatedAt)}`);
  }

  if (lastCron?.at) {
    const cronDetail = lastCron.detail as Record<string, unknown> | undefined;
    const timedOut = cronDetail?.timedOut === true;
    detailLines.push(
      `Ostatni cron HTTP: ${formatWarsawShort(lastCron.at)}${lastCron.ok ? "" : " · błąd"}${timedOut ? " · limit czasu (kolejne wywołanie kontynuuje)" : ""}`
    );
  }

  let statusTone: CatalogZdSyncSummary["statusTone"] = "neutral";
  if (state.status === "done" && state.indexComplete && state.importComplete) statusTone = "success";
  else if (state.status === "failed" || state.lastError) statusTone = "error";
  else if (needsContinue || state.status === "running") statusTone = "warning";

  return {
    headline,
    detailLines,
    progressPercent,
    needsContinue,
    statusTone,
  };
}
