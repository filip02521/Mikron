/** Helpery UI dziennika dostaw — bezpieczne dla klienta (bez I/O Supabase). */

import { startOfMonth, startOfWeek, subDays } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import {
  assertJournalDateReadable,
  type WarehouseDeliveryReceipt,
} from "@/lib/warehouse/delivery-receipts-shared";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  warehouseCarrierLabel,
  type WarehouseCarrier,
} from "@/lib/warehouse/delivery-carriers";

export type DeliveryJournalDatePreset = "today" | "week" | "last7" | "last30" | "last90" | "month";

export type DeliveryJournalSearchFilters = {
  dateFrom: string;
  dateTo: string;
  supplierId?: string | null;
  carrier?: WarehouseCarrier | null;
  /** Nr listu, uwagi, dostawca, kurier — weryfikacja paczki w archiwum. */
  query?: string | null;
};

export type DeliveryJournalRangeSummary = {
  receiptCount: number;
  packageCount: number;
  palletCount: number;
  supplierCount: number;
  byCarrier: Array<{
    carrier: string;
    receiptCount: number;
    packageCount: number;
    palletCount: number;
  }>;
};

export function deliveryJournalPresetRange(
  preset: DeliveryJournalDatePreset,
  at = new Date()
): { dateFrom: string; dateTo: string } {
  const today = todayInWarsaw(at);
  const dateTo = formatDateString(today);
  switch (preset) {
    case "today":
      return { dateFrom: dateTo, dateTo };
    case "week": {
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      return { dateFrom: formatDateString(monday), dateTo };
    }
    case "last7":
      return { dateFrom: formatDateString(subDays(today, 6)), dateTo };
    case "last30":
      return { dateFrom: formatDateString(subDays(today, 29)), dateTo };
    case "last90":
      return { dateFrom: formatDateString(subDays(today, 89)), dateTo };
    case "month":
      return {
        dateFrom: formatDateString(startOfMonth(today)),
        dateTo,
      };
    default:
      return { dateFrom: dateTo, dateTo };
  }
}

export function normalizeJournalSearchQuery(raw: string): string {
  return raw.trim();
}

/** Dopasowanie wpisu dziennika do frazy (nr listu, dostawca, kurier, uwagi). */
export function matchesDeliveryReceiptQuery(
  receipt: WarehouseDeliveryReceipt,
  rawQuery: string
): boolean {
  const q = normalizeJournalSearchQuery(rawQuery).toLowerCase();
  if (!q) return true;
  const haystack = [
    receipt.note,
    receipt.supplierLabel,
    receipt.supplierName,
    warehouseCarrierLabel(receipt.carrier),
    receipt.receivedDate,
    receipt.packageCount > 0 ? `${receipt.packageCount} pacz` : "",
    receipt.palletCount > 0 ? `${receipt.palletCount} pal` : "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function assertJournalSearchRange(
  dateFrom: string,
  dateTo: string,
  opts?: { query?: string | null }
): void {
  assertJournalDateReadable(dateFrom);
  assertJournalDateReadable(dateTo);
  if (dateFrom > dateTo) {
    throw new Error("Data „od” nie może być późniejsza niż „do”.");
  }
  const from = parseDateOnly(dateFrom)!;
  const to = parseDateOnly(dateTo)!;
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const hasQuery = normalizeJournalSearchQuery(opts?.query ?? "").length >= 2;
  const maxDays = hasQuery ? 365 : 93;
  if (spanDays > maxDays) {
    throw new Error(
      hasQuery
        ? `Przy wyszukiwaniu paczki maksymalny zakres to ${maxDays} dni.`
        : `Maksymalny zakres wyszukiwania to ${maxDays} dni.`
    );
  }
}

export function formatJournalPresetLabel(preset: DeliveryJournalDatePreset): string {
  const labels: Record<DeliveryJournalDatePreset, string> = {
    today: "Dziś",
    week: "Ten tydzień",
    last7: "7 dni",
    last30: "30 dni",
    last90: "90 dni",
    month: "Ten miesiąc",
  };
  return labels[preset];
}

export function journalInsightsDefaultRange(): { dateFrom: string; dateTo: string } {
  return deliveryJournalPresetRange("week");
}
