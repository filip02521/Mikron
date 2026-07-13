"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  actionSetVacationPeriod,
  actionRemoveVacationPeriod,
  actionFetchVacationPeriods,
} from "@/app/actions/sales-vacation-periods";
import type { VacationPeriodRow, VacationCategory } from "@/lib/data/sales-vacation-periods";
import {
  STAFF_VACATION_CATEGORIES,
  staffVacationCategoryLabel,
} from "@/lib/data/staff-vacation-periods";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { VACATION_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconSun } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";

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
    return <Badge variant="default" className="text-[10px]">Nadchodzący</Badge>;
  }
  if (today > endDate) {
    return <Badge variant="default" className="text-[10px] opacity-60">Zakończony</Badge>;
  }
  return <Badge variant="success" className="text-[10px]">Trwa teraz</Badge>;
}

export function VacationPeriodsSection({
  salesPersonId,
  initialPeriods,
}: {
  salesPersonId: string;
  initialPeriods: VacationPeriodRow[];
}) {
  const router = useRouter();
  const [periods, setPeriods] = useState(initialPeriods);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [deleteTarget, setDeleteTarget] = useState<VacationPeriodRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<{
    startDate: string;
    endDate: string;
    category: VacationCategory;
    note: string;
  }>({
    startDate: todayStr(),
    endDate: addDaysStr(14),
    category: "urlop",
    note: "",
  });

  const resetForm = () => {
    setForm({ startDate: todayStr(), endDate: addDaysStr(14), category: "urlop", note: "" });
    setFormOpen(false);
  };

  const save = () => {
    if (!form.startDate || !form.endDate) {
      setToast(VACATION_TOAST.missingDates);
      return;
    }
    if (form.startDate > form.endDate) {
      setToast(VACATION_TOAST.invalidDateRange);
      return;
    }
    start(async () => {
      const r = await actionSetVacationPeriod({
        salesPersonId,
        startDate: form.startDate,
        endDate: form.endDate,
        category: form.category,
        note: form.note || null,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      resetForm();
      setToast(VACATION_TOAST.savedPeriod);
      const updated = await actionFetchVacationPeriods(salesPersonId);
      setPeriods(updated);
      router.refresh();
    });
  };

  const removePeriod = (id: string) => {
    start(async () => {
      const r = await actionRemoveVacationPeriod(id);
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      setDeleteTarget(null);
      setToast(VACATION_TOAST.removedPeriod);
      const updated = await actionFetchVacationPeriods(salesPersonId);
      setPeriods(updated);
      router.refresh();
    });
  };

  const sortedPeriods = [...periods].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Moje urlopy"
        description="Ustaw daty swojego urlopu, aby system wiedział, kiedy jesteś niedostępny."
        leading={
          <SectionHeadingIcon tileClassName="bg-amber-100 text-amber-800">
            <IconSun size={20} />
          </SectionHeadingIcon>
        }
        action={
          !formOpen ? (
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              + Dodaj urlop
            </Button>
          ) : null
        }
      />
      <div className={salesChromeInsetClass}>
        {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

        {formOpen ? (
          <div className="mb-4 space-y-4 rounded-md border border-slate-200 bg-slate-50/50 p-4">
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
            <Field label="Rodzaj nieobecności">
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200/40"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as VacationCategory })}
              >
                {STAFF_VACATION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notatka (opcjonalna)">
              <Input
                type="text"
                value={form.note}
                maxLength={500}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
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

        {!sortedPeriods.length ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Brak zaplanowanych urlopów. Kliknij „Dodaj urlop”, aby ustawić daty.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedPeriods.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
              >
                <div className="min-w-0">
                  <p className={salesTypography.rowTitle}>
                    {p.startDate} → {p.endDate}
                  </p>
                  <p className={cn(salesTypography.rowMeta, "mt-0.5 flex items-center gap-2")}>
                    {statusBadge(p.startDate, p.endDate)}
                    <Badge variant="default" className="text-[10px]">
                      {staffVacationCategoryLabel(p.category)}
                    </Badge>
                    {p.note ? <span className="text-slate-500">{p.note}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => setDeleteTarget(p)}
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
          title="Usunąć urlop?"
          message={`Urlop od ${deleteTarget.startDate} do ${deleteTarget.endDate} zostanie usunięty.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => removePeriod(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </Card>
  );
}
