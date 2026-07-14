"use client";

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
  actionSetStaffVacationPeriod,
  actionRemoveStaffVacationPeriod,
  actionUpdateStaffVacationPeriod,
} from "@/app/actions/staff-vacation-periods";
import type { StaffVacationRow, StaffVacationCategory } from "@/lib/data/staff-vacation-periods";
import {
  STAFF_VACATION_CATEGORIES,
  staffVacationCategoryShort,
  staffVacationCategoryLabel,
} from "@/lib/data/staff-vacation-periods";
import { Button } from "@/components/ui/Button";
import { AddButton } from "@/components/ui/AddButton";
import { Field, Input, Select } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconSun,
  IconChevronLeft,
  IconChevronRight,
  IconTrash2,
  IconPencil,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesTypography, panelDropdownShellClass } from "@/lib/ui/ontime-theme";
import { computeAnchoredDropdownPosition } from "@/lib/ui/dropdown-anchor";
import { vacationColorMap } from "@/lib/ui/vacation-colors";
import { VACATION_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";
import type { UserRole } from "@/types/database";

type StaffMember = {
  id: string;
  name: string;
  role: UserRole;
};

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const WEEKDAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"];

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type DayCell = {
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  periods: { period: StaffVacationRow; userId: string; userName: string; isFirstDay: boolean }[];
};

function statusBadge(startDate: string, endDate: string, todayKey: string) {
  if (todayKey < startDate) return <Badge variant="default" className="text-[10px]">Nadchodzący</Badge>;
  if (todayKey > endDate) return <Badge variant="default" className="text-[10px] opacity-60">Zakończony</Badge>;
  return <Badge variant="success" className="text-[10px]">Trwa teraz</Badge>;
}

function formatRangeLabel(startDate: string, endDate: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
    return `${day} ${months[m - 1]} ${y}`;
  };
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

function vacationDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function buildCalendarCells(
  year: number,
  month: number,
  periodsByUser: Record<string, StaffVacationRow[]>,
  staff: StaffMember[],
  todayKey: string,
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

  const allPeriods: { period: StaffVacationRow; userId: string; userName: string }[] = [];
  for (const s of staff) {
    const periods = periodsByUser[s.id] ?? [];
    for (const period of periods) {
      allPeriods.push({ period, userId: s.id, userName: s.name });
    }
  }

  const getPeriodsForDate = (dateKey: string): DayCell["periods"] => {
    const result: DayCell["periods"] = [];
    for (const { period, userId, userName } of allPeriods) {
      if (dateKey >= period.startDate && dateKey <= period.endDate) {
        result.push({ period, userId, userName, isFirstDay: dateKey === period.startDate });
      }
    }
    return result;
  };

  for (let i = 0; i < firstWeekday; i++) {
    const day = prevMonthLastDay - firstWeekday + i + 1;
    const m = month - 1 < 0 ? 11 : month - 1;
    const y = month - 1 < 0 ? year - 1 : year;
    const dateKey = fmtKey(y, m, day);
    cells.push({
      dateKey, dayOfMonth: day, isCurrentMonth: false,
      isWeekend: isWeekend(i), isToday: dateKey === todayKey, periods: [],
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = fmtKey(year, month, d);
    const weekday = (firstWeekday + d - 1) % 7;
    cells.push({
      dateKey, dayOfMonth: d, isCurrentMonth: true,
      isWeekend: isWeekend(weekday), isToday: dateKey === todayKey,
      periods: getPeriodsForDate(dateKey),
    });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - firstWeekday - daysInMonth + 1;
    const m = month + 1 > 11 ? 0 : month + 1;
    const y = month + 1 > 11 ? year + 1 : year;
    const dateKey = fmtKey(y, m, nextDay);
    cells.push({
      dateKey, dayOfMonth: nextDay, isCurrentMonth: false,
      isWeekend: isWeekend(cells.length % 7), isToday: dateKey === todayKey, periods: [],
    });
  }

  return cells;
}

function hasAnyPeriodInMonth(
  year: number,
  month: number,
  periodsByUser: Record<string, StaffVacationRow[]>,
): boolean {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  for (const periods of Object.values(periodsByUser)) {
    for (const p of periods) {
      if (p.startDate <= monthEnd && p.endDate >= monthStart) return true;
    }
  }
  return false;
}

function getActiveStaffInMonth(
  year: number,
  month: number,
  periodsByUser: Record<string, StaffVacationRow[]>,
  staff: StaffMember[],
): StaffMember[] {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  return staff.filter((s) => {
    const periods = periodsByUser[s.id] ?? [];
    return periods.some((p) => p.startDate <= monthEnd && p.endDate >= monthStart);
  });
}

export function StaffVacationCalendar({
  staff,
  periodsByUser,
  currentUserId,
  isAdmin: adminMode,
  todayDateKey,
}: {
  staff: StaffMember[];
  periodsByUser: Record<string, StaffVacationRow[]>;
  currentUserId: string;
  isAdmin: boolean;
  todayDateKey: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const today = (() => {
    const [y, m] = todayDateKey.split("-").map(Number);
    return { month: m - 1, year: y };
  })();
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [currentYear, setCurrentYear] = useState(today.year);

  const [selectedPeriod, setSelectedPeriod] = useState<{
    periodId: string;
    userId: string;
  } | null>(null);
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [editForm, setEditForm] = useState<{
    startDate: string;
    endDate: string;
    category: StaffVacationCategory;
    note: string;
  }>({ startDate: "", endDate: "", category: "urlop", note: "" });

  const [vacationFormOpen, setVacationFormOpen] = useState(false);
  const [vacationForm, setVacationForm] = useState<{
    startDate: string;
    endDate: string;
    category: StaffVacationCategory;
    note: string;
  }>({
    startDate: todayDateKey,
    endDate: addDaysToDateKey(todayDateKey, 14),
    category: "urlop",
    note: "",
  });

  const canEdit = true;
  const colorMap = vacationColorMap(staff);

  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);
  const panelId = useId();

  const selectedPeriodData = selectedPeriod
    ? (() => {
        const periods = periodsByUser[selectedPeriod.userId] ?? [];
        const period = periods.find((p) => p.id === selectedPeriod.periodId);
        if (!period) return null;
        const member = staff.find((s) => s.id === selectedPeriod.userId);
        return { period, member };
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
    setEditingPeriod(false);
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
  }, [selectedPeriod, editingPeriod, updatePopoverPos]);

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
    currentYear, currentMonth, periodsByUser, staff, todayDateKey,
  );

  const monthHasPeriods = hasAnyPeriodInMonth(currentYear, currentMonth, periodsByUser);
  const activeStaff = getActiveStaffInMonth(currentYear, currentMonth, periodsByUser, staff);
  const isCurrentMonth = currentMonth === today.month && currentYear === today.year;

  const goToPrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };
  const goToToday = () => { setCurrentMonth(today.month); setCurrentYear(today.year); };

  const resetVacationForm = () => {
    setVacationForm({ startDate: todayDateKey, endDate: addDaysToDateKey(todayDateKey, 14), category: "urlop", note: "" });
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
    start(async () => {
      const r = await actionSetStaffVacationPeriod({
        userId: currentUserId,
        startDate: vacationForm.startDate,
        endDate: vacationForm.endDate,
        category: vacationForm.category,
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

  const removePeriod = (target: NonNullable<typeof deleteTarget>) => {
    start(async () => {
      const r = await actionRemoveStaffVacationPeriod(target.id);
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      setToast(VACATION_TOAST.removedPeriod);
      setDeleteTarget(null);
      closePopover();
      router.refresh();
    });
  };

  const startEdit = () => {
    if (!selectedPeriodData) return;
    const { period } = selectedPeriodData;
    setEditForm({
      startDate: period.startDate,
      endDate: period.endDate,
      category: period.category,
      note: period.note ?? "",
    });
    setEditingPeriod(true);
  };

  const cancelEdit = () => {
    setEditingPeriod(false);
    setEditForm({ startDate: "", endDate: "", category: "urlop", note: "" });
  };

  const saveEdit = () => {
    if (!selectedPeriodData) return;
    if (!editForm.startDate || !editForm.endDate) {
      setToast(VACATION_TOAST.missingDates);
      return;
    }
    if (editForm.startDate > editForm.endDate) {
      setToast(VACATION_TOAST.invalidDateRange);
      return;
    }
    const periodId = selectedPeriodData.period.id;
    start(async () => {
      const r = await actionUpdateStaffVacationPeriod({
        id: periodId,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        category: editForm.category,
        note: editForm.note || null,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      setToast(VACATION_TOAST.updatedPeriod);
      cancelEdit();
      const [vy, vm] = editForm.startDate.split("-").map(Number);
      setCurrentMonth(vm - 1);
      setCurrentYear(vy);
      closePopover();
      router.refresh();
    });
  };

  const onBarClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    periodId: string,
    userId: string,
  ) => {
    e.stopPropagation();
    if (selectedPeriod?.periodId === periodId && selectedPeriod?.userId === userId) {
      closePopover();
      return;
    }
    anchorRef.current = e.currentTarget;
    setSelectedPeriod({ periodId, userId });
  };

  const popover =
    selectedPeriod && selectedPeriodData && popoverPos && typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        className={cn(
          "fixed z-[70] min-w-[16rem] w-[min(100vw-2rem,20rem)] p-3",
          panelDropdownShellClass,
        )}
        style={{ top: popoverPos.top, left: popoverPos.left, maxHeight: popoverPos.maxHeight }}
      >
        {(() => {
          const { period, member } = selectedPeriodData;
          if (!member) return null;
          const color = colorMap.get(member.id);
          const isOwn = member.id === currentUserId;

          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {color ? (
                  <span className={cn("h-3 w-3 rounded-full ring-2 ring-white", color.dot)} />
                ) : null}
                <span className="text-sm font-semibold text-slate-900">
                  {member.name}
                </span>
                {isOwn ? (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">Ty</span>
                ) : null}
              </div>

              {editingPeriod ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Od">
                      <Input
                        type="date"
                        value={editForm.startDate}
                        onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      />
                    </Field>
                    <Field label="Do">
                      <Input
                        type="date"
                        value={editForm.endDate}
                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Rodzaj">
                    <Select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value as StaffVacationCategory })}
                    >
                      {STAFF_VACATION_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Notatka">
                    <Input
                      type="text"
                      value={editForm.note}
                      maxLength={500}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>Anuluj</Button>
                    <Button size="sm" onClick={saveEdit} disabled={pending}>Zapisz zmiany</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg bg-slate-50/70 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <IconSun size={13} className="shrink-0 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">
                        {formatRangeLabel(period.startDate, period.endDate)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {vacationDuration(period.startDate, period.endDate) === 1
                        ? "1 dzień"
                        : `${vacationDuration(period.startDate, period.endDate)} dni`
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {statusBadge(period.startDate, period.endDate, todayDateKey)}
                    <Badge variant="default" className="text-[10px]">
                      {staffVacationCategoryLabel(period.category)}
                    </Badge>
                  </div>

                  {period.note ? (
                    <div className="rounded-md border border-slate-100 bg-white px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notatka</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{period.note}</p>
                    </div>
                  ) : null}

                  {isOwn || adminMode ? (
                    <>
                      <div className="border-t border-slate-100" />
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/60"
                          onClick={startEdit}
                        >
                          <IconPencil size={14} className="shrink-0" />
                          Edytuj
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50/60"
                          onClick={() => {
                            setDeleteTarget({
                              id: period.id,
                              label: `${staffVacationCategoryLabel(period.category)} • ${formatRangeLabel(period.startDate, period.endDate)}`,
                            });
                          }}
                        >
                          <IconTrash2 size={14} className="shrink-0" />
                          Usuń
                        </Button>
                      </div>
                    </>
                  ) : null}
                </>
              )}
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
          <AddButton
            variant="outline"
            size="sm"
            onClick={() => setVacationFormOpen((v) => !v)}
            className="h-8"
          >
            {vacationFormOpen ? "Anuluj" : "Dodaj mój urlop"}
          </AddButton>
        ) : null}
      </div>

      {vacationFormOpen && canEdit ? (
        <div className="mb-3 space-y-3 rounded-lg border border-slate-200/80 bg-slate-50/40 p-3.5 shadow-sm shadow-slate-200/40">
          <div className="flex items-center gap-2 rounded-md bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100/60">
            <IconSun size={14} className="shrink-0" />
            Dodajesz urlop dla siebie. Pozostali członkowie zespołu widzą go w kalendarzu.
          </div>
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
          <Field label="Rodzaj nieobecności">
            <Select
              value={vacationForm.category}
              onChange={(e) => setVacationForm({ ...vacationForm, category: e.target.value as StaffVacationCategory })}
            >
              {STAFF_VACATION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
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

      <div className="grid grid-cols-7 rounded-t-lg overflow-hidden border-t border-l border-slate-100 bg-slate-50/30">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={cn(
              "border-b border-r border-slate-100 px-1.5 py-2.5 text-center font-semibold uppercase tracking-wider text-[10px]",
              idx >= 5 ? "bg-slate-100/60 text-slate-400" : "text-slate-400"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {!monthHasPeriods ? (
        <div className="grid grid-cols-7 border-l border-slate-100 rounded-b-lg overflow-hidden">
          <div className="col-span-7 border-b border-r border-slate-100 rounded-b-lg">
            <EmptyState
              brandAccent
              icon={<IconSun size={28} />}
              title="Brak urlopów w tym miesiącu"
              description={canEdit
                ? 'Nie masz zaplanowanych urlopów w tym miesiącu. Kliknij „Dodaj mój urlop”, aby zaplanować.'
                : 'Przejdź do innego miesiąca strzałkami ‹ ›.'
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 border-l border-slate-100 rounded-b-lg overflow-hidden">
          {cells.map((cell, i) => {
            const bgClasses = cn(
              !cell.isCurrentMonth && "bg-slate-50/20",
              cell.isWeekend && cell.isCurrentMonth && "bg-slate-100/50",
              cell.isToday && "bg-sky-50/40 ring-1 ring-inset ring-sky-200/40",
            );

            return (
              <div
                key={cell.dateKey + "-" + i}
                className={cn(
                  "min-h-[3.5rem] border-b border-r border-slate-100 p-1 transition-colors sm:min-h-[7.5rem] sm:p-1.5",
                  bgClasses,
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      cell.isCurrentMonth
                        ? cell.isWeekend ? "text-slate-400" : "text-slate-900"
                        : "text-slate-300",
                    )}
                  >
                    {cell.dayOfMonth}
                  </span>
                  {cell.isToday ? (
                    <Badge variant="info" className="text-[9px] uppercase">Dziś</Badge>
                  ) : null}
                </div>
                {cell.isCurrentMonth && cell.periods.length > 0 ? (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {/* Desktop: bars with names (sm+) */}
                    <div className="hidden sm:block">
                      {cell.periods.slice(0, 4).map((p, idx) => {
                        const c = colorMap.get(p.userId);
                        if (!c) return null;
                        const isOwn = p.userId === currentUserId;
                        return (
                          <button
                            key={p.period.id + "-" + idx}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium truncate cursor-pointer transition hover:ring-1 hover:ring-slate-300/50 border border-white/80 shadow-sm",
                              isOwn && "ring-1 ring-slate-400/40 font-semibold",
                              c.bg, c.text,
                            )}
                            onClick={(e) => onBarClick(e, p.period.id, p.userId)}
                            title={`${p.userName} — ${staffVacationCategoryShort(p.period.category)}`}
                          >
                            <span className="truncate">{p.userName}</span>
                            {p.period.category !== "urlop" ? (
                              <span className="ml-0.5 shrink-0 opacity-70">
                                · {staffVacationCategoryShort(p.period.category)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      {cell.periods.length > 4 ? (
                        <p className="text-[10px] font-medium text-slate-500">+{cell.periods.length - 4} więcej</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:hidden">
                      {cell.periods.slice(0, 5).map((p, idx) => {
                        const c = colorMap.get(p.userId);
                        if (!c) return null;
                        const isOwn = p.userId === currentUserId;
                        return (
                          <button
                            key={p.period.id + "-" + idx}
                            type="button"
                            className={cn(
                              "rounded-full cursor-pointer transition hover:ring-1 hover:ring-slate-300/50",
                              isOwn ? "h-3 w-3 ring-1 ring-slate-400/40" : "h-2.5 w-2.5",
                              c.dot,
                            )}
                            onClick={(e) => onBarClick(e, p.period.id, p.userId)}
                            title={`${p.userName} — ${staffVacationCategoryShort(p.period.category)}`}
                          />
                        );
                      })}
                      {cell.periods.length > 5 ? (
                        <span className="text-[10px] font-medium text-slate-500">+{cell.periods.length - 5}</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {activeStaff.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-100 bg-slate-50/40 px-3.5 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Legenda</span>
          {activeStaff.map((s) => {
            const c = colorMap.get(s.id);
            if (!c) return null;
            const isOwn = s.id === currentUserId;
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-white/60", c.dot)} />
                <span className={cn(
                  "text-[11px]",
                  isOwn ? "font-semibold text-slate-700" : "text-slate-500",
                )}>
                  {s.name}
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
          title="Usunąć ten urlop?"
          message={`„${deleteTarget.label}” zostanie usunięty.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => removePeriod(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
