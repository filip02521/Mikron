import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { SupplierWithSchedule } from "@/types/database";
import { getVacationMessage } from "@/lib/orders/colors";
import { todayInWarsaw } from "@/lib/time/warsaw";

export const PLAN_PREVIEW_SUPPLIER_LIMIT = 8;

function sortByNextDate(
  entries: { id: string; next: string | null }[]
): { id: string; next: string | null }[] {
  return [...entries].sort((a, b) => {
    if (!a.next && !b.next) return 0;
    if (!a.next) return 1;
    if (!b.next) return -1;
    return a.next.localeCompare(b.next);
  });
}

/** Plan handlowca: najpierw dostawcy z otwartych prośb, potem najbliższe terminy. */
export function pickSalesPlanSupplierIds(
  suppliers: SupplierWithSchedule[],
  prioritySupplierIds: string[],
  limit = PLAN_PREVIEW_SUPPLIER_LIMIT
): Set<string> {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const priorityEntries = prioritySupplierIds
    .map((id) => suppliers.find((s) => s.id === id))
    .filter((s): s is SupplierWithSchedule => Boolean(s))
    .map((s) => ({
      id: s.id,
      next: s.schedule?.computed_next_date ?? null,
    }));

  for (const entry of sortByNextDate(priorityEntries)) {
    if (ordered.length >= limit) break;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    ordered.push(entry.id);
  }

  if (ordered.length < limit) {
    const filler = pickPreviewSupplierIds(
      suppliers.filter((s) => !seen.has(s.id)),
      limit - ordered.length
    );
    for (const id of filler) {
      if (ordered.length >= limit) break;
      ordered.push(id);
    }
  }

  return new Set(ordered);
}

export function pickPreviewSupplierIds(
  suppliers: SupplierWithSchedule[],
  limit = PLAN_PREVIEW_SUPPLIER_LIMIT
): Set<string> {
  const withDate = suppliers
    .map((s) => ({
      id: s.id,
      next: s.schedule?.computed_next_date ?? null,
    }))
    .filter((r): r is { id: string; next: string } => Boolean(r.next));

  withDate.sort((a, b) => a.next.localeCompare(b.next));

  const ids = withDate.slice(0, limit).map((r) => r.id);

  if (ids.length < limit) {
    for (const s of suppliers) {
      if (ids.length >= limit) break;
      if (!ids.includes(s.id)) ids.push(s.id);
    }
  }

  return new Set(ids);
}

export function filterWeekDaysBySupplierIds(
  days: WeekDayPlan[],
  supplierIds: Set<string>
): WeekDayPlan[] {
  return days.map((day) => ({
    ...day,
    items: day.items.filter((item) => supplierIds.has(item.supplierId)),
  }));
}

export function matchSuppliersByQuery(
  suppliers: SupplierWithSchedule[],
  query: string
): SupplierWithSchedule[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return suppliers.filter((s) => s.name.toLowerCase().includes(q));
}

export type SupplierPlanInsight = {
  supplierId: string;
  name: string;
  location: string;
  nextDate: string | null;
  orderDate: string | null;
  vacationNote: string | null;
  weekDayLabel: string | null;
  weekDateLabel: string | null;
  isOverdue: boolean;
};

export function buildSupplierPlanInsight(
  supplier: SupplierWithSchedule,
  days: WeekDayPlan[]
): SupplierPlanInsight {
  const nextDate = supplier.schedule?.computed_next_date ?? null;
  const orderDate = supplier.schedule?.order_date ?? null;
  const vacationNote = supplier.schedule?.vacation_note ?? null;
  const todayStr = formatDateString(todayInWarsaw());

  let weekDayLabel: string | null = null;
  let weekDateLabel: string | null = null;
  let isOverdue = false;

  if (nextDate) {
    isOverdue = nextDate < todayStr;
    for (const day of days) {
      const hit = day.items.find((i) => i.supplierId === supplier.id);
      if (hit) {
        weekDayLabel = day.weekdayLabel;
        weekDateLabel = day.dateLabel;
        break;
      }
    }
    if (!weekDayLabel && parseDateOnly(nextDate)) {
      const d = parseDateOnly(nextDate)!;
      weekDateLabel = formatDateString(d, "dd.MM");
    }
  }

  return {
    supplierId: supplier.id,
    name: supplier.name,
    location: supplier.location,
    nextDate,
    orderDate,
    vacationNote: vacationNote
      ? getVacationMessage(vacationNote as never, parseDateOnly(nextDate)).replace(
          / \(.+\)/,
          ""
        ) || vacationNote
      : null,
    weekDayLabel,
    weekDateLabel,
    isOverdue,
  };
}
