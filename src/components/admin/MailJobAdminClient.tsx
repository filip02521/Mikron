"use client";

import Link from "next/link";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type { MailJobDefinition, MailJobRecipient, MailSendLog } from "@/types/database";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import type { AdminHubTab } from "@/lib/admin-hub";
import {
  raportyRunnerStatusLabel,
  type RaportyRunnerStatusResult,
} from "@/lib/services/mail/raporty-runner-status";

export function MailJobAdminClient({
  job,
  recipients,
  logs,
  runnerStatus,
  visibleTabs,
}: {
  job: MailJobDefinition;
  recipients: MailJobRecipient[];
  logs: MailSendLog[];
  runnerStatus: RaportyRunnerStatusResult;
  visibleTabs?: readonly AdminHubTab[];
}) {
  const sendLabel = !runnerStatus.ok
    ? "Wysyłka: nieznany stan"
    : runnerStatus.sendEnabled
      ? runnerStatus.overrideTo
        ? "Wysyłka: wł. (override)"
        : "Wysyłka: włączona"
      : "Wysyłka: wyłączona";
  const sendVariant =
    !runnerStatus.ok
      ? "warning"
      : runnerStatus.sendEnabled
        ? runnerStatus.overrideTo
          ? "warning"
          : "success"
        : "default";

  return (
    <AdminHubShell
      activeTab="mail"
      visibleTabs={visibleTabs}
      title={job.label}
      description={job.description}
      action={
        <Link
          href="/admin/mail"
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          ← Lista
        </Link>
      }
    >
      <p className={cn(panelTypography.sectionDesc, "mb-3")}>
        Tryb odczytu — bez wysyłki, testów ani edycji odbiorców z OnTime. Generowanie i mail
        tygodniowy prowadzi OnTime Raporty.
      </p>

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Status wysyłki (OnTime Raporty)"
          description={job.schedule_label || "—"}
        />
        <div className="px-3 py-3 text-sm text-slate-600 sm:px-4">
          <Badge variant={sendVariant}>{sendLabel}</Badge>
          <p className={cn(panelTypography.caption, "mt-2 text-slate-600")}>
            {raportyRunnerStatusLabel(runnerStatus)}
          </p>
          <p className={cn(panelTypography.caption, "mt-1 text-slate-500")}>
            Metadane w OnTime: job w bazie{" "}
            <code>{job.enabled ? "enabled=true" : "enabled=false"}</code> (nie mylić z{" "}
            <code>IVOCLAR_SEND_ENABLED</code> na runnerze).
          </p>
        </div>
      </Card>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Odbiorcy (podgląd)" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Rola</th>
                <th>E-mail</th>
                <th>Nazwa</th>
                <th>Aktywny</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-slate-500">
                    Brak odbiorców w bazie.
                  </td>
                </tr>
              ) : (
                recipients.map((r) => (
                  <tr key={r.id}>
                    <td>{r.recipient_role.toUpperCase()}</td>
                    <td className="font-mono text-xs">{r.email}</td>
                    <td>{r.display_name ?? "—"}</td>
                    <td>{r.enabled ? "tak" : "nie"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </TableScroll>
      </Card>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Historia wysyłek" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>period_key</th>
                <th>status</th>
                <th>próba</th>
                <th>kiedy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-slate-500">
                    Brak logów.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs">{log.period_key}</td>
                    <td>
                      <Badge
                        variant={
                          log.status === "sent"
                            ? "success"
                            : log.status === "failed" || log.status === "blocked"
                              ? "danger"
                              : "default"
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td>{log.attempt_no}</td>
                    <td className="text-xs">
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
