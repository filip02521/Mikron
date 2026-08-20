"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  actionSendMailJobNow,
  actionSendMailJobTest,
  actionSetMailJobEnabled,
  type MailJobListEntry,
} from "@/app/actions/admin-mail";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type { MailSendLog, MailSendStatus } from "@/types/database";
import { toastFromUnknown, type ToastNotice } from "@/lib/ui/notice-copy";
import { useState } from "react";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

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

export function MailCenterClient({
  jobs,
  recentLogs,
}: {
  jobs: MailJobListEntry[];
  recentLogs: MailSendLog[];
}) {
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [pending, startTransition] = useTransition();

  const activeJobs = jobs.filter((j) => j.job.enabled).length;
  const sentRecent = recentLogs.filter((l) => l.status === "sent").length;
  const problemRecent = recentLogs.filter(
    (l) => l.status === "failed" || l.status === "blocked"
  ).length;

  function toggleEnabled(jobId: string, enabled: boolean) {
    startTransition(async () => {
      try {
        const res = await actionSetMailJobEnabled(jobId, enabled);
        if ("error" in res && res.error) {
          setToast({ tone: "error", message: res.error });
        } else {
          setToast({ tone: "success", message: enabled ? "Job włączony" : "Job wyłączony" });
          window.location.reload();
        }
      } catch (e) {
        setToast(toastFromUnknown(e, "Nie udało się zapisać"));
      }
    });
  }

  function runJobAction(
    successMessage: string,
    fn: () => Promise<{ error?: string; success?: boolean }>
  ) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.error) {
          setToast({ tone: "error", message: res.error });
        } else {
          setToast({ tone: "success", message: successMessage });
          window.location.reload();
        }
      } catch (e) {
        setToast(toastFromUnknown(e, "Operacja nie powiodła się"));
      }
    });
  }

  return (
    <AdminHubShell activeTab="mail">
      <div className="grid gap-3 sm:grid-cols-3">
        <PanelSummaryMetric label="Aktywne joby" value={String(activeJobs)} />
        <PanelSummaryMetric label="Wysłane (ostatnie)" value={String(sentRecent)} />
        <PanelSummaryMetric label="Problemy (ostatnie)" value={String(problemRecent)} />
      </div>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Joby mailowe" />
        <div className="divide-y divide-slate-100">
          {jobs.map(({ job, lastLog }) => (
            <div key={job.id} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/mail/${job.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-700"
                  >
                    {job.label}
                  </Link>
                  <Badge variant={job.enabled ? "success" : "default"}>
                    {job.enabled ? "Wł." : "Wył."}
                  </Badge>
                  {lastLog ? (
                    <Badge variant={statusBadgeVariant(lastLog.status)}>{lastLog.status}</Badge>
                  ) : null}
                </div>
                <p className={cn(panelTypography.caption, "text-slate-600")}>{job.description}</p>
                <p className={cn(panelTypography.caption, "text-slate-500")}>
                  Harmonogram: {job.schedule_label || "—"}
                  {lastLog?.finished_at
                    ? ` · Ostatnia: ${formatWarsawDateTime(lastLog.finished_at)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => toggleEnabled(job.id, !job.enabled)}
                >
                  {job.enabled ? "Wyłącz" : "Włącz"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => runJobAction("Wysłano test", () => actionSendMailJobTest(job.id))}
                >
                  Wyślij test
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => runJobAction("Wysłano", () => actionSendMailJobNow(job.id, false))}
                >
                  Wyślij teraz
                </Button>
                <Link
                  href={`/admin/mail/${job.id}`}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Szczegóły
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

      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </AdminHubShell>
  );
}
