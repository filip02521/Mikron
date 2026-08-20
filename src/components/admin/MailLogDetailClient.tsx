"use client";

import Link from "next/link";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type { MailSendIssue, MailSendLog } from "@/types/database";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

function issueVariant(severity: MailSendIssue["severity"]) {
  switch (severity) {
    case "blocking":
      return "danger" as const;
    case "warning":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

export function MailLogDetailClient({
  log,
  issues,
}: {
  log: MailSendLog;
  issues: MailSendIssue[];
}) {
  const manifest = Array.isArray(log.attachment_manifest)
    ? (log.attachment_manifest as { name: string; bytes: number; sha256: string }[])
    : [];
  const snapshot = Array.isArray(log.recipient_snapshot)
    ? (log.recipient_snapshot as { email: string; recipient_role: string; display_name?: string }[])
    : [];
  const events = Array.isArray(log.events) ? log.events : [];
  const groupedIssues = {
    blocking: issues.filter((issue) => issue.severity === "blocking"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    info: issues.filter((issue) => issue.severity === "info"),
  };

  return (
    <AdminHubShell
      activeTab="mail"
      title="Szczegóły wysyłki"
      description={`${log.job_id} · ${log.period_key} · próba ${log.attempt_no}`}
      action={
        <Link
          href={`/admin/mail/${log.job_id}`}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          ← Job
        </Link>
      }
    >
      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Status" />
        <dl className="grid gap-3 px-3 py-4 text-sm sm:grid-cols-2 sm:px-4">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>
              <Badge>{log.status}</Badge>
              {log.had_warnings ? (
                <span className="ml-2 text-amber-700">z ostrzeżeniami</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Trigger</dt>
            <dd>{log.trigger_kind}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Okres danych</dt>
            <dd>
              {log.period_from ?? "—"} – {log.period_to ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Zakończono</dt>
            <dd>{log.finished_at ? formatWarsawDateTime(log.finished_at) : "—"}</dd>
          </div>
          {log.subject ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Temat</dt>
              <dd>{log.subject}</dd>
            </div>
          ) : null}
          {log.error_message ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Błąd</dt>
              <dd className="text-red-700">{log.error_message}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card padding={false} className="overflow-hidden">
          <CardHeader inset density="compact" title="Odbiorcy (snapshot)" />
          <ul className="px-3 py-3 text-sm sm:px-4">
            {snapshot.length === 0 ? (
              <li className="text-slate-500">Brak snapshotu</li>
            ) : (
              snapshot.map((r) => (
                <li key={`${r.recipient_role}-${r.email}`}>
                  <span className="font-mono text-xs uppercase text-slate-500">{r.recipient_role}</span>{" "}
                  {r.email}
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card padding={false} className="overflow-hidden">
          <CardHeader inset density="compact" title="Załączniki" />
          <ul className="px-3 py-3 text-sm sm:px-4">
            {manifest.length === 0 ? (
              <li className="text-slate-500">Brak metadanych załączników</li>
            ) : (
              manifest.map((a) => (
                <li key={a.name} className="font-mono text-xs">
                  {a.name} · {(a.bytes / 1024).toFixed(1)} KB
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Timeline" />
        <ul className="space-y-2 px-3 py-3 sm:px-4">
          {events.length === 0 ? (
            <li className="text-sm text-slate-500">Brak zdarzeń</li>
          ) : (
            events.map((ev, i) => (
              <li key={i} className={cn(panelTypography.caption, "text-slate-700")}>
                <span className="text-slate-500">{formatWarsawDateTime(ev.at)}</span> ·{" "}
                <strong>{ev.kind}</strong>
                {ev.message ? ` — ${ev.message}` : ""}
              </li>
            ))
          )}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {(["blocking", "warning", "info"] as const).map((severity) => {
          const sectionIssues = groupedIssues[severity];
          const title =
            severity === "blocking"
              ? `Blocking (${sectionIssues.length})`
              : severity === "warning"
                ? `Warning (${sectionIssues.length})`
                : `Info (${sectionIssues.length})`;

          return (
            <Card key={severity} padding={false} className="overflow-hidden">
              <CardHeader inset density="compact" title={title} />
              {sectionIssues.length === 0 ? (
                <div className="px-3 py-6 text-sm text-slate-500 sm:px-4">Brak issues</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sectionIssues.map((issue) => (
                    <details key={issue.id} className="px-3 py-3 sm:px-4">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                        <span className="min-w-0">
                          <Badge variant={issueVariant(issue.severity)}>{issue.code}</Badge>
                          <span className="ml-2 text-sm text-slate-800">{issue.message}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">x{issue.count}</span>
                      </summary>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-slate-700">{issue.message}</p>
                        <div className="text-xs text-slate-500">Severity: {issue.severity}</div>
                        {Object.keys(issue.context ?? {}).length > 0 ? (
                          <pre className="overflow-x-auto rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                            {JSON.stringify(issue.context, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-xs text-slate-500">Brak dodatkowego kontekstu.</div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AdminHubShell>
  );
}
