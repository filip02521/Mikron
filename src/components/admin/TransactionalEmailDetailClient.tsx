"use client";

import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { EmailHtmlPreview } from "@/components/admin/EmailHtmlPreview";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { TRANSACTIONAL_EMAIL_KIND_LABELS } from "@/lib/services/transactional-email-labels";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type {
  TransactionalEmailKind,
  TransactionalEmailLog,
} from "@/types/database";

function kindLabel(kind: string): string {
  return (
    TRANSACTIONAL_EMAIL_KIND_LABELS[kind as TransactionalEmailKind] ?? kind
  );
}

export function TransactionalEmailDetailClient({
  log,
}: {
  log: TransactionalEmailLog;
}) {
  return (
    <AdminSecondaryShell
      backHref="/admin/wysylki"
      backLabel="Wysyłki OT"
      title="Podgląd maila"
      description={`${kindLabel(log.kind)} · ${formatWarsawDateTime(log.created_at)}`}
    >
      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Metadane" />
        <dl className="grid gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:px-6">
          <div>
            <dt className="text-xs font-medium text-slate-500">Status</dt>
            <dd>
              <Badge variant={log.status === "sent" ? "success" : "danger"}>
                {log.status === "sent" ? "Wysłano" : "Błąd"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Typ</dt>
            <dd>{kindLabel(log.kind)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">From</dt>
            <dd className="font-mono text-xs">{log.from_address || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Message-ID</dt>
            <dd className="break-all font-mono text-xs">{log.message_id || "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">To (faktycznie wysłane)</dt>
            <dd className="font-mono text-xs">
              {(log.to_addresses ?? []).join(", ") || "-"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">Intended To</dt>
            <dd className="font-mono text-xs">
              {(log.intended_to ?? []).join(", ") || "-"}
              {log.override_to ? (
                <span className="ml-2 text-amber-800">
                  override → {log.override_to}
                </span>
              ) : null}
            </dd>
          </div>
          {(log.cc_addresses?.length ?? 0) > 0 ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">CC</dt>
              <dd className="font-mono text-xs">{log.cc_addresses.join(", ")}</dd>
            </div>
          ) : null}
          {(log.bcc_addresses?.length ?? 0) > 0 ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">BCC</dt>
              <dd className="font-mono text-xs">{log.bcc_addresses.join(", ")}</dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">Temat</dt>
            <dd>{log.subject || "-"}</dd>
          </div>
          {log.error_message ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Błąd</dt>
              <dd className="text-red-700">{log.error_message}</dd>
            </div>
          ) : null}
          {log.has_attachments ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Załączniki</dt>
              <dd className="font-mono text-xs">
                {(log.attachment_names ?? []).join(", ") || "(bez nazw)"}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Treść HTML (podgląd)" />
        <div className="p-3 sm:p-4">
          <EmailHtmlPreview html={log.html_body ?? ""} />
        </div>
      </Card>
    </AdminSecondaryShell>
  );
}
