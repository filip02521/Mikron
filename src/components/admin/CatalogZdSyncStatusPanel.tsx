"use client";

import { useMemo } from "react";
import type { CatalogZdSyncState } from "@/lib/subiekt/catalog-zd-sync";
import type { CronRunPayload } from "@/lib/services/cron-run-log";
import {
  catalogZdSyncIsRunning,
  summarizeCatalogZdSync,
} from "@/lib/subiekt/catalog-zd-sync-summary";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function CatalogZdSyncStatusPanel({
  catalogSync,
  pending,
  onRefresh,
  onRunNow,
  onContinue,
  onReset,
  syncRunning = false,
}: {
  catalogSync: { state: CatalogZdSyncState | null; lastCron: CronRunPayload | null } | null;
  pending: boolean;
  onRefresh: () => void;
  onRunNow: () => void;
  onContinue: () => void;
  onReset: () => void;
  syncRunning?: boolean;
}) {
  const summary = useMemo(
    () => summarizeCatalogZdSync(catalogSync?.state, catalogSync?.lastCron),
    [catalogSync]
  );
  const isRunning = syncRunning || catalogZdSyncIsRunning(catalogSync?.state);

  const toneBorder =
    summary.statusTone === "success"
      ? "border-emerald-200 bg-emerald-50/50"
      : summary.statusTone === "error"
        ? "border-red-200 bg-red-50/40"
        : summary.statusTone === "warning"
          ? "border-amber-200 bg-amber-50/50"
          : "border-indigo-200 bg-indigo-50/40";

  return (
    <div className={cn("mt-2 rounded-md border p-4", toneBorder)}>
      <p className="text-sm font-semibold text-slate-900">Synchronizacja nocna (cron)</p>
      <p className="mt-0.5 text-xs text-slate-600">
        Na serwerze w firmie: indeks ostatnich ~3 tyg. ZD + import nowych linii do katalogu. W dzień
        system nie skanuje Subiekta. Okno crona: 1:00–4:59 Warszawa (
        <span className="font-mono">?force=1</span> poza oknem). Kolejne wywołanie w tej samej nocy
        kontynuuje przerwany przebieg.
      </p>

      <p className="mt-3 text-sm font-medium text-slate-900">{summary.headline}</p>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
        {summary.detailLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {summary.progressPercent != null ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Postęp szacunkowy</span>
            <span className="font-semibold tabular-nums">{summary.progressPercent}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${summary.progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {catalogSync?.state?.lastError ? (
        <p className="mt-2 text-[11px] font-medium text-red-700">Błąd: {catalogSync.state.lastError}</p>
      ) : null}

      {isRunning ? (
        <p className="mt-2 text-xs font-medium text-amber-900">
          Synchronizacja w toku — odśwież status za chwilę lub poczekaj na koniec przebiegu crona.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onRefresh} disabled={pending}>
          Odśwież status
        </Button>
        {summary.needsContinue ? (
          <Button variant="secondary" onClick={onContinue} disabled={pending || isRunning}>
            Kontynuuj synchronizację
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onRunNow} disabled={pending || isRunning}>
          Uruchom teraz (test)
        </Button>
        {catalogSync?.state?.status === "done" ? (
          <Button variant="secondary" onClick={onReset} disabled={pending || isRunning}>
            Od nowa (restart)
          </Button>
        ) : null}
      </div>
    </div>
  );
}
