"use client";

import Link from "next/link";
import type { MailJobListEntry } from "@/app/actions/admin-mail";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type { MailSendLog, MailSendStatus } from "@/types/database";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import type { AdminHubTab } from "@/lib/admin-hub";
import {
  raportyRunnerStatusLabel,
  type RaportyRunnerStatusResult,
} from "@/lib/services/mail/raporty-runner-status";

function statusBadgeVariant(
  status: MailSendStatus | undefined
): "success" | "warning" | "danger" | "default" {
  switch (status) {
    case "sent":
      return "success";
    case "failed":
    case "blocked":
      return "danger";
    case "generating":
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

function runnerSendBadge(runnerStatus: RaportyRunnerStatusResult): {
  variant: "success" | "warning" | "danger" | "default";
  label: string;
} {
  if (!runnerStatus.ok) {
    return { variant: "warning", label: "SEND: nieznany" };
  }
  if (runnerStatus.sendEnabled) {
    return {
      variant: runnerStatus.overrideTo ? "warning" : "success",
      label: runnerStatus.overrideTo ? "SEND: wł. (override)" : "SEND: wł.",
    };
  }
  return { variant: "default", label: "SEND: wył." };
}

export function MailCenterClient({
  jobs,
  recentLogs,
  runnerStatus,
  visibleTabs,
}: {
  jobs: MailJobListEntry[];
  recentLogs: MailSendLog[];
  runnerStatus: RaportyRunnerStatusResult;
  visibleTabs?: readonly AdminHubTab[];
}) {
  const jobsInDb = jobs.length;
  const sentRecent = recentLogs.filter((l) => l.status === "sent").length;
  const problemRecent = recentLogs.filter(
    (l) => l.status === "failed" || l.status === "blocked"
  ).length;
  const sendBadge = runnerSendBadge(runnerStatus);
  const runnerUrl = runnerStatus.ok
    ? runnerStatus.runnerUrl
    : runnerStatus.runnerUrl;
  const sendMetric = !runnerStatus.ok
    ? "?"
    : runnerStatus.sendEnabled
      ? "wł."
      : "wył.";

  return (
    <AdminHubShell activeTab="mail" visibleTabs={visibleTabs}>
      <p className={cn(panelTypography.sectionDesc, "mb-3")}>
        Centrum maili Ivoclar jest <strong>tylko do odczytu</strong>. Generowanie i wysyłkę
        prowadzi OnTime Raporty — stąd nie ma przycisków Wyślij / Włącz / edycji odbiorców.
        Status <strong>SEND</strong> pochodzi na żywo z runnera (
        <code>IVOCLAR_SEND_ENABLED</code>
        ).
        {runnerUrl ? (
          <>
            {" "}
            Runner:{" "}
            <a
              href={runnerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-700 hover:underline"
            >
              {runnerUrl}
            </a>
          </>
        ) : null}
      </p>

      <div
        className={cn(
          "mb-3 rounded-md border px-3 py-2 text-sm",
          runnerStatus.ok && runnerStatus.sendEnabled && !runnerStatus.overrideTo
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : runnerStatus.ok && runnerStatus.sendEnabled
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : runnerStatus.ok
                ? "border-slate-200 bg-slate-50 text-slate-700"
                : "border-amber-200 bg-amber-50 text-amber-950"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sendBadge.variant}>{sendBadge.label}</Badge>
          <span>{raportyRunnerStatusLabel(runnerStatus)}</span>
        </div>
        {runnerStatus.ok && runnerStatus.periodLabel ? (
          <p className={cn(panelTypography.caption, "mt-1 text-slate-600")}>
            Bieżący okres w runnerze: {runnerStatus.periodLabel}
            {runnerStatus.productionSent
              ? " · produkcja tygodnia automatycznego: wysłana"
              : " · produkcja tygodnia automatycznego: do wysyłki"}
            {runnerStatus.localSent || runnerStatus.dbSent
              ? ` · store: lokalnie ${runnerStatus.localSent ? "tak" : "nie"} / DB ${runnerStatus.dbSent ? "tak" : "nie"}`
              : null}
          </p>
        ) : null}
        {runnerStatus.ok && runnerStatus.crashSticky ? (
          <p className="mt-2 rounded border border-amber-300 bg-amber-100/80 px-2 py-1.5 text-sm text-amber-950">
            Runner zgłasza <strong>unknown_after_crash</strong>
            {runnerStatus.runnerStateError
              ? ` (${runnerStatus.runnerStateError})`
              : ""}
            . Nie generuj ponownie z OnTime — dokończ w OnTime Raporty (Wymuś
            wysyłkę + potwierdzenie).
          </p>
        ) : null}
        {runnerStatus.ok &&
        runnerStatus.runnerStateStatus === "sending" &&
        !runnerStatus.crashSticky ? (
          <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-sm text-sky-950">
            Runner jest w trakcie wysyłki…
          </p>
        ) : null}
        {runnerStatus.ok &&
        (runnerStatus.lastSentLabel || runnerStatus.nextWeekLabel) ? (
          <div className="mt-2 grid gap-2 border-t border-black/5 pt-2 sm:grid-cols-2">
            <div>
              <p className={cn(panelTypography.caption, "text-slate-500")}>
                Ostatni wysłany raport
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {runnerStatus.lastSentLabel ?? "—"}
              </p>
              {runnerStatus.lastSentAtLabel ? (
                <p className={cn(panelTypography.caption, "text-emerald-800")}>
                  Zakończono wysyłkę: {runnerStatus.lastSentAtLabel}
                </p>
              ) : null}
            </div>
            <div>
              <p className={cn(panelTypography.caption, "text-slate-500")}>
                Kolejny tydzień
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {runnerStatus.nextWeekLabel ?? "—"}
              </p>
              <p
                className={cn(
                  panelTypography.caption,
                  runnerStatus.nextWeekReady ? "text-emerald-800" : "text-amber-800"
                )}
              >
                {runnerStatus.nextWeekReady
                  ? "Możesz przejść dalej — w Raportach kliknij „Licz kolejny tydzień”"
                  : runnerStatus.testRangeSent && !runnerStatus.productionRangeSent
                    ? "Wysłano tylko test (override) — produkcja nadal otwarta"
                    : "Najpierw wyślij raport produkcyjny za wybrany okres w OnTime Raporty"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <PanelSummaryMetric label="SEND na runnerze" value={sendMetric} />
        <PanelSummaryMetric label="Wysłane (ostatnie)" value={String(sentRecent)} />
        <PanelSummaryMetric label="Problemy (ostatnie)" value={String(problemRecent)} />
      </div>
      <p className={cn(panelTypography.caption, "mt-1 text-slate-500")}>
        Joby w bazie (metadane OT): {jobsInDb} — flaga DB <code>enabled</code> nie steruje już
        wyświetlanym SEND.
      </p>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Joby mailowe" />
        <div className="divide-y divide-slate-100">
          {jobs.map(({ job, lastLog }) => (
            <div
              key={job.id}
              className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/mail/${job.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-700"
                  >
                    {job.label}
                  </Link>
                  <Badge variant={sendBadge.variant}>{sendBadge.label}</Badge>
                  {lastLog ? (
                    <Badge variant={statusBadgeVariant(lastLog.status)}>{lastLog.status}</Badge>
                  ) : null}
                </div>
                <p className={cn(panelTypography.caption, "text-slate-600")}>{job.description}</p>
                <p className={cn(panelTypography.caption, "text-slate-500")}>
                  Harmonogram (Raporty): {job.schedule_label || "—"}
                  {lastLog?.finished_at
                    ? ` · Ostatnia: ${formatWarsawDateTime(lastLog.finished_at)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/admin/mail/${job.id}`}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Logi / szczegóły
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Ostatnie wysyłki" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Job</th>
                <th>Okres</th>
                <th>Status</th>
                <th>Próba</th>
                <th>Kiedy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    Brak wysyłek w rejestrze.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs">{log.job_id}</td>
                    <td>{log.period_key}</td>
                    <td>
                      <Badge variant={statusBadgeVariant(log.status)}>{log.status}</Badge>
                      {log.had_warnings ? (
                        <span className="ml-1 text-xs text-amber-700">⚠</span>
                      ) : null}
                    </td>
                    <td>{log.attempt_no}</td>
                    <td className="text-xs text-slate-600">
                      {log.finished_at ? formatWarsawDateTime(log.finished_at) : "—"}
                    </td>
                    <td>
                      <Link
                        href={`/admin/mail/log/${log.id}`}
                        className="text-sm text-indigo-700 hover:underline"
                      >
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </TableScroll>
      </Card>
    </AdminHubShell>
  );
}
