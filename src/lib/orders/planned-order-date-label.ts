import { formatDateString, getMondayOfWeek, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";

const WEEKDAY_LABELS = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

export type PlannedOrderDateDisplay = {
  caption: string;
  label: string;
  badgeVariant: "default" | "info" | "warning";
  title?: string;
};

export function buildPlannedOrderDateDisplay(input: {
  computedNextDate: string | null;
  orderOnDemand: boolean;
  todayDateKey?: string;
  weekDays?: WeekDayPlan[];
  supplierId?: string;
}): PlannedOrderDateDisplay | null {
  if (input.orderOnDemand) {
    return {
      caption: "Planowe zamówienie",
      label: "Na żądanie",
      badgeVariant: "default",
      title: "Dostawca zamawiany na żądanie — bez stałego terminu w kalendarzu.",
    };
  }

  const nextDate = input.computedNextDate?.trim();
  if (!nextDate) return null;

  const todayStr = input.todayDateKey ?? formatDateString(todayInWarsaw());
  const isOverdue = nextDate < todayStr;
  const isToday = nextDate === todayStr;

  let weekDayLabel: string | null = null;
  let weekDateLabel: string | null = null;
  if (input.weekDays && input.supplierId) {
    for (const day of input.weekDays) {
      if (day.items.some((item) => item.supplierId === input.supplierId)) {
        weekDayLabel = day.weekdayLabel;
        weekDateLabel = day.dateLabel;
        break;
      }
    }
  }

  const parsed = parseDateOnly(nextDate);
  const fallbackDateLabel = parsed ? formatDateString(parsed, "dd.MM") : nextDate;
  const dateLabel = weekDateLabel ?? fallbackDateLabel;

  if (isOverdue) {
    return {
      caption: "Planowe zamówienie",
      label: `Minął termin · ${dateLabel}`,
      badgeVariant: "warning",
      title: `Termin planowy minął ${dateLabel}. Zamówienie mogło już zostać złożone.`,
    };
  }

  if (isToday) {
    return {
      caption: "Planowe zamówienie",
      label: `Dziś · ${dateLabel}`,
      badgeVariant: "info",
      title: "Dziś przypada planowe zamówienie u tego dostawcy.",
    };
  }

  if (weekDayLabel && weekDateLabel) {
    return {
      caption: "Planowe zamówienie",
      label: `${weekDayLabel} ${weekDateLabel}`,
      badgeVariant: "info",
      title: `Planowe zamówienie u dostawcy: ${weekDayLabel} ${weekDateLabel}.`,
    };
  }

  const longLabel = parsed ? formatDateString(parsed, "dd.MM.yyyy") : nextDate;
  return {
    caption: "Planowe zamówienie",
    label: longLabel,
    badgeVariant: "info",
    title: `Planowe zamówienie u dostawcy: ${longLabel}.`,
  };
}

/** Lekki plan tygodnia (Pn–Pt) do etykiet planowej daty — bez pełnego workspace. */
export function buildWeekDayPlansFromSupplierSchedules(
  schedules: Array<{ supplierId: string; computedNextDate: string | null }>,
  todayDateKey: string
): WeekDayPlan[] {
  const today = parseDateOnly(todayDateKey);
  if (!today) return [];

  const monday = getMondayOfWeek(today);
  const days: WeekDayPlan[] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateKey = formatDateString(d);
    const dow = d.getDay();

    const items = schedules
      .filter((entry) => entry.computedNextDate === dateKey)
      .map(
        (entry) =>
          ({
            kind: "standard",
            supplierId: entry.supplierId,
          }) as WeekDayPlan["items"][number]
      );

    days.push({
      dateKey,
      weekdayLabel: WEEKDAY_LABELS[dow] ?? "",
      dateLabel: formatDateString(d, "dd.MM"),
      isToday: dateKey === todayDateKey,
      isPast: dateKey < todayDateKey,
      items,
    });
  }

  return days;
}
