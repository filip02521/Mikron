"use client";

import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyUrgentProgress } from "@/lib/orders/daily-urgent-progress";
import { DailyUrgentProgressBar } from "@/components/summary/DailyUrgentProgress";
import { actionSyncData } from "@/app/actions/admin";
import { SupplierSearchField, type SupplierDirectoryEntry } from "@/components/procurement/SupplierSearchField";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { useActionPending } from "@/hooks/useActionPending";
import { cn } from "@/lib/cn";

function MetricTile({
  value,
  label,
  hint,
  href,
}: {
  value: number;
  label: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-700">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </>
  );

  const className = cn(
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition",
    href && "hover:border-slate-300 hover:bg-slate-50"
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function DailyPanelToolbar({
  summary,
  urgentProgress,
  urgentVacationCount,
  suppliers,
  onNewRequest,
  onSelectSupplier,
  onNewSupplier,
  onOpenOnDemand,
}: {
  summary: DailyInboxSummary;
  urgentProgress: DailyUrgentProgress;
  /** Pozycje harmonogramu z aktywną korektą urlopową na liście zaległe / na dziś. */
  urgentVacationCount: number;
  suppliers: SupplierDirectoryEntry[];
  onNewRequest: () => void;
  onSelectSupplier: (id: string) => void;
  onNewSupplier: () => void;
  onOpenOnDemand?: () => void;
}) {
  const urgentTotal = summary.overdueCount + summary.todayCount;
  const { pending: syncPending, pendingMessage, run: runSync } = useActionPending();

  const runSyncSchedules = () => {
    runSync(async () => {
      const r = await actionSyncData();
      if (r.error) throw new Error(r.error);
    }, "Przeliczanie terminów wszystkich dostawców…");
  };

  return (
    <div className="relative space-y-3">
      {pendingMessage ? (
        <ActionLoadingOverlay
          variant="viewport"
          message={pendingMessage}
          hint="Urlopy i interwały — panel odświeży się automatycznie"
        />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SupplierSearchField suppliers={suppliers} onSelect={onSelectSupplier} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onNewSupplier}>
              + Dostawca
            </Button>
            <Link
              href="/zakupy/urlopy"
              className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-1.5 text-xs font-medium text-sky-800 shadow-sm transition-colors hover:bg-sky-100"
            >
              Urlopy
              {summary.vacationSupplierCount > 0
                ? ` (${summary.vacationSupplierCount})`
                : ""}
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={syncPending}
              onClick={runSyncSchedules}
            >
              {syncPending ? (
                <>
                  <Spinner size="sm" />
                  Przeliczanie…
                </>
              ) : (
                "Przelicz terminy"
              )}
            </Button>
            <Button className="sm:ml-1" size="sm" onClick={onNewRequest}>
              Nowa prośba
            </Button>
          </div>
        </div>
      </div>

      <DailyUrgentProgressBar progress={urgentProgress} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Przegląd dnia</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <MetricTile
                value={summary.overdueCount}
                label="Zaległe"
                hint="po terminie"
                href={urgentTotal > 0 ? "#dzis" : undefined}
              />
              <MetricTile
                value={summary.todayCount}
                label="Na dziś"
                href={urgentTotal > 0 ? "#dzis" : undefined}
              />
              <MetricTile
                value={summary.forSomeoneGroupCount}
                label="Prośby handlowców"
                hint={
                  summary.forSomeoneLineCount > 0
                    ? `${summary.forSomeoneLineCount} prod.`
                    : undefined
                }
                href={summary.forSomeoneGroupCount > 0 ? "#dzis" : undefined}
              />
              <MetricTile
                value={summary.weekPlanCount}
                label="W planie tygodnia"
                href={summary.weekPlanCount > 0 ? "#plan" : undefined}
              />
              {summary.onDemandCount > 0 && onOpenOnDemand ? (
                <button
                  type="button"
                  onClick={onOpenOnDemand}
                  className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-left transition hover:border-violet-300 hover:bg-violet-50"
                >
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-violet-900">
                    {summary.onDemandCount}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-violet-800">
                    W razie potrzeby
                  </p>
                  <p className="mt-0.5 text-[11px] text-violet-600/90">na żądanie</p>
                </button>
              ) : null}
            </div>
          </div>
          {urgentVacationCount > 0 ? (
            <div
              className="rounded-xl border border-amber-200/90 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950 sm:max-w-sm"
              role="status"
            >
              <p className="font-medium">
                Urlop wpływa na{" "}
                {urgentVacationCount === 1
                  ? "1 dostawcę"
                  : urgentVacationCount < 5
                    ? `${urgentVacationCount} dostawców`
                    : `${urgentVacationCount} dostawców`}{" "}
                na liście zaległe / na dziś
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
                Przy każdej karcie harmonogramu widać, czy termin został przesunięty, przyspieszony
                lub czy to ostatnie zamówienie przed przerwą. Zarządzanie urlopami:{" "}
                <Link href="/zakupy/urlopy" className="font-medium underline hover:text-amber-950">
                  Urlopy
                </Link>
                .
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
