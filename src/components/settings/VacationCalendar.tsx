"use client";
import { VACATION_TOAST, toastFromError, ToastNotice } from "@/lib/ui/notice-copy";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  actionSetVacationPeriod,
  actionRemoveVacationPeriod,
} from "@/app/actions/sales-vacation-periods";
import {
  actionSetVacationDelegation,
  actionRemoveVacationDelegation,
} from "@/app/actions/vacation-delegations";
import type { VacationPeriodRow } from "@/lib/data/sales-vacation-periods";
import type { VacationDelegationRow, DelegateOption } from "@/lib/data/vacation-delegations";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconSun,
  IconUsers,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesTypography, panelDropdownShellClass } from "@/lib/ui/ontime-theme";
import { computeAnchoredDropdownPosition } from "@/lib/ui/dropdown-anchor";
import { vacationColorMap } from "@/lib/ui/vacation-colors";

const MONTH_NAMES = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const WEEKDAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"];

type SalesPerson = { id: string; name: string; linkedUserId: string | null };

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type DeleteTarget =
  | { kind: "vacation"; id: string; label: string }
  | { kind: "delegation"; id: string; label: string }
  | null;

type DayCell = {
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  periods: { period: VacationPeriodRow; salesPersonId: string; salesPersonName: string; isFirstDay: boolean }[];
};

function statusBadge(startDate: string, endDate: string, todayKey: string) {
  if (todayKey < startDate) {
    return <Badge variant="default" className="text-[10px]">Nadchodzące</Badge>;
  }
  if (todayKey > endDate) {
    return <Badge variant="default" className="text-[10px] opacity-60">Zakończone</Badge>;
  }
  return <Badge variant="success" className="text-[10px]">Aktywne</Badge>;
}

function buildCalendarCells(
  year: number,
  month: number,
  periodsBySalesPerson: Record<string, VacationPeriodRow[]>,
  salesPeople: SalesPerson[],
  todayKey: string
): DayCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  const fmtKey = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const isWeekend = (weekday: number) => weekday === 5 || weekday === 6;

  const allPeriods: { period: VacationPeriodRow; salesPersonId: string; salesPersonName: string }[] = [];
  for (const sp of salesPeople) {
    const periods = periodsBySalesPerson[sp.id] ?? [];
    for (const period of periods) {
      allPeriods.push({ period, salesPersonId: sp.id, salesPersonName: sp.name });
    }
  }

  const getPeriodsForDate = (dateKey: string): DayCell["periods"] => {
    const result: DayCell["periods"] = [];
    for (const { period, salesPersonId, salesPersonName } of allPeriods) {
      if (dateKey >= period.startDate && dateKey <= period.endDate) {
        const isFirstDay = dateKey === period.startDate;
        result.push({ period, salesPersonId, salesPersonName, isFirstDay });
      }
    }
    return result;
  };

  for (let i = 0; i < firstWeekday; i++) {
    const day = prevMonthLastDay - firstWeekday + i + 1;
    const m = month - 1 < 0 ? 11 : month - 1;
    const y = month - 1 < 0 ? year - 1 : year;
    const dateKey = fmtKey(y, m, day);
    const weekday = (i + 0) % 7;
    cells.push({
      dateKey,
      dayOfMonth: day,
      isCurrentMonth: false,
      isWeekend: isWeekend(weekday),
      isToday: dateKey === todayKey,
      periods: [],
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = fmtKey(year, month, d);
    const weekday = (firstWeekday + d - 1) % 7;
    cells.push({
      dateKey,
      dayOfMonth: d,
      isCurrentMonth: true,
      isWeekend: isWeekend(weekday),
      isToday: dateKey === todayKey,
      periods: getPeriodsForDate(dateKey),
    });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - firstWeekday - daysInMonth + 1;
    const m = month + 1 > 11 ? 0 : month + 1;
    const y = month + 1 > 11 ? year + 1 : year;
    const dateKey = fmtKey(y, m, nextDay);
    const weekday = cells.length % 7;
    cells.push({
      dateKey,
      dayOfMonth: nextDay,
      isCurrentMonth: false,
      isWeekend: isWeekend(weekday),
      isToday: dateKey === todayKey,
      periods: [],
    });
  }

  return cells;
}

function hasAnyPeriodInMonth(
  year: number,
  month: number,
  periodsBySalesPerson: Record<string, VacationPeriodRow[]>
): boolean {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  for (const periods of Object.values(periodsBySalesPerson)) {
    for (const p of periods) {
      if (p.startDate <= monthEnd && p.endDate >= monthStart) return true;
    }
  }
  return false;
}

function getActiveSalesPeopleInMonth(
  year: number,
  month: number,
  periodsBySalesPerson: Record<string, VacationPeriodRow[]>,
  salesPeople: SalesPerson[]
): SalesPerson[] {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  return salesPeople.filter((sp) => {
    const periods = periodsBySalesPerson[sp.id] ?? [];
    return periods.some((p) => p.startDate <= monthEnd && p.endDate >= monthStart);
  });
}

export function VacationCalendar({
  salesPeople,
  periodsBySalesPerson,
  delegationsBySalesPerson,
  delegateOptions,
  canManage,
  readOnlyPreview,
  editableSalesPersonId = null,
  todayDateKey,
}: {
  salesPeople: SalesPerson[];
  periodsBySalesPerson: Record<string, VacationPeriodRow[]>;
  delegationsBySalesPerson: Record<string, VacationDelegationRow[]>;
  delegateOptions: DelegateOption[];
  canManage: boolean;
  readOnlyPreview: boolean;
  editableSalesPersonId?: string | null;
  todayDateKey: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const today = (() => {
    const [y, m] = todayDateKey.split("-").map(Number);
    return { month: m - 1, year: y };
  })();
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [currentYear, setCurrentYear] = useState(today.year);

  const [selectedPeriod, setSelectedPeriod] = useState<{
    periodId: string;
    salesPersonId: string;
  } | null>(null);
  const [assigningDelegate, setAssigningDelegate] = useState(false);
  const [selectedDelegateId, setSelectedDelegateId] = useState("");

  const [vacationFormOpen, setVacationFormOpen] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    salesPersonId: editableSalesPersonId ?? (salesPeople.length === 1 ? salesPeople[0].id : ""),
    startDate: todayDateKey,
    endDate: addDaysToDateKey(todayDateKey, 14),
    note: "",
  });

  const canEdit = canManage && !readOnlyPreview;
  const canEditPeriod = (spId: string) =>
    canEdit && (!editableSalesPersonId || spId === editableSalesPersonId);
  const colorMap = vacationColorMap(salesPeople);
  const delegateNameById = new Map(delegateOptions.map((d) => [d.id, d.name]));

  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const panelId = useId();

  const selectedPeriodData = selectedPeriod
    ? (() => {
        const periods = periodsBySalesPerson[selectedPeriod.salesPersonId] ?? [];
        const period = periods.find((p) => p.id === selectedPeriod.periodId);
        if (!period) return null;
        const sp = salesPeople.find((s) => s.id === selectedPeriod.salesPersonId);
        const delegations = delegationsBySalesPerson[selectedPeriod.salesPersonId] ?? [];
        const delegation = delegations.find(
          (d) => d.startDate === period.startDate && d.endDate === period.endDate
        ) ?? null;
        return { period, salesPerson: sp, delegation };
      })()
    : null;

  const updatePopoverPos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const measured = panelRef.current?.scrollHeight ?? panelRef.current?.offsetHeight ?? 200;
    setPopoverPos(computeAnchoredDropdownPosition(r, measured, { minWidth: 256 }));
  }, []);

  const closePopover = useCallback(() => {
    setSelectedPeriod(null);
    setAssigningDelegate(false);
    setSelectedDelegateId("");
    setPopoverPos(null);
    anchorRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!selectedPeriod) return;
    updatePopoverPos();
    const raf = requestAnimationFrame(updatePopoverPos);
    const onScroll = () => updatePopoverPos();
    const onResize = () => updatePopoverPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [selectedPeriod, assigningDelegate, updatePopoverPos]);

  useEffect(() => {
    if (!selectedPeriod) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      closePopover();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [selectedPeriod, closePopover]);

  const cells = buildCalendarCells(
    currentYear,
    currentMonth,
    periodsBySalesPerson,
    salesPeople,
    todayDateKey
  );

  const monthHasPeriods = hasAnyPeriodInMonth(currentYear, currentMonth, periodsBySalesPerson);
  const activeSalesPeople = getActiveSalesPeopleInMonth(
    currentYear,
    currentMonth,
    periodsBySalesPerson,
    salesPeople
  );

  const isCurrentMonth =
    currentMonth === today.month && currentYear === today.year;

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.month);
    setCurrentYear(today.year);
  };

  const resetVacationForm = () => {
    setVacationForm({
      salesPersonId: editableSalesPersonId ?? (salesPeople.length === 1 ? salesPeople[0].id : ""),
      startDate: todayDateKey,
      endDate: addDaysToDateKey(todayDateKey, 14),
      note: "",
    });
    setVacationFormOpen(false);
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
    const salesPersonId = editableSalesPersonId ?? vacationForm.salesPersonId;
    if (!salesPersonId) {
      setToast(VACATION_TOAST.missingSalesPerson);
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
      const [vy, vm] = vacationForm.startDate.split("-").map(Number);
      setCurrentMonth(vm - 1);
      setCurrentYear(vy);
      router.refresh();
    });
  };

  const assignDelegate = () => {
    if (!selectedPeriodData || !selectedDelegateId) {
      setToast(VACATION_TOAST.missingDelegate);
      return;
    }
    const { period, salesPerson } = selectedPeriodData;
    if (!salesPerson) return;
    start(async () => {
      const r = await actionSetVacationDelegation({
        salesPersonId: salesPerson.id,
        delegateProfileId: selectedDelegateId,
        startDate: period.startDate,
        endDate: period.endDate,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      setAssigningDelegate(false);
      setSelectedDelegateId("");
      setToast(VACATION_TOAST.savedDelegation);
      closePopover();
      router.refresh();
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
        setToast(VACATION_TOAST.removedDelegation);
      }
      setDeleteTarget(null);
      closePopover();
      router.refresh();
    });
  };

  const onBarClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    periodId: string,
    salesPersonId: string
  ) => {
    e.stopPropagation();
    if (selectedPeriod?.periodId === periodId && selectedPeriod?.salesPersonId === salesPersonId) {
      closePopover();
      return;
    }
    setAssigningDelegate(false);
    setSelectedDelegateId("");
    anchorRef.current = e.currentTarget;
    setSelectedPeriod({ periodId, salesPersonId });
  };

  const popover =
    selectedPeriod && selectedPeriodData && popoverPos && typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        className={cn(
          "fixed z-[70] min-w-[16rem] w-[min(100vw-2rem,20rem)] p-3",
          panelDropdownShellClass
        )}
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
          maxHeight: popoverPos.maxHeight,
        }}
      >
        {(() => {
          const { period, salesPerson: sp, delegation } = selectedPeriodData;
          if (!sp) return null;
          const color = colorMap.get(sp.id);
          const delegateName = delegation
            ? delegateNameById.get(delegation.delegateProfileId) ?? "nieznany"
            : null;

          return (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                {color ? (
                  <span className={cn("h-2.5 w-2.5 rounded-full", color.dot)} />
                ) : null}
                <span className={salesTypography.rowTitle}>{sp.name}</span>
              </div>
              <p className={cn(salesTypography.rowMeta, "font-medium")}>
                {period.startDate} → {period.endDate}
              </p>
              <div className="flex items-center gap-2">
                {statusBadge(period.startDate, period.endDate, todayDateKey)}
              </div>
              {period.note ? (
                <p className="rounded-md bg-slate-50/60 px-2.5 py-1.5 text-xs text-slate-600">{period.note}</p>
              ) : null}

              <div className="border-t border-slate-100 my-1" />

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <IconUsers size={14} className="text-indigo-500" />
                  <span className="text-xs font-medium text-slate-600">Zastępca</span>
                </div>
                {delegation && !assigningDelegate ? (
                  <div className="space-y-1.5">
                    <p className="font-medium text-sm text-slate-800">{delegateName}</p>
                    {canEditPeriod(sp.id) ? (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-indigo-600"
                          onClick={() => {
                            setAssigningDelegate(true);
                            setSelectedDelegateId("");
                          }}
                        >
                          Zmień
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-rose-600"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "delegation",
                              id: delegation.id,
                              label: `zastępcę z urlopu ${period.startDate} → ${period.endDate}`,
                            })
                          }
                          disabled={pending}
                        >
                          Usuń zastępcę
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : assigningDelegate ? (
                  <div className="space-y-2">
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200/40"
                      value={selectedDelegateId}
                      onChange={(e) => setSelectedDelegateId(e.target.value)}
                    >
                      <option value="">— wybierz zastępcę —</option>
                      {delegateOptions
                        .filter((d) => d.id !== sp.linkedUserId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.email ? `(${d.email})` : ""}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={assignDelegate}
                        disabled={pending}
                      >
                        Przypisz
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => {
                          setAssigningDelegate(false);
                          setSelectedDelegateId("");
                        }}
                      >
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : canEditPeriod(sp.id) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-indigo-600"
                    onClick={() => {
                      setAssigningDelegate(true);
                      setSelectedDelegateId("");
                    }}
                  >
                    Wyznacz zastępcę
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">Brak zastępcy</span>
                )}
              </div>

              {canEditPeriod(sp.id) ? (
                <>
                  <div className="border-t border-slate-100 my-2" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => {
                      setDeleteTarget({
                        kind: "vacation",
                        id: period.id,
                        label: `urlop ${sp.name} (${period.startDate} → ${period.endDate})`,
                      });
                    }}
                  >
                    Usuń urlop
                  </Button>
                </>
              ) : null}
            </div>
          );
        })()}
      </div>
    ) : null;

  return (
    <div>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50/40 p-1">
          <Button variant="ghost" size="sm" onClick={goToPrevMonth} aria-label="Poprzedni miesiąc" className="h-8 w-8 p-0">
            <IconChevronLeft size={16} />
          </Button>
          <span className={cn(salesTypography.blockTitle, "px-1 select-none")}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <Button variant="ghost" size="sm" onClick={goToNextMonth} aria-label="Następny miesiąc" className="h-8 w-8 p-0">
            <IconChevronRight size={16} />
          </Button>
          {!isCurrentMonth ? (
            <Button variant="outline" size="sm" onClick={goToToday} className="ml-1 h-8">
              Dziś
            </Button>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVacationFormOpen((v) => !v)}
            className="h-8"
          >
            {vacationFormOpen ? "Anuluj" : editableSalesPersonId ? "+ Dodaj mój urlop" : "+ Dodaj urlop"}
          </Button>
        ) : null}
      </div>

      {vacationFormOpen && canEdit ? (
        <div className="mb-3 space-y-3 rounded-lg border border-slate-200/80 bg-slate-50/40 p-3.5 shadow-sm shadow-slate-200/40">
          {editableSalesPersonId ? (
            <div className="flex items-center gap-2 rounded-md bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100/60">
              <IconSun size={14} className="shrink-0" />
              Dodajesz urlop dla siebie. Pozostali członkowie grupy widzą go w kalendarzu.
            </div>
          ) : null}
          {salesPeople.length > 1 && !editableSalesPersonId ? (
            <Field label="Handlowiec">
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200/40"
                value={vacationForm.salesPersonId}
                onChange={(e) =>
                  setVacationForm({ ...vacationForm, salesPersonId: e.target.value })
                }
              >
                <option value="">— wybierz handlowca —</option>
                {salesPeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Od">
              <Input
                type="date"
                value={vacationForm.startDate}
                onChange={(e) =>
                  setVacationForm({ ...vacationForm, startDate: e.target.value })
                }
              />
            </Field>
            <Field label="Do">
              <Input
                type="date"
                value={vacationForm.endDate}
                onChange={(e) =>
                  setVacationForm({ ...vacationForm, endDate: e.target.value })
                }
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

      <div className="grid grid-cols-7 rounded-t-lg border-t border-l border-slate-100 bg-slate-50/30">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-r border-slate-100 px-1.5 py-2.5 text-center font-semibold uppercase tracking-wider text-[10px] text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      {!monthHasPeriods ? (
        <div className="grid grid-cols-7 border-l border-slate-100">
          <div className="col-span-7 border-b border-r border-slate-100 rounded-b-lg">
            <EmptyState
              brandAccent
              icon={<IconSun size={28} />}
              title="Brak urlopów w tym miesiącu"
              description={editableSalesPersonId
                ? "Nie masz zaplanowanych urlopów w tym miesiącu. Kliknij „Dodaj mój urlop\" aby zaplanować."
                : "Kliknij ‹ › aby przejść do innego miesiąca."
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 border-l border-slate-100">
          {cells.map((cell, i) => {
            const bgClasses = cn(
              !cell.isCurrentMonth && "bg-slate-50/20",
              cell.isWeekend && cell.isCurrentMonth && "bg-slate-50/25",
              cell.isToday && "bg-sky-50/40 ring-1 ring-inset ring-sky-200/40"
            );

            return (
              <div
                key={cell.dateKey + "-" + i}
                className={cn(
                  "min-h-[3.5rem] border-b border-r border-slate-100 p-1 transition-colors sm:min-h-[6rem] sm:p-1.5",
                  bgClasses
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      cell.isCurrentMonth ? "text-slate-900" : "text-slate-300"
                    )}
                  >
                    {cell.dayOfMonth}
                  </span>
                  {cell.isToday ? (
                    <Badge variant="info" className="text-[9px] uppercase">Dziś</Badge>
                  ) : null}
                </div>
                {cell.isCurrentMonth && cell.periods.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {/* Desktop: bars with names (sm+) */}
                    <div className="hidden sm:block">
                      {cell.periods.slice(0, 3).map((p, idx) => {
                        const c = colorMap.get(p.salesPersonId);
                        if (!c) return null;
                        const isOwn = editableSalesPersonId === p.salesPersonId;
                        return (
                          <button
                            key={p.period.id + "-" + idx}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer transition hover:ring-1 hover:ring-slate-300/50",
                              isOwn && "ring-1 ring-slate-400/30 font-semibold",
                              c.bg,
                              c.text
                            )}
                            onClick={(e) => onBarClick(e, p.period.id, p.salesPersonId)}
                            title={p.salesPersonName}
                          >
                            <span className="truncate">
                              {p.salesPersonName}
                            </span>
                            {(() => {
                              const delegations = delegationsBySalesPerson[p.salesPersonId] ?? [];
                              const hasDelegate = delegations.some(
                                (d) =>
                                  d.startDate === p.period.startDate &&
                                  d.endDate === p.period.endDate
                              );
                              return hasDelegate ? (
                                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                              ) : null;
                            })()}
                          </button>
                        );
                      })}
                      {cell.periods.length > 3 ? (
                        <p className="text-[10px] text-slate-400">
                          +{cell.periods.length - 3} więcej
                        </p>
                      ) : null}
                    </div>
                    {/* Mobile: colored dots (<sm) */}
                    <div className="flex flex-wrap gap-1 sm:hidden">
                      {cell.periods.slice(0, 4).map((p, idx) => {
                        const c = colorMap.get(p.salesPersonId);
                        if (!c) return null;
                        const isOwn = editableSalesPersonId === p.salesPersonId;
                        return (
                          <button
                            key={p.period.id + "-" + idx}
                            type="button"
                            className={cn(
                              "rounded-full cursor-pointer transition hover:ring-1 hover:ring-slate-300/50",
                              isOwn ? "h-2.5 w-2.5 ring-1 ring-slate-400/40" : "h-2 w-2",
                              c.dot
                            )}
                            onClick={(e) => onBarClick(e, p.period.id, p.salesPersonId)}
                            title={p.salesPersonName}
                          />
                        );
                      })}
                      {cell.periods.length > 4 ? (
                        <span className="text-[10px] text-slate-400">
                          +{cell.periods.length - 4}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {activeSalesPeople.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-slate-100 bg-slate-50/30 px-3 py-2">
          {activeSalesPeople.map((sp) => {
            const c = colorMap.get(sp.id);
            if (!c) return null;
            const isOwn = editableSalesPersonId === sp.id;
            return (
              <div key={sp.id} className="flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
                <span className={cn(
                  "text-[10px]",
                  isOwn ? "font-semibold text-slate-700" : "text-slate-500"
                )}>
                  {sp.name}
                  {isOwn ? " (Ty)" : ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {popover ? createPortal(popover, document.body) : null}

      {deleteTarget ? (
        <ConfirmDialog
          open
          tier="stack"
          title={deleteTarget.kind === "vacation" ? "Usunąć urlop?" : "Usunąć zastępcę?"}
          message={`${deleteTarget.label} zostanie usunięty.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => removeItem(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
