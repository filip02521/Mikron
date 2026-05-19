import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";

const DAY_NAMES = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

export type WeekPlanShiftChange = {
  supplierId: string;
  manualDateIso: string;
  supplierName: string;
  fromDateKey: string;
  toDateKey: string;
};

export function cloneWeekDays(days: WeekDayPlan[]): WeekDayPlan[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));
}

/** supplierId → kolumna (dateKey) w której karta leży. */
export function buildPlacementMap(days: WeekDayPlan[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const day of days) {
    for (const item of day.items) {
      map.set(item.supplierId, day.dateKey);
    }
  }
  return map;
}

function plannerNoteForDate(dateKey: string, vacationNote: string | null): string {
  const d = parseDateOnly(dateKey);
  if (!d) return dateKey;
  const dow = d.getDay();
  const dayLabel = `${DAY_NAMES[dow]} (${formatDateString(d, "dd.MM")})`;
  if (vacationNote?.trim()) {
    return `${dayLabel} · ${vacationNote}`;
  }
  return dayLabel;
}

/** Przenosi dostawcę do kolumny docelowej (tylko w draftcie UI). */
export function movePlannerItem(
  days: WeekDayPlan[],
  supplierId: string,
  targetDateKey: string
): WeekDayPlan[] {
  let movedItem: SummaryStandardItem | undefined;

  const stripped = days.map((day) => {
    const found = day.items.find((i) => i.supplierId === supplierId);
    if (!found) return day;
    movedItem = { ...found };
    return {
      ...day,
      items: day.items.filter((i) => i.supplierId !== supplierId),
    };
  });

  if (!movedItem) return days;

  const targetIdx = stripped.findIndex((d) => d.dateKey === targetDateKey);
  if (targetIdx < 0) return days;

  const updatedItem: SummaryStandardItem = {
    ...movedItem,
    notes: plannerNoteForDate(targetDateKey, movedItem.vacationNote),
  };

  return stripped.map((day, i) => {
    if (i !== targetIdx) return day;
    const items = [...day.items, updatedItem].sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName, "pl")
    );
    return { ...day, items };
  });
}

export function collectPlanShiftChanges(
  original: Map<string, string>,
  currentDays: WeekDayPlan[]
): WeekPlanShiftChange[] {
  const current = buildPlacementMap(currentDays);
  const changes: WeekPlanShiftChange[] = [];

  for (const [supplierId, fromDateKey] of original) {
    const toDateKey = current.get(supplierId);
    if (!toDateKey || toDateKey === fromDateKey) continue;
    const item = currentDays
      .flatMap((d) => d.items)
      .find((i) => i.supplierId === supplierId);
    if (!item) continue;
    changes.push({
      supplierId,
      manualDateIso: toDateKey,
      supplierName: item.supplierName,
      fromDateKey,
      toDateKey,
    });
  }

  return changes.sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl")
  );
}

export function canDropOnDay(day: WeekDayPlan): boolean {
  return !day.isPast || day.isToday;
}
