"use client";
import { VACATION_TOAST, toastFromError, ToastNotice } from "@/lib/ui/notice-copy";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  actionSetVacationDelegation,
  actionRemoveVacationDelegation,
  actionFetchDelegationsForSalesPerson,
} from "@/app/actions/vacation-delegations";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

type SalesPersonOption = {
  id: string;
  name: string;
  email: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusBadge(startDate: string, endDate: string) {
  const today = todayStr();
  if (today < startDate) {
    return <Badge variant="default" className="text-[10px]">Nadchodzące</Badge>;
  }
  if (today > endDate) {
    return <Badge variant="default" className="text-[10px] opacity-60">Zakończone</Badge>;
  }
  return <Badge variant="success" className="text-[10px]">Aktywne</Badge>;
}

export function VacationDelegationManager({
  salesPersonId,
  delegates,
  initialDelegations,
  canManage = true,
  readOnlyPreview = false,
  embeddedInTeamWorkspace = false,
}: {
  salesPersonId: string;
  delegates: SalesPersonOption[];
  initialDelegations: VacationDelegationRow[];
  canManage?: boolean;
  readOnlyPreview?: boolean;
  embeddedInTeamWorkspace?: boolean;
}) {
  const router = useRouter();
  const [delegations, setDelegations] = useState(initialDelegations);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [deleteTarget, setDeleteTarget] = useState<VacationDelegationRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    delegateProfileId: "",
    startDate: todayStr(),
    endDate: addDaysStr(14),
  });

  const resetForm = () => {
    setForm({ delegateProfileId: "", startDate: todayStr(), endDate: addDaysStr(14) });
    setFormOpen(false);
  };

  const save = () => {
    if (!form.delegateProfileId) {
      setToast(VACATION_TOAST.missingDelegate);
      return;
    }
    if (!form.startDate || !form.endDate) {
      setToast(VACATION_TOAST.missingDates);
      return;
    }
    if (form.startDate > form.endDate) {
      setToast(VACATION_TOAST.invalidDateRange);
      return;
    }
    start(async () => {
      const r = await actionSetVacationDelegation({
        salesPersonId,
        delegateProfileId: form.delegateProfileId,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      resetForm();
      setToast(VACATION_TOAST.savedDelegation);
      const updated = await actionFetchDelegationsForSalesPerson(salesPersonId);
      setDelegations(updated);
      router.refresh();
    });
  };

  const removeDelegation = (id: string) => {
    start(async () => {
      const r = await actionRemoveVacationDelegation(id);
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      setDeleteTarget(null);
      setToast(VACATION_TOAST.removedDelegation);
      const updated = await actionFetchDelegationsForSalesPerson(salesPersonId);
      setDelegations(updated);
      router.refresh();
    });
  };

  const sortedDelegations = [...delegations].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  return (
    <div>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

      {canManage && !readOnlyPreview && !formOpen ? (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            + Wyznacz zastępcę
          </Button>
        </div>
      ) : null}

      {canManage && !readOnlyPreview && formOpen ? (
        <Card padding={false} className="mb-4 overflow-hidden">
          <CardHeader inset density="compact" title="Nowe zastępstwo" />
          <div className={cn(salesChromeInsetClass, "space-y-4 py-4")}>
            <Field label="Zastępca">
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={form.delegateProfileId}
                onChange={(e) => setForm({ ...form, delegateProfileId: e.target.value })}
              >
                <option value="">— wybierz —</option>
                {delegates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.email ? `(${d.email})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Od">
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </Field>
              <Field label="Do">
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Anuluj
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                Zapisz
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {!sortedDelegations.length ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Brak zastępstw. {canManage && !readOnlyPreview ? "Kliknij „Wyznacz zastępcę”, aby dodać." : ""}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sortedDelegations.map((d) => (
            <li
              key={d.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3",
                embeddedInTeamWorkspace ? salesChromeInsetClass : "px-4 sm:px-5"
              )}
            >
              <div className="min-w-0">
                <p className={salesTypography.rowTitle}>
                  {d.startDate} → {d.endDate}
                </p>
                <p className={cn(salesTypography.rowMeta, "mt-0.5 flex items-center gap-2")}>
                  {statusBadge(d.startDate, d.endDate)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canManage && !readOnlyPreview ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => setDeleteTarget(d)}
                  >
                    Usuń
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget ? (
        <ConfirmDialog
          open
          title="Usunąć zastępstwo?"
          message={`Zastępstwo od ${deleteTarget.startDate} do ${deleteTarget.endDate} zostanie usunięte.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => removeDelegation(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
