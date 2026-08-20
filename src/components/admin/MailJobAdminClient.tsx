"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  actionDeleteMailRecipient,
  actionPreviewMailJob,
  actionSendMailJobNow,
  actionSendMailJobTest,
  actionSetMailJobEnabled,
  actionUpsertMailRecipient,
} from "@/app/actions/admin-mail";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import type { MailJobDefinition, MailJobRecipient, MailSendLog } from "@/types/database";
import { toastFromUnknown, type ToastNotice } from "@/lib/ui/notice-copy";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

type RecipientForm = {
  id?: string;
  email: string;
  displayName: string;
  recipientRole: MailJobRecipient["recipient_role"];
  enabled: boolean;
  sortOrder: number;
};

const emptyRecipient = (): RecipientForm => ({
  email: "",
  displayName: "",
  recipientRole: "to",
  enabled: true,
  sortOrder: 0,
});

export function MailJobAdminClient({
  job,
  recipients: initialRecipients,
  logs,
}: {
  job: MailJobDefinition;
  recipients: MailJobRecipient[];
  logs: MailSendLog[];
}) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [form, setForm] = useState<RecipientForm>(emptyRecipient());
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmForce, setConfirmForce] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function editRecipient(r: MailJobRecipient) {
    setForm({
      id: r.id,
      email: r.email,
      displayName: r.display_name ?? "",
      recipientRole: r.recipient_role,
      enabled: r.enabled,
      sortOrder: r.sort_order,
    });
  }

  function saveRecipient() {
    startTransition(async () => {
      try {
        const res = await actionUpsertMailRecipient({
          id: form.id,
          jobId: job.id,
          email: form.email,
          displayName: form.displayName || null,
          recipientRole: form.recipientRole,
          enabled: form.enabled,
          sortOrder: form.sortOrder,
        });
        if ("error" in res && res.error) {
          setToast({ tone: "error", message: res.error });
          return;
        }
        setToast({ tone: "success", message: "Zapisano odbiorcę" });
        setForm(emptyRecipient());
        window.location.reload();
      } catch (e) {
        setToast(toastFromUnknown(e, "Błąd zapisu"));
      }
    });
  }

  function removeRecipient(id: string) {
    startTransition(async () => {
      try {
        const res = await actionDeleteMailRecipient(id, job.id);
        if ("error" in res && res.error) {
          setToast({ tone: "error", message: res.error });
          return;
        }
        setRecipients((prev) => prev.filter((r) => r.id !== id));
        setToast({ tone: "success", message: "Usunięto odbiorcę" });
      } catch (e) {
        setToast(toastFromUnknown(e, "Błąd usuwania"));
      }
    });
  }

  function runAction(
    label: string,
    fn: () => Promise<{ error?: string; success?: boolean; message?: string }>
  ) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.error) {
          setToast({ tone: "error", message: res.error });
        } else {
          setToast({ tone: "success", message: label });
          window.location.reload();
        }
      } catch (e) {
        setToast(toastFromUnknown(e, "Operacja nie powiodła się"));
      }
    });
  }

  return (
    <AdminHubShell
      activeTab="mail"
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
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Harmonogram i akcje"
          description={`${job.schedule_label} · Wysyłamy mimo blocking gaps (braki w issues, nie w XLSX)`}
        />
        <div className="flex flex-wrap gap-2 px-3 py-4 sm:px-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              runAction(job.enabled ? "Wyłączono" : "Włączono", () =>
                actionSetMailJobEnabled(job.id, !job.enabled)
              )
            }
          >
            {job.enabled ? "Wyłącz job" : "Włącz job"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              runAction("Podgląd wygenerowany", async () => {
                const res = await actionPreviewMailJob(job.id);
                if (!res.ok) return { error: res.message };
                return {
                  success: true,
                  message: `Sellout: ${res.preview.canSend ? "OK" : "brak danych"}, issues: ${res.preview.issues.length}`,
                };
              })
            }
          >
            Podgląd (bez wysyłki)
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => runAction("Wysłano test", () => actionSendMailJobTest(job.id))}
          >
            Wyślij test
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => runAction("Wysłano", () => actionSendMailJobNow(job.id, false))}
          >
            Wyślij teraz
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmForce(true)}
          >
            Wyślij ponownie (force)
          </Button>
        </div>
      </Card>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Odbiorcy" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Rola</th>
                <th>E-mail</th>
                <th>Nazwa</th>
                <th>Aktywny</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td>{r.recipient_role.toUpperCase()}</td>
                  <td>{r.email}</td>
                  <td>{r.display_name ?? "—"}</td>
                  <td>{r.enabled ? "tak" : "nie"}</td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="text-sm text-indigo-700 hover:underline"
                      onClick={() => editRecipient(r)}
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-700 hover:underline"
                      onClick={() => setDeleteId(r.id)}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableScroll>

        <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-4 sm:px-4">
          <p className={cn(panelTypography.caption, "mb-3 font-medium text-slate-700")}>
            {form.id ? "Edycja odbiorcy" : "Nowy odbiorca"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="E-mail">
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Nazwa">
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </Field>
            <Field label="Rola">
              <Select
                value={form.recipientRole}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    recipientRole: e.target.value as MailJobRecipient["recipient_role"],
                  }))
                }
              >
                <option value="to">TO</option>
                <option value="cc">CC</option>
                <option value="bcc">BCC</option>
              </Select>
            </Field>
            <Field label="Kolejność">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="Aktywny">
              <Select
                value={form.enabled ? "true" : "false"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    enabled: e.target.value === "true",
                  }))
                }
              >
                <option value="true">tak</option>
                <option value="false">nie</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={saveRecipient}>
              Zapisz odbiorcę
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setForm(emptyRecipient())}
              >
                Anuluj edycję
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card padding={false} className="mt-4 overflow-hidden">
        <CardHeader inset density="compact" title="Historia wysyłek" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Okres</th>
                <th>Status</th>
                <th>Próba</th>
                <th>Trigger</th>
                <th>Kiedy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.period_key}</td>
                  <td>
                    <Badge>{log.status}</Badge>
                    {log.had_warnings ? " ⚠" : ""}
                  </td>
                  <td>{log.attempt_no}</td>
                  <td>{log.trigger_kind}</td>
                  <td className="text-xs">
                    {log.finished_at ? formatWarsawDateTime(log.finished_at) : "—"}
                  </td>
                  <td>
                    <Link href={`/admin/mail/log/${log.id}`} className="text-sm text-indigo-700">
                      Szczegóły
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableScroll>
      </Card>

      <ConfirmDialog
        open={confirmForce}
        title="Ponowna wysyłka (force)"
        message="Wysyłka mimo istniejącego statusu sent dla tego tygodnia. Upewnij się, że Ivoclar nie dostał już maila."
        confirmLabel="Wyślij ponownie"
        danger
        onConfirm={() => {
          setConfirmForce(false);
          runAction("Wysłano ponownie", () => actionSendMailJobNow(job.id, true));
        }}
        onCancel={() => setConfirmForce(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Usunąć odbiorcę?"
        message="Operacja jest nieodwracalna."
        confirmLabel="Usuń"
        danger
        onConfirm={() => {
          if (deleteId) removeRecipient(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />

      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </AdminHubShell>
  );
}
