"use client";
import { VACATION_TOAST, toastFromError, ToastNotice } from "@/lib/ui/notice-copy";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  actionSetVacationPeriod,
  actionRemoveVacationPeriod,
  actionFetchVacationPeriods,
} from "@/app/actions/sales-vacation-periods";
import {
  actionSetVacationDelegation,
  actionRemoveVacationDelegation,
  actionFetchDelegationsForSalesPerson,
} from "@/app/actions/vacation-delegations";
import type { VacationPeriodRow } from "@/lib/data/sales-vacation-periods";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconSun, IconUsers } from "@/components/icons/StrokeIcons";
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
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
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

type DeleteTarget =
  | { kind: "vacation"; id: string; label: string }
  | { kind: "delegation"; id: string; label: string }
  | null;

export function VacationPanel({
  salesPersonId,
  delegates,
  initialPeriods,
  initialDelegations,
  canManage = true,
  readOnlyPreview = false,
  personName,
}: {
  salesPersonId: string;
  delegates: DelegateOption[];
  initialPeriods: VacationPeriodRow[];
  initialDelegations: VacationDelegationRow[];
  canManage?: boolean;
  readOnlyPreview?: boolean;
  personName?: string;
}) {
  const router = useRouter();
  const [periods, setPeriods] = useState(initialPeriods);
  const [delegations, setDelegations] = useState(initialDelegations);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [vacationFormOpen, setVacationFormOpen] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    startDate: todayStr(),
    endDate: addDaysStr(14),
    note: "",
  });

  const [assigningPeriodId, setAssigningPeriodId] = useState<string | null>(null);
  const [selectedDelegateId, setSelectedDelegateId] = useState("");

  const delegateNameById = new Map(delegates.map((d) => [d.id, d.name]));

  const resetVacationForm = () => {
    setVacationForm({ startDate: todayStr(), endDate: addDaysStr(14), note: "" });
    setVacationFormOpen(false);
  };

  const refreshAll = async () => {
    const [updatedPeriods, updatedDelegations] = await Promise.all([
      actionFetchVacationPeriods(salesPersonId),
      actionFetchDelegationsForSalesPerson(salesPersonId),
    ]);
    setPeriods(updatedPeriods);
    setDelegations(updatedDelegations);
    router.refresh();
  };

  const saveVacation = () => {
    if (!vacationForm.startDate || !vacationForm.endDate) {
      setToast(VACATION_TOAST.missingDates);
      return;
    }
    if (vacationForm.startDate > vacationForm.endDate) {
      setToast(VACATION_TOAST.invalidDateRange);
      return;
    }
    start(async () => {
      const r = await actionSetVacationPeriod({
        salesPersonId,
        startDate: vacationForm.startDate,
        endDate: vacationForm.endDate,
        note: vacationForm.note || null,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      resetVacationForm();
      setToast(VACATION_TOAST.savedPeriod);
      await refreshAll();
    });
  };

  const assignDelegate = (period: VacationPeriodRow) => {
    if (!selectedDelegateId) {
      setToast(VACATION_TOAST.missingDelegate);
      return;
    }
    start(async () => {
      const r = await actionSetVacationDelegation({
        salesPersonId,
        delegateProfileId: selectedDelegateId,
        startDate: period.startDate,
        endDate: period.endDate,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      setAssigningPeriodId(null);
      setSelectedDelegateId("");
      setToast(VACATION_TOAST.savedDelegationToVacation);
      await refreshAll();
    });
  };

  const removeItem = (target: NonNullable<DeleteTarget>) => {
    start(async () => {
      if (target.kind === "vacation") {
        const r = await actionRemoveVacationPeriod(target.id);
        if ("error" in r) {
          setToast(toastFromError(r.error));
          return;
        }
        setToast(VACATION_TOAST.removedPeriod);
      } else {
        const r = await actionRemoveVacationDelegation(target.id);
        if ("error" in r) {
          setToast(toastFromError(r.error));
          return;
        }
        setToast(VACATION_TOAST.removedDelegateFromVacation);
      }
      setDeleteTarget(null);
      await refreshAll();
    });
  };

  const sortedPeriods = [...periods].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  const canEdit = canManage && !readOnlyPreview;

  const delegationForPeriod = (period: VacationPeriodRow): VacationDelegationRow | null => {
    return delegations.find(
      (d) => d.startDate === period.startDate && d.endDate === period.endDate
    ) ?? null;
  };

  const orphanDelegations = delegations.filter(
    (d) => !sortedPeriods.some(
      (p) => p.startDate === d.startDate && p.endDate === d.endDate
    )
  );

  const headerAction = canEdit && !vacationFormOpen ? (
    <Button variant="outline" size="sm" onClick={() => setVacationFormOpen(true)}>
      + Dodaj urlop
    </Button>
  ) : null;

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title={personName ?? "Urlop i zastępstwa"}
        description={personName ? "Urlopy i zastępstwa tego handlowca." : "Ustaw daty swojego urlopu i wyznacz osobę, która Cię zastąpi. Zastępca zyska dostęp do Twojego panelu (odczyt + potwierdzenie odbioru + zamykanie ZK)."}
        leading={
          <SectionHeadingIcon tileClassName="bg-amber-100 text-amber-800">
            <IconSun size={20} />
          </SectionHeadingIcon>
        }
        action={headerAction}
      />

      <div className={cn(salesChromeInsetClass, "py-3")}>
        {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

        {/* Formularz dodawania urlopu */}
        {vacationFormOpen && canEdit ? (
          <div className="mb-3 space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Od">
                <Input
                  type="date"
                  value={vacationForm.startDate}
                  onChange={(e) => setVacationForm({ ...vacationForm, startDate: e.target.value })}
                />
              </Field>
              <Field label="Do">
                <Input
                  type="date"
                  value={vacationForm.endDate}
                  onChange={(e) => setVacationForm({ ...vacationForm, endDate: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notatka (opcjonalna)">
              <Input
                type="text"
                value={vacationForm.note}
                maxLength={500}
                onChange={(e) => setVacationForm({ ...vacationForm, note: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetVacationForm}>
                Anuluj
              </Button>
              <Button size="sm" onClick={saveVacation} disabled={pending}>
                Zapisz urlop
              </Button>
            </div>
          </div>
        ) : null}

        {/* Lista urlopów z inline przypisywaniem zastępcy */}
        {!sortedPeriods.length ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Brak zaplanowanych urlopów. {canEdit ? "Kliknij „+ Dodaj urlop”, aby ustawić daty." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedPeriods.map((p) => {
              const delegation = delegationForPeriod(p);
              const isAssigning = assigningPeriodId === p.id;

              return (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className={salesTypography.rowTitle}>
                        {p.startDate} → {p.endDate}
                      </p>
                      <p className={cn(salesTypography.rowMeta, "mt-0.5 flex flex-wrap items-center gap-2")}>
                        {statusBadge(p.startDate, p.endDate)}
                        {p.note ? <span className="text-slate-500">{p.note}</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "vacation",
                              id: p.id,
                              label: `urlop od ${p.startDate} do ${p.endDate}`,
                            })
                          }
                        >
                          Usuń urlop
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Wiersz zastępcy — inline pod urlopem */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-1">
                    <IconUsers size={14} className="text-indigo-500" />
                    {delegation ? (
                      <>
                        <span className="text-sm text-slate-600">
                          Zastępca: <span className="font-medium text-slate-800">
                            {delegateNameById.get(delegation.delegateProfileId) ?? "nieznany"}
                          </span>
                        </span>
                        {canEdit ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                              onClick={() => {
                                setAssigningPeriodId(p.id);
                                setSelectedDelegateId("");
                              }}
                            >
                              Zmień
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: "delegation",
                                  id: delegation.id,
                                  label: `zastępcę z urlopu ${p.startDate} → ${p.endDate}`,
                                })
                              }
                            >
                              Usuń zastępcę
                            </Button>
                          </>
                        ) : null}
                      </>
                    ) : isAssigning ? (
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200/40 sm:w-auto"
                          value={selectedDelegateId}
                          onChange={(e) => setSelectedDelegateId(e.target.value)}
                        >
                          <option value="">— wybierz zastępcę —</option>
                          {delegates.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} {d.email ? `(${d.email})` : ""}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7"
                            onClick={() => assignDelegate(p)}
                            disabled={pending}
                          >
                            Przypisz
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => {
                              setAssigningPeriodId(null);
                              setSelectedDelegateId("");
                            }}
                          >
                            Anuluj
                          </Button>
                        </div>
                      </div>
                    ) : canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700"
                        onClick={() => {
                          setAssigningPeriodId(p.id);
                          setSelectedDelegateId("");
                        }}
                      >
                        + Wyznacz zastępcę
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Brak zastępcy</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Osierocone delegacje (bez pasującego urlopu) */}
        {orphanDelegations.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <IconUsers size={14} className="text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-500">
                Zastępstwa bez przypisanego urlopu
              </h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {orphanDelegations.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className={cn(salesTypography.rowTitle, "text-sm")}>
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
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={() =>
                        setDeleteTarget({
                          kind: "delegation",
                          id: d.id,
                          label: `zastępstwo od ${d.startDate} do ${d.endDate}`,
                        })
                      }
                    >
                      Usuń
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          open
          title={deleteTarget.kind === "vacation" ? "Usunąć urlop?" : "Usunąć zastępcę?"}
          message={`${deleteTarget.label} zostanie usunięty.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => removeItem(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </Card>
  );
}
