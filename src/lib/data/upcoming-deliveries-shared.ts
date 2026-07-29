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

    const scheduled = scheduleByDateKey.get(dateKey) ?? [];
    const overdue =
      dateKey === todayDateKey
        ? [...scheduleByDateKey.entries()]
            .filter(([key]) => key < todayDateKey)
            .flatMap(([, list]) => list)
        : [];

    const allScheduled = [...scheduled, ...overdue];

    days.push({
      dateKey,
      weekdayLabel: SHORT_WEEKDAY_LABELS[dow] ?? "",
      dateLabel: formatDateString(d, "dd.MM"),
      isToday: dateKey === todayDateKey,
      isPast: d < toDateOnly(today) && dateKey !== todayDateKey,
      scheduledSuppliers: allScheduled.sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName, "pl")
      ),
      deliveryDay: deliveryByDateKey.get(dateKey) ?? null,
    });
  }

  return days;
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
