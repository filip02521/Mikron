"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CATALOG_ZD_SYNC_CRON_SCHEDULE_LABEL,
  type CatalogZdSyncState,
} from "@/lib/subiekt/catalog-zd-sync";
import type { CronRunPayload } from "@/lib/services/cron-run-log";
import {
  catalogZdSyncIsRunning,
  summarizeCatalogZdSync,
} from "@/lib/subiekt/catalog-zd-sync-summary";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { panelTextLinkClass, panelTypography } from "@/lib/ui/ontime-theme";

function statusBadgeVariant(
  tone: "neutral" | "success" | "warning" | "error"
): "default" | "success" | "warning" | "danger" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

function metricTone(
  tone: "neutral" | "success" | "warning" | "error"
): "default" | "success" | "warning" | "danger" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

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
  const state = catalogSync?.state;
  const lastCronAt = catalogSync?.lastCron?.at ?? state?.lastUpdatedAt ?? null;

  const phaseLabel =
    state?.phase === "import"
      ? "Import linii"
      : state?.phase === "index"
        ? "Indeks ZD"
        : "—";

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Synchronizacja nocna (cron)"
        description="Indeks ZD (365 dni) + import linii do katalogu — harmonogram na serwerze w firmie."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HelpPopover
              label="Pomoc — synchronizacja katalogu ZD"
              title="Nocna synchronizacja katalogu"
              shortLabel="Pomoc"
            >
              <HelpBlock title="Harmonogram">
                <p>
                  Cron wywołuje <code className="text-[0.85em]">/api/cron/catalog-zd-sync</code>{" "}
                  {CATALOG_ZD_SYNC_CRON_SCHEDULE_LABEL.toLowerCase()}. Jedno wywołanie ma do ok. 14
                  minut — kolejne sloty kontynuują przerwany import.
                </p>
              </HelpBlock>
              <HelpBlock title="Okno nocne">
                <p>
                  Domyślnie 1:00–4:59 Warszawa. Test ręczny poza oknem: parametr{" "}
                  <code className="text-[0.85em]">?force=1</code>. Kolejne wywołanie w tej samej
                  nocy kontynuuje przerwany przebieg.
                </p>
              </HelpBlock>
              <HelpBlock title="Monitorowanie">
                <p className="text-xs text-slate-500">
                  Status wszystkich zadań cron — na stronie{" "}
                  <Link href="/admin" className={panelTextLinkClass}>
                    Administracja
                  </Link>
                  .
                </p>
              </HelpBlock>
            </HelpPopover>
            <Badge variant={statusBadgeVariant(summary.statusTone)}>
              {isRunning ? "W toku" : summary.headline.split("—")[0].trim()}
            </Badge>
          </div>
        }
      />

      <div className="space-y-4 px-3 pb-4 sm:px-4 lg:px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PanelSummaryMetric
            label="Postęp"
            value={summary.progressPercent != null ? `${summary.progressPercent}%` : "—"}
            hint={phaseLabel}
            tone={
              summary.progressPercent === 100
                ? "success"
                : isRunning
                  ? "warning"
                  : metricTone(summary.statusTone)
            }
          />
          <PanelSummaryMetric
            label="Ostatnia aktualizacja"
            value={lastCronAt ? formatWarsawDateTime(lastCronAt).slice(0, 16) : "—"}
            hint={
              catalogSync?.lastCron?.ok === false && !catalogSync.lastCron.detail?.timedOut
                ? "Ostatni cron z błędem"
                : "Stan w bazie lub ostatni cron"
            }
            tone={
              catalogSync?.lastCron?.ok === false && !catalogSync.lastCron.detail?.timedOut
                ? "warning"
                : "default"
            }
          />
          <PanelSummaryMetric
            label="Kontynuacja"
            value={summary.needsContinue ? "Wymagana" : "Nie"}
            hint={
              summary.needsContinue
                ? isRunning
                  ? "Cron w toku — kolejny slot lub przycisk poniżej"
                  : "Uruchom kontynuację lub poczekaj na kolejny slot nocny"
                : "Przebieg domknięty lub bezczynny"
            }
            tone={summary.needsContinue ? "warning" : state?.status === "done" ? "success" : "default"}
          />
        </div>

        <div
          className={cn(
            "rounded-md border px-3 py-2.5",
            summary.statusTone === "success"
              ? "border-emerald-200/80 bg-emerald-50/40"
              : summary.statusTone === "error"
                ? "border-red-200/80 bg-red-50/40"
                : summary.statusTone === "warning"
                  ? "border-amber-200/80 bg-amber-50/40"
                  : "border-slate-200/90 bg-slate-50/50"
          )}
        >
          <p className="text-sm font-medium text-slate-900">{summary.headline}</p>
          <ul className={cn(panelTypography.caption, "mt-2 space-y-0.5 text-slate-700")}>
            {summary.detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        {summary.progressPercent != null ? (
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Postęp szacunkowy</span>
              <span className="tabular-nums text-slate-800">{summary.progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        {state?.lastError ? (
          <p className="text-sm font-medium text-red-700">Błąd: {state.lastError}</p>
        ) : null}

        {isRunning ? (
          <p className={cn(panelTypography.chrome, "font-medium text-amber-900")}>
            Synchronizacja w toku — odśwież status za chwilę lub poczekaj na koniec przebiegu
            crona.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={pending}>
            {pending ? (
              <>
                <Spinner size="sm" />
                Odświeżam…
              </>
            ) : (
              "Odśwież status"
            )}
          </Button>
          {summary.needsContinue ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onContinue}
              disabled={pending || isRunning}
            >
              Kontynuuj synchronizację
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={onRunNow}
            disabled={pending || isRunning}
          >
            Uruchom teraz (test)
          </Button>
          {state?.status === "done" ? (
            <Button variant="secondary" size="sm" onClick={onReset} disabled={pending || isRunning}>
              Od nowa (restart)
            </Button>
          ) : null}
        </div>

        <p className={cn(panelTypography.caption, "text-slate-500")}>
          Podgląd wszystkich zadań w tle —{" "}
          <Link href="/admin" className={panelTextLinkClass}>
            Administracja → Zadania cron
          </Link>
          .
        </p>
      </div>
    </Card>
  );
}
