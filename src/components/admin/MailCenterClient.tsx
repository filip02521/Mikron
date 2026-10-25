"use client";

import Link from "next/link";
import type { MailJobListEntry } from "@/app/actions/admin-mail";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { Alert } from "@/components/ui/Alert";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { buttonClass } from "@/components/ui/Button";
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
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
        Stąd nie ma przycisków Wyślij / Włącz / edycji odbiorców. Status <strong>SEND</strong>{" "}
        pochodzi na żywo z runnera (<code>IVOCLAR_SEND_ENABLED</code>).
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

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Status runnera"
          description={raportyRunnerStatusLabel(runnerStatus)}
          action={<Badge variant={sendBadge.variant}>{sendBadge.label}</Badge>}
        />
        <div className="space-y-4 px-3 py-4 text-sm sm:px-4 lg:px-5">
        <AdminMetrics
          items={[
            { label: "SEND na runnerze", value: sendMetric },
            { label: "Wysłane (ostatnie)", value: sentRecent },
            {
              label: "Problemy (ostatnie)",
              value: problemRecent,
              tone: problemRecent > 0 ? "warning" : "default",
            },
          ]}
        />
        {runnerStatus.ok && runnerStatus.periodLabel ? (
          <p className={cn(panelTypography.caption, "text-slate-600")}>
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
          <Alert tone="warning" title="Runner zgłasza unknown_after_crash">
            {runnerStatus.runnerStateError ? `Błąd: ${runnerStatus.runnerStateError}. ` : ""}
            Nie generuj ponownie z OnTime - dokończ w OnTime Raporty (Wymuś wysyłkę + potwierdzenie).
          </Alert>
        ) : null}
        {runnerStatus.ok &&
        runnerStatus.runnerStateStatus === "sending" &&
        !runnerStatus.crashSticky ? (
          <div role="status" className="flex items-center gap-2 text-slate-600">
            <BrandLoader size="sm" tile={false} />
            Runner jest w trakcie wysyłki…
          </div>
        ) : null}
        {runnerStatus.ok &&
        (runnerStatus.lastSentLabel || runnerStatus.nextWeekLabel) ? (
          <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
            <div>
              <p className={cn(panelTypography.caption, "text-slate-500")}>
                Ostatni wysłany raport
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {runnerStatus.lastSentLabel ?? "-"}
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
                {runnerStatus.nextWeekLabel ?? "-"}
              </p>
              <p
                className={cn(
                  panelTypography.caption,
                  runnerStatus.nextWeekReady ? "text-emerald-800" : "text-amber-800"
                )}
              >
                {runnerStatus.nextWeekReady
                  ? "Możesz przejść dalej - w Raportach kliknij „Licz kolejny tydzień”"
                  : runnerStatus.testRangeSent && !runnerStatus.productionRangeSent
                    ? "Wysłano tylko test (override) - produkcja nadal otwarta"
                    : "Najpierw wyślij raport produkcyjny za wybrany okres w OnTime Raporty"}
              </p>
            </div>
          </div>
        ) : null}

        <p className={cn(panelTypography.caption, "text-slate-500")}>
        Joby w bazie (metadane OT): {jobsInDb} - flaga DB <code>enabled</code> nie steruje już
        wyświetlanym SEND.
        </p>
        </div>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Joby mailowe" />
        <div className="divide-y divide-slate-100">
          {jobs.map(({ job, lastLog }) => (
            <div
              key={job.id}
              className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-5"
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
                  Harmonogram (Raporty): {job.schedule_label || "-"}
                  {lastLog?.finished_at
                    ? ` · Ostatnia: ${formatWarsawDateTime(lastLog.finished_at)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={`/admin/mail/${job.id}`} className={buttonClass("secondary", "sm")}>
                  Logi / szczegóły
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={false} className="overflow-hidden">
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
                        <span className="ml-1 text-xs text-amber-800">z ostrzeżeniami</span>
                      ) : null}
                    </td>
                    <td>{log.attempt_no}</td>
                    <td className="text-xs text-slate-600">
                      {log.finished_at ? formatWarsawDateTime(log.finished_at) : "-"}
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
