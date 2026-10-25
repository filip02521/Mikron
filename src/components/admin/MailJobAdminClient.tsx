"use client";

import Link from "next/link";
import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type { MailJobDefinition, MailJobRecipient, MailSendLog } from "@/types/database";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import {
  raportyRunnerStatusLabel,
  type RaportyRunnerStatusResult,
} from "@/lib/services/mail/raporty-runner-status";

export function MailJobAdminClient({
  job,
  recipients,
  logs,
  runnerStatus,
}: {
  job: MailJobDefinition;
  recipients: MailJobRecipient[];
  logs: MailSendLog[];
  runnerStatus: RaportyRunnerStatusResult;
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
    <AdminSecondaryShell
      backHref="/admin/mail"
      backLabel="Ivoclar"
      title={job.label}
      description={job.description}
    >
      <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
        Tryb odczytu - bez wysyłki, testów ani edycji odbiorców z OnTime. Generowanie i mail
        tygodniowy prowadzi OnTime Raporty.
      </p>

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Status wysyłki (OnTime Raporty)"
          description={job.schedule_label || "-"}
        />
        <div className="px-3 py-4 text-sm text-slate-600 sm:px-4 lg:px-5">
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

      <Card padding={false} className="overflow-hidden">
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
                    <td>{r.display_name ?? "-"}</td>
                    <td>{r.enabled ? "tak" : "nie"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </TableScroll>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Historia wysyłek" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Okres</th>
                <th>Status</th>
                <th>Próba</th>
                <th>Kiedy</th>
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
    </AdminSecondaryShell>
  );
}
