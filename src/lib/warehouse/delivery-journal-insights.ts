import { startOfMonth, startOfWeek, subDays } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import {
  assertJournalDateReadable,
  type WarehouseDeliveryReceipt,
} from "@/lib/warehouse/delivery-receipts";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  normalizeShipmentCounts,
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

function mapSearchRow(row: Record<string, unknown>): WarehouseDeliveryReceipt {
  const suppliers = row.suppliers as { name?: string } | null;
  const supplierName =
    suppliers?.name != null
      ? String(suppliers.name)
      : String(row.supplier_label ?? "").trim() || "—";

  const shipmentForm = String(row.shipment_form) as WarehouseDeliveryReceipt["shipmentForm"];
  const counts = normalizeShipmentCounts(
    shipmentForm,
    Number(row.package_count ?? 0),
    Number(row.pallet_count ?? 0)
  );

  return {
    id: String(row.id),
    receivedDate: String(row.received_date),
    supplierId: row.supplier_id != null ? String(row.supplier_id) : null,
    supplierLabel: String(row.supplier_label ?? ""),
    supplierName,
    carrier: String(row.carrier) as WarehouseDeliveryReceipt["carrier"],
    shipmentForm,
    packageCount: counts.packageCount,
    palletCount: counts.palletCount,
    note: String(row.note ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: String(row.created_by),
  };
}

export async function searchDeliveryReceipts(
  filters: DeliveryJournalSearchFilters
): Promise<WarehouseDeliveryReceipt[]> {
  assertJournalSearchRange(filters.dateFrom, filters.dateTo, {
    query: filters.query,
  });
  const supabase = createAdminClient();
  let q = supabase
    .from("warehouse_delivery_receipts")
    .select(
      "id, received_date, supplier_id, supplier_label, carrier, shipment_form, package_count, pallet_count, note, created_at, updated_at, created_by, suppliers(name)"
    )
    .gte("received_date", filters.dateFrom)
    .lte("received_date", filters.dateTo)
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.supplierId) q = q.eq("supplier_id", filters.supplierId);
  if (filters.carrier) q = q.eq("carrier", filters.carrier);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []).map((r) => mapSearchRow(r as Record<string, unknown>));
  const query = normalizeJournalSearchQuery(filters.query ?? "");
  if (query) {
    rows = rows.filter((r) => matchesDeliveryReceiptQuery(r, query));
  }
  return rows;
}

export async function summarizeDeliveryReceiptsRange(
  filters: DeliveryJournalSearchFilters
): Promise<DeliveryJournalRangeSummary> {
  const rows = await searchDeliveryReceipts(filters);
  const supplierIds = new Set<string>();
  const byCarrier = new Map<
    string,
    { receiptCount: number; packageCount: number; palletCount: number }
  >();

  for (const r of rows) {
    if (r.supplierId) supplierIds.add(r.supplierId);
    else if (r.supplierLabel.trim()) supplierIds.add(`label:${r.supplierLabel.trim()}`);
    const bucket = byCarrier.get(r.carrier) ?? {
      receiptCount: 0,
      packageCount: 0,
      palletCount: 0,
    };
    bucket.receiptCount += 1;
    bucket.packageCount += r.packageCount;
    bucket.palletCount += r.palletCount;
    byCarrier.set(r.carrier, bucket);
  }

  return {
    receiptCount: rows.length,
    packageCount: rows.reduce((s, r) => s + r.packageCount, 0),
    palletCount: rows.reduce((s, r) => s + r.palletCount, 0),
    supplierCount: supplierIds.size,
    byCarrier: [...byCarrier.entries()]
      .map(([carrier, stats]) => ({ carrier, ...stats }))
      .sort((a, b) => b.receiptCount - a.receiptCount),
  };
}

/** Szybkie podsumowanie jednego dnia (bez filtrów dodatkowych). */
export async function summarizeDeliveryDay(dateKey: string) {
  assertJournalDateReadable(dateKey);
  return summarizeDeliveryReceiptsRange({
    dateFrom: dateKey,
    dateTo: dateKey,
  });
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
