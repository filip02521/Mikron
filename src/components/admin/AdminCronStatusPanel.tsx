"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  actionGetCronMonitorStatus,
  actionGetInformacjaStockAutoEnabled,
  actionSetInformacjaStockAutoEnabled,
} from "@/app/actions/admin";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { CronJobMonitorRow, CronMonitorTone } from "@/lib/services/cron-monitor";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelTextLinkClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { formatWarsawDateTime } from "@/lib/time/warsaw";

type JobFilter = "all" | "issues" | "scheduled";

function toneBadgeVariant(tone: CronMonitorTone): "success" | "warning" | "danger" | "default" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    default:
      return "default";
  }
}

function CronJobDetail({ job }: { job: CronJobMonitorRow }) {
  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-3 py-3 sm:px-4 lg:px-5">
      <p className={cn(panelTypography.caption, "text-slate-600")}>{job.description}</p>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Endpoint</dt>
          <dd className="font-mono text-slate-900">{job.endpoint}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Harmonogram</dt>
          <dd className="text-slate-900">{job.schedule}</dd>
        </div>
      </dl>
      <ul className="space-y-0.5 text-[0.6875rem] leading-relaxed text-slate-700">
        {job.summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {job.error ? (
        <p className="text-[0.6875rem] font-medium text-red-700">{job.error}</p>
      ) : null}
      {job.id === "catalog_zd_sync" ? (
        <Link
          href="/admin/produkty"
          className={cn(panelTextLinkClass, "inline-flex items-center gap-1 text-sm")}
        >
          Szczegóły synchronizacji katalogu
          <LinkChevron tone="brand" />
        </Link>
      ) : null}
    </div>
  );
}

function CronJobRow({
  job,
  expanded,
  onToggle,
}: {
  job: CronJobMonitorRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-slate-50",
          expanded && "bg-indigo-50 hover:bg-indigo-50"
        )}
        onClick={onToggle}
      >
        <td className="py-2.5 pl-3 pr-2 sm:pl-4 lg:pl-5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex w-full items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <IconChevronDown
              size={14}
              open={expanded}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{job.label}</span>
              {!job.scheduled ? (
                <span className="block text-[0.6875rem] text-slate-500">Tylko ręcznie</span>
              ) : null}
            </span>
          </button>
        </td>
        <td className="px-2 py-2.5 sm:px-3">
          <Badge variant={toneBadgeVariant(job.tone)}>{job.statusLabel}</Badge>
        </td>
        <td className="hidden px-2 py-2.5 text-xs text-slate-600 md:table-cell sm:px-3">
          {job.schedule}
        </td>
        <td className="py-2.5 pl-2 pr-3 text-xs tabular-nums text-slate-700 sm:pr-4 lg:pr-5">
          {job.lastAtFormatted}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={4} className="p-0">
            <CronJobDetail job={job} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const JOB_FILTERS: { id: JobFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "issues", label: "Wymagają uwagi" },
  { id: "scheduled", label: "Z harmonogramem" },
];

export function AdminCronStatusPanel({
  initialSnapshot,
}: {
  initialSnapshot: Awaited<ReturnType<typeof actionGetCronMonitorStatus>>;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [informacjaStockAutoEnabled, setInformacjaStockAutoEnabled] = useState(
    initialSnapshot.informacjaStockAutoEnabled
  );
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [togglePending, startToggleTransition] = useTransition();

  const syncToggleFromServer = useCallback(async () => {
    const { enabled } = await actionGetInformacjaStockAutoEnabled();
    setInformacjaStockAutoEnabled(enabled);
  }, []);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const next = await actionGetCronMonitorStatus();
      setSnapshot(next);
      setInformacjaStockAutoEnabled(next.informacjaStockAutoEnabled);
      setToggleError(null);
    });
  }, []);

  const filteredJobs = useMemo(() => {
    return snapshot.jobs.filter((job) => {
      if (filter === "issues") {
        return job.tone === "warning" || job.tone === "danger";
      }
      if (filter === "scheduled") {
        return job.scheduled;
      }
      return true;
    });
  }, [snapshot.jobs, filter]);

  const okCount = snapshot.jobs.filter((j) => j.scheduled && j.tone === "success").length;
  const scheduledCount = snapshot.jobs.filter((j) => j.scheduled).length;

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Zadania cron"
        description="Ostatnie uruchomienia zapisane w bazie - harmonogram na serwerze w firmie (Windows / Linux)."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HelpPopover
              label="Pomoc - zadania cron"
              title="Zadania w tle"
              shortLabel="Pomoc"
            >
              <HelpBlock title="Harmonogram na serwerze">
                <p>
                  Cron wywołuje endpointy <code className="text-[0.85em]">/api/cron/*</code> z nagłówkiem{" "}
                  <code className="text-[0.85em]">Authorization: Bearer CRON_SECRET</code>.
                </p>
              </HelpBlock>
              <HelpBlock title="Co monitorujemy">
                <p>
                  Ostatni zapis w <code className="text-[0.85em]">app_settings</code> (klucze{" "}
                  <code className="text-[0.85em]">cron_last_*</code>). Limit czasu nocnego importu katalogu to
                  normalna kontynuacja, nie awaria.
                </p>
              </HelpBlock>
            </HelpPopover>
            <Badge variant={snapshot.issueCount ? "warning" : "success"}>
              {snapshot.issueCount ? `${snapshot.issueCount} do sprawdzenia` : "W normie"}
            </Badge>
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={refresh}>
              {pending ? (
                <>
                  <Spinner size="sm" />
                  Odświeżam…
                </>
              ) : (
                "Odśwież"
              )}
            </Button>
          </div>
        }
      />

      <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-5">
        <AdminMetrics
          items={[
            {
              label: "Zadania OK",
              value: `${okCount}/${scheduledCount}`,
              hint: "Zaplanowane z ostatnim przebiegiem w normie",
              tone: okCount === scheduledCount ? "success" : snapshot.issueCount ? "warning" : "default",
            },
            {
              label: "Do sprawdzenia",
              value: snapshot.issueCount,
              hint: "Ostrzeżenia i błędy wymagające reakcji",
              tone:
                snapshot.issueCount === 0
                  ? "success"
                  : snapshot.issueCount > 2
                    ? "danger"
                    : "warning",
            },
            {
              label: "Podgląd",
              value: formatWarsawDateTime(snapshot.generatedAt),
              hint: "Czas ostatniego odczytu z bazy",
            },
          ]}
        />

        <div className="rounded-lg bg-slate-50 px-3.5 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">
                  Auto-odznaczanie informacji ze stanu Subiekta
                </p>
                <Badge variant={informacjaStockAutoEnabled ? "success" : "warning"}>
                  {informacjaStockAutoEnabled ? "Włączone" : "Wyłączone"}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                Globalny przełącznik dla crona i szybkiej automatyki przy wejściu na{" "}
                <code className="text-[0.9em]">/kolejka</code>.
                Domyślnie włączone; wyłączenie zatrzymuje auto-domykanie pozycji informacyjnych.
              </p>
              {toggleError ? <p className="text-xs font-medium text-red-700">{toggleError}</p> : null}
            </div>
            <label
              className={cn(
                "flex min-h-11 shrink-0 cursor-pointer items-center gap-3",
                togglePending && "opacity-70"
              )}
            >
              <span className="text-sm font-medium text-slate-800">
                {togglePending ? "Zapisuję…" : "Aktywna automatyka"}
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={informacjaStockAutoEnabled}
                aria-label="Przełącz automatyczne odznaczanie informacji ze stanu Subiekta"
                checked={informacjaStockAutoEnabled}
                disabled={togglePending}
                onChange={(e) => {
                  setToggleError(null);
                  const next = e.target.checked;
                  setInformacjaStockAutoEnabled(next);
                  startToggleTransition(async () => {
                    const result = await actionSetInformacjaStockAutoEnabled(next);
                    if (!result.ok) {
                      await syncToggleFromServer();
                      setToggleError(result.message);
                      return;
                    }
                    setInformacjaStockAutoEnabled(result.enabled);
                  });
                }}
                className="toggle-switch toggle-indigo"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr zadań">
          {JOB_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                panelChoiceChipClass,
                filter === item.id ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

      </div>

      <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[0.8125rem] font-medium text-slate-500">
                <th className="py-2 pl-3 pr-2 font-medium sm:pl-4 lg:pl-5">Zadanie</th>
                <th className="px-2 py-2 font-medium sm:px-3">Status</th>
                <th className="hidden px-2 py-2 font-medium md:table-cell sm:px-3">Harmonogram</th>
                <th className="py-2 pl-2 pr-3 font-medium sm:pr-4 lg:pr-5">Ostatnio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredJobs.length ? (
                filteredJobs.map((job) => (
                  <CronJobRow
                    key={job.id}
                    job={job}
                    expanded={expandedId === job.id}
                    onToggle={() =>
                      setExpandedId((current) => (current === job.id ? null : job.id))
                    }
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    Brak zadań dla wybranego filtra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      <div className="px-3 py-3 sm:px-4 lg:px-5">
        <p className={cn(panelTypography.caption, "text-slate-500")}>
          Nocna synchronizacja katalogu ZD - pełny postęp i kontynuacja na stronie{" "}
          <Link href="/admin/produkty" className={panelTextLinkClass}>
            Katalog produktów
          </Link>
          .
        </p>
      </div>
    </Card>
  );
}
