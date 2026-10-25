"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CATALOG_ZD_SYNC_CRON_SCHEDULE_LABEL,
  type CatalogZdSyncState,
} from "@/lib/subiekt/catalog-zd-sync-shared";
import type { CronRunPayload } from "@/lib/services/cron-run-shared";
import {
  catalogZdSyncIsRunning,
  summarizeCatalogZdSync,
} from "@/lib/subiekt/catalog-zd-sync-summary";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { Alert } from "@/components/ui/Alert";
import { BrandLoader } from "@/components/ui/BrandLoader";
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
        : "-";

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Synchronizacja nocna (cron)"
        description="Indeks ZD (90 dni) + import linii do katalogu - harmonogram na serwerze w firmie."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HelpPopover
              label="Pomoc - synchronizacja katalogu ZD"
              title="Nocna synchronizacja katalogu"
              shortLabel="Pomoc"
            >
              <HelpBlock title="Harmonogram">
                <p>
                  Cron wywołuje <code className="text-[0.85em]">/api/cron/catalog-zd-sync</code>{" "}
                  {CATALOG_ZD_SYNC_CRON_SCHEDULE_LABEL.toLowerCase()}. Jedno wywołanie ma do ok. 14
                  minut - kolejne sloty kontynuują przerwany import.
                </p>
              </HelpBlock>
              <HelpBlock title="Okno nocne">
                <p>
                  Domyślnie 1:00-4:59 Warszawa. Test ręczny poza oknem: parametr{" "}
                  <code className="text-[0.85em]">?force=1</code>. Kolejne wywołanie w tej samej
                  nocy kontynuuje przerwany przebieg.
                </p>
              </HelpBlock>
              <HelpBlock title="Monitorowanie">
                <p className="text-xs text-slate-500">
                  Status wszystkich zadań cron - na stronie{" "}
                  <Link href="/admin" className={panelTextLinkClass}>
                    Administracja
                  </Link>
                  .
                </p>
              </HelpBlock>
            </HelpPopover>
            <Badge variant={statusBadgeVariant(summary.statusTone)}>
              {isRunning ? "W toku" : summary.headline.split(" - ")[0].trim()}
            </Badge>
          </div>
        }
      />

      <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-5">
        <AdminMetrics
          items={[
            {
              label: "Postęp",
              value: summary.progressPercent != null ? `${summary.progressPercent}%` : "-",
              hint: phaseLabel,
              tone:
                summary.progressPercent === 100
                  ? "success"
                  : isRunning
                    ? "warning"
                    : metricTone(summary.statusTone),
            },
            {
              label: "Ostatnia aktualizacja",
              value: lastCronAt ? formatWarsawDateTime(lastCronAt) : "-",
              hint:
                catalogSync?.lastCron?.ok === false && !catalogSync.lastCron.detail?.timedOut
                  ? "Ostatni cron z błędem"
                  : "Stan w bazie lub ostatni cron",
              tone:
                catalogSync?.lastCron?.ok === false && !catalogSync.lastCron.detail?.timedOut
                  ? "warning"
                  : "default",
            },
            {
              label: "Kontynuacja",
              value: summary.needsContinue ? "Wymagana" : "Nie",
              hint: summary.needsContinue
                ? isRunning
                  ? "Cron w toku - kolejny slot lub przycisk poniżej"
                  : "Uruchom kontynuację lub poczekaj na kolejny slot nocny"
                : "Przebieg domknięty lub bezczynny",
              tone: summary.needsContinue ? "warning" : state?.status === "done" ? "success" : "default",
            },
          ]}
        />

        <Alert
          tone={
            summary.statusTone === "success"
              ? "success"
              : summary.statusTone === "error"
                ? "error"
                : summary.statusTone === "warning"
                  ? "warning"
                  : "info"
          }
          title={summary.headline}
        >
          <ul className="space-y-0.5 text-xs">
            {summary.detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Alert>

        {summary.progressPercent != null ? (
          <div>
            <div className="flex items-center justify-between text-[0.6875rem] font-semibold text-slate-500">
              <span>Postęp szacunkowy</span>
              <span className="tabular-nums text-slate-800">{summary.progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-indigo-500 transition"
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        {state?.lastError ? (
          <p className="text-sm font-medium text-red-700">Błąd: {state.lastError}</p>
        ) : null}

        {isRunning ? (
          <div role="status" className={cn(panelTypography.chrome, "flex items-center gap-2")}>
            <BrandLoader size="sm" tile={false} />
            Synchronizacja w toku - odśwież status za chwilę lub poczekaj na koniec przebiegu
            crona.
          </div>
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
          Podgląd wszystkich zadań w tle -{" "}
          <Link href="/admin" className={panelTextLinkClass}>
            Administracja → Zadania cron
          </Link>
          .
        </p>
      </div>
    </Card>
  );
}
