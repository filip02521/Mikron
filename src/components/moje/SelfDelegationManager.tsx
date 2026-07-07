"use client";

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
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconUsers } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";

type DelegateOption = {
  id: string;
  name: string;
  email: string;
};

function todayStr(): string {
  return todayDateKeyInWarsaw();
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

export function SelfDelegationManager({
  salesPersonId,
  delegates,
  initialDelegations,
}: {
  salesPersonId: string;
  delegates: DelegateOption[];
  initialDelegations: VacationDelegationRow[];
}) {
  const router = useRouter();
  const [delegations, setDelegations] = useState(initialDelegations);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
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
      setToast({ text: "Wybierz zastępcę.", tone: "error" });
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
        setToast({ text: r.error, tone: "error" });
        return;
      }
      resetForm();
      setToast({ text: "Zapisano zastępstwo.", tone: "success" });
      const updated = await actionFetchDelegationsForSalesPerson(salesPersonId);
      setDelegations(updated);
      router.refresh();
    });
  };

  const removeDelegation = (id: string) => {
    start(async () => {
      const r = await actionRemoveVacationDelegation(id);
      if ("error" in r) {
        setToast({ text: r.error, tone: "error" });
        return;
      }
      setDeleteTarget(null);
      setToast({ text: "Usunięto zastępstwo.", tone: "success" });
      const updated = await actionFetchDelegationsForSalesPerson(salesPersonId);
      setDelegations(updated);
      router.refresh();
    });
  };

  const sortedDelegations = [...delegations].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  const delegateNameById = new Map(delegates.map((d) => [d.id, d.name]));

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Zastępstwa urlopowe"
        description="Wyznacz osobę, która zastąpi Cię podczas urlopu. Zastępca zyska dostęp do Twojego panelu (odczyt + potwierdzenie odbioru + zamykanie ZK)."
        leading={
          <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
            <IconUsers size={20} />
          </SectionHeadingIcon>
        }
        action={
          !formOpen ? (
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              + Wyznacz zastępcę
            </Button>
          ) : null
        }
      />
      <div className={salesChromeInsetClass}>
        {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}

        {formOpen ? (
          <div className="mb-4 space-y-4 rounded-md border border-slate-200 bg-slate-50/50 p-4">
            <Field label="Zastępca">
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200/40"
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
        ) : null}

        {!sortedDelegations.length ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Brak zastępstw. Kliknij „Wyznacz zastępcę”, aby dodać.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedDelegations.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
              >
                <div className="min-w-0">
                  <p className={salesTypography.rowTitle}>
                    {d.startDate} → {d.endDate}
                  </p>
                  <p className={cn(salesTypography.rowMeta, "mt-0.5 flex items-center gap-2")}>
                    {statusBadge(d.startDate, d.endDate)}
                    {delegateNameById.has(d.delegateProfileId) ? (
                      <span className="text-slate-500">
                        Zastępca: {delegateNameById.get(d.delegateProfileId)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => setDeleteTarget(d)}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
    </Card>
  );
}
