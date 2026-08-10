/** Typy i helpery planu dostaw — bezpieczne dla klienta (bez Supabase). */

import { startOfWeek, addDays } from "date-fns";
import { formatDateString, getMondayOfWeek, parseDateOnly, toDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import type { WarehouseCarrierHint } from "@/lib/warehouse/delivery-receipts-shared";
import type { IndividualOrder, SupplierLocation, SupplierWithSchedule, VacationNote } from "@/types/database";

export type { WarehouseCarrierHint } from "@/lib/warehouse/delivery-receipts-shared";

export type UpcomingDeliveryRangePreset = "week" | "7days" | "14days";

export type UpcomingDeliverySalesPerson = {
  id: string;
  name: string;
  orderCount: number;
};

export type UpcomingDeliverySupplier = {
  supplierId: string;
  supplierName: string;
  zdDocNumber: string | null;
  positionCount: number;
  totalQuantity: number;
  totalDelivered: number;
  salesPeople: UpcomingDeliverySalesPerson[];
  carrierHint: WarehouseCarrierHint | null;
  carrierLabel: string | null;
  orders: IndividualOrder[];
  /** ZD z indeksu bez dopasowanego zamówienia (tylko z Subiekta). */
  zdOnlyDocNumbers: string[];
  /** Termin ZD był wcześniej niż dziś — pokazane w „Dziś” jako zaległe. */
  isOverdueDeadline?: boolean;
};

export type UpcomingDeliveryDay = {
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  isOverdue: boolean;
  suppliers: UpcomingDeliverySupplier[];
};

export type UpcomingDeliverySummary = {
  dayCount: number;
  supplierCount: number;
  positionCount: number;
  estimatedPackages: number;
  estimatedPallets: number;
};

export type DeliveryScheduleSupplier = {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  isScheduled: boolean;
  isOverduePlan: boolean;
  /** `computed_next_date` — do odznaczania planu po cleared ZD na ten termin. */
  planDateKey: string;
  vacationNote: VacationNote | null;
};

export type DeliveryScheduleDay = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  isPast: boolean;
  scheduledSuppliers: DeliveryScheduleSupplier[];
  deliveryDay: UpcomingDeliveryDay | null;
};

export type ExtendedDeliverySummary = UpcomingDeliverySummary & {
  scheduledSupplierCount: number;
  todayDeliveryCount: number;
  todayScheduledCount: number;
};

export function upcomingDeliveryPresetRange(
  preset: UpcomingDeliveryRangePreset,
  at: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const today = todayInWarsaw(at);
  switch (preset) {
    case "week": {
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      const sunday = addDays(monday, 6);
      return { dateFrom: formatDateString(monday), dateTo: formatDateString(sunday) };
    }
    case "7days": {
      const end = addDays(today, 6);
      return { dateFrom: formatDateString(today), dateTo: formatDateString(end) };
    }
    case "14days": {
      const end = addDays(today, 13);
      return { dateFrom: formatDateString(today), dateTo: formatDateString(end) };
    }
    default:
      return { dateFrom: formatDateString(today), dateTo: formatDateString(today) };
  }
}

export function summarizeUpcomingDeliveries(
  days: UpcomingDeliveryDay[]
): UpcomingDeliverySummary {
  const supplierIds = new Set<string>();
  let positionCount = 0;
  let estimatedPackages = 0;
  let estimatedPallets = 0;

  for (const day of days) {
    for (const supplier of day.suppliers) {
      supplierIds.add(supplier.supplierId);
      positionCount += supplier.positionCount;
      if (supplier.carrierHint) {
        estimatedPackages += supplier.carrierHint.typicalPackageCount;
        estimatedPallets += supplier.carrierHint.typicalPalletCount;
      }
    }
  }

  return {
    dayCount: days.length,
    supplierCount: supplierIds.size,
    positionCount,
    estimatedPackages,
    estimatedPallets,
  };
}

const SHORT_WEEKDAY_LABELS = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

/** Scala dwie karty tego samego dostawcy (dziś + zaległy termin). */
export function mergeUpcomingDeliverySuppliers(
  a: UpcomingDeliverySupplier,
  b: UpcomingDeliverySupplier
): UpcomingDeliverySupplier {
  const orderIds = new Set(a.orders.map((o) => o.id));
  const orders = [...a.orders];
  for (const o of b.orders) {
    if (!orderIds.has(o.id)) {
      orderIds.add(o.id);
      orders.push(o);
    }
  }
  const salesMap = new Map<string, UpcomingDeliverySalesPerson>();
  for (const sp of [...a.salesPeople, ...b.salesPeople]) {
    const existing = salesMap.get(sp.id);
    if (existing) existing.orderCount += sp.orderCount;
    else salesMap.set(sp.id, { ...sp });
  }
  const zdOnly = new Set([
    ...(a.zdOnlyDocNumbers ?? []),
    ...(b.zdOnlyDocNumbers ?? []),
  ]);
  for (const o of orders) {
    const nr = o.zd_fulfillment_dok_nr?.trim();
    if (nr) zdOnly.delete(nr);
  }
  return {
    supplierId: a.supplierId,
    supplierName: a.supplierName || b.supplierName,
    zdDocNumber: a.zdDocNumber ?? b.zdDocNumber,
    positionCount: orders.length || a.positionCount + b.positionCount,
    totalQuantity: a.totalQuantity + b.totalQuantity,
    totalDelivered: a.totalDelivered + b.totalDelivered,
    salesPeople: [...salesMap.values()].sort((x, y) =>
      x.name.localeCompare(y.name, "pl")
    ),
    carrierHint: a.carrierHint ?? b.carrierHint,
    carrierLabel: a.carrierLabel ?? b.carrierLabel,
    orders,
    zdOnlyDocNumbers: [...zdOnly],
    isOverdueDeadline: Boolean(a.isOverdueDeadline || b.isOverdueDeadline),
  };
}

/**
 * Dla kolumny „Dziś”: dołącz dostawców z zaległych terminów ZD
 * (analogicznie do zaległych pozycji planowych z harmonogramu).
 */
export function deliveryDayForScheduleDate(
  dateKey: string,
  todayDateKey: string,
  deliveryByDateKey: ReadonlyMap<string, UpcomingDeliveryDay>,
  fallbackDateLabel: string,
  fallbackWeekdayLabel: string
): UpcomingDeliveryDay | null {
  if (dateKey !== todayDateKey) {
    return deliveryByDateKey.get(dateKey) ?? null;
  }

  const today = deliveryByDateKey.get(todayDateKey);
  const byId = new Map<string, UpcomingDeliverySupplier>();
  for (const s of today?.suppliers ?? []) {
    byId.set(s.supplierId, { ...s, isOverdueDeadline: false });
  }
  for (const [key, day] of deliveryByDateKey) {
    if (!(key < todayDateKey)) continue;
    for (const s of day.suppliers) {
      const stamped: UpcomingDeliverySupplier = {
        ...s,
        isOverdueDeadline: true,
      };
      const existing = byId.get(s.supplierId);
      if (!existing) byId.set(s.supplierId, stamped);
      else byId.set(s.supplierId, mergeUpcomingDeliverySuppliers(existing, stamped));
    }
  }

  if (byId.size === 0) return today ?? null;

  return {
    dateKey: todayDateKey,
    dateLabel: today?.dateLabel ?? fallbackDateLabel,
    weekdayLabel: today?.weekdayLabel ?? fallbackWeekdayLabel,
    isToday: true,
    isOverdue: [...byId.values()].some((s) => s.isOverdueDeadline),
    suppliers: [...byId.values()].sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName, "pl")
    ),
  };
}

export function buildDeliveryScheduleWeek(
  schedules: SupplierWithSchedule[],
  deliveryDays: UpcomingDeliveryDay[],
  todayDateKey: string,
  weekStartDateKey?: string
): DeliveryScheduleDay[] {
  const today = parseDateOnly(todayDateKey);
  if (!today) return [];

  const weekStart = weekStartDateKey
    ? parseDateOnly(weekStartDateKey)
    : today;
  if (!weekStart) return [];

  const monday = getMondayOfWeek(weekStart);
  const deliveryByDateKey = new Map<string, UpcomingDeliveryDay>();
  for (const dd of deliveryDays) {
    deliveryByDateKey.set(dd.dateKey, dd);
  }

  const scheduleByDateKey = new Map<string, DeliveryScheduleSupplier[]>();
  for (const s of schedules) {
    if (isSupplierOrderOnDemand(s)) continue;
    const nextDate = s.schedule?.computed_next_date?.trim();
    if (!nextDate) continue;
    const list = scheduleByDateKey.get(nextDate) ?? [];
    list.push({
      supplierId: s.id,
      supplierName: s.name,
      location: s.location,
      isScheduled: true,
      isOverduePlan: nextDate < todayDateKey,
      planDateKey: nextDate,
      vacationNote: s.schedule?.vacation_note ?? null,
    });
    scheduleByDateKey.set(nextDate, list);
  }

  const days: DeliveryScheduleDay[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateKey = formatDateString(d);
    const dow = d.getDay();
    const dateLabel = formatDateString(d, "dd.MM");
    const weekdayLabel = SHORT_WEEKDAY_LABELS[dow] ?? "";

    const scheduled = scheduleByDateKey.get(dateKey) ?? [];
    const overdue =
      dateKey === todayDateKey
        ? [...scheduleByDateKey.entries()]
            .filter(([key]) => key < todayDateKey)
            .flatMap(([, list]) => list)
        : [];

    const deliveryDay = deliveryDayForScheduleDate(
      dateKey,
      todayDateKey,
      deliveryByDateKey,
      dateLabel,
      weekdayLabel
    );

    // Nie dubluj karty planowej, gdy jest już karta ZD tego dostawcy.
    const zdIds = new Set(
      (deliveryDay?.suppliers ?? []).map((s) => s.supplierId)
    );
    const allScheduled = [...scheduled, ...overdue].filter(
      (s) => !zdIds.has(s.supplierId)
    );

    // Unikalni po supplierId (zaległy plan + plan na dziś).
    const uniqueScheduled = new Map<string, DeliveryScheduleSupplier>();
    for (const s of allScheduled) {
      const prev = uniqueScheduled.get(s.supplierId);
      if (!prev || s.isOverduePlan) uniqueScheduled.set(s.supplierId, s);
    }

    days.push({
      dateKey,
      weekdayLabel,
      dateLabel,
      isToday: dateKey === todayDateKey,
      isPast: d < toDateOnly(today) && dateKey !== todayDateKey,
      scheduledSuppliers: [...uniqueScheduled.values()].sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName, "pl")
      ),
      deliveryDay,
    });
  }

  return days;
}

/**
 * Snapshot „Dziś” niezależny od siatki Pn–Pt (np. sobota/niedziela,
 * gdy w tygodniu roboczym nie ma kolumny isToday).
 */
export function buildDeliveryTodayDay(
  schedules: SupplierWithSchedule[],
  deliveryDays: UpcomingDeliveryDay[],
  todayDateKey: string
): DeliveryScheduleDay | null {
  const today = parseDateOnly(todayDateKey);
  if (!today) return null;

  const deliveryByDateKey = new Map<string, UpcomingDeliveryDay>();
  for (const dd of deliveryDays) {
    deliveryByDateKey.set(dd.dateKey, dd);
  }

  const dateLabel = formatDateString(today, "dd.MM");
  const weekdayLabel = SHORT_WEEKDAY_LABELS[today.getDay()] ?? "";
  const deliveryDay = deliveryDayForScheduleDate(
    todayDateKey,
    todayDateKey,
    deliveryByDateKey,
    dateLabel,
    weekdayLabel
  );

  const zdIds = new Set((deliveryDay?.suppliers ?? []).map((s) => s.supplierId));
  const uniqueScheduled = new Map<string, DeliveryScheduleSupplier>();
  for (const s of schedules) {
    if (isSupplierOrderOnDemand(s)) continue;
    const nextDate = s.schedule?.computed_next_date?.trim();
    if (!nextDate || nextDate > todayDateKey) continue;
    if (zdIds.has(s.id)) continue;
    const row: DeliveryScheduleSupplier = {
      supplierId: s.id,
      supplierName: s.name,
      location: s.location,
      isScheduled: true,
      isOverduePlan: nextDate < todayDateKey,
      planDateKey: nextDate,
      vacationNote: s.schedule?.vacation_note ?? null,
    };
    const prev = uniqueScheduled.get(s.id);
    if (!prev || row.isOverduePlan) uniqueScheduled.set(s.id, row);
  }

  return {
    dateKey: todayDateKey,
    weekdayLabel,
    dateLabel,
    isToday: true,
    isPast: false,
    scheduledSuppliers: [...uniqueScheduled.values()].sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName, "pl")
    ),
    deliveryDay,
  };
}

/**
 * Czy w dzienniku przyjęć jest wpis dla dostawcy w oknie [deadline, today]
 * (termin ZD wczoraj + przyjęcie dziś = odznaczenie częściowe).
 */
export function journalHasReceiptForDeadline(
  receiptDatesBySupplier: ReadonlyMap<string, ReadonlySet<string>>,
  deadlineDateKey: string,
  supplierId: string,
  todayKey: string
): boolean {
  const dates = receiptDatesBySupplier.get(supplierId);
  if (!dates || dates.size === 0) return false;
  for (const received of dates) {
    if (received >= deadlineDateKey && received <= todayKey) return true;
  }
  return false;
}

export function summarizeDeliverySchedule(
  summary: UpcomingDeliverySummary,
  weekDays: DeliveryScheduleDay[]
): ExtendedDeliverySummary {
  const supplierIds = new Set<string>();
  let todayDeliveryCount = 0;
  let todayScheduledCount = 0;

  for (const day of weekDays) {
    for (const s of day.scheduledSuppliers) {
      supplierIds.add(s.supplierId);
    }
    if (day.isToday) {
      todayDeliveryCount = day.deliveryDay?.suppliers.length ?? 0;
      todayScheduledCount = day.scheduledSuppliers.length;
    }
  }

  return {
    ...summary,
    scheduledSupplierCount: supplierIds.size,
    todayDeliveryCount,
    todayScheduledCount,
  };
}

/** Ukryj karty planowe na dziś po dzienniku (dziś) lub cleared ZD na termin planu. */
export function hideScheduledReceivedToday(
  weekDays: DeliveryScheduleDay[],
  journalReceivedTodayIds: readonly string[],
  clearedSupplierIdsByDate?: ReadonlyMap<string, ReadonlySet<string>>
): DeliveryScheduleDay[] {
  const journal = new Set(journalReceivedTodayIds);
  const hasCleared = Boolean(clearedSupplierIdsByDate && clearedSupplierIdsByDate.size > 0);
  if (!journal.size && !hasCleared) return weekDays;

  return weekDays.map((day) => {
    if (!day.isToday) return day;
    const filtered = day.scheduledSuppliers.filter((s) => {
      if (journal.has(s.supplierId)) return false;
      if (clearedSupplierIdsByDate?.get(s.planDateKey)?.has(s.supplierId)) return false;
      return true;
    });
    if (filtered.length === day.scheduledSuppliers.length) return day;
    return { ...day, scheduledSuppliers: filtered };
  });
}

/** Buduje mapę cleared z payloadu (JSON). */
export function clearedSupplierIdsByDateFromPayload(
  payload: Record<string, string[]> | null | undefined
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!payload) return map;
  for (const [dateKey, ids] of Object.entries(payload)) {
    map.set(dateKey, new Set(ids));
  }
  return map;
}
