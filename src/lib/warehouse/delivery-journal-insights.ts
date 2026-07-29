import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeShipmentCounts } from "@/lib/warehouse/delivery-carriers";
import {
  assertJournalDateReadable,
  type WarehouseDeliveryReceipt,
} from "@/lib/warehouse/delivery-receipts-shared";
import {
  assertJournalSearchRange,
  matchesDeliveryReceiptQuery,
  normalizeJournalSearchQuery,
  type DeliveryJournalRangeSummary,
  type DeliveryJournalSearchFilters,
} from "@/lib/warehouse/delivery-journal-shared";

export type {
  DeliveryJournalDatePreset,
  DeliveryJournalRangeSummary,
  DeliveryJournalSearchFilters,
} from "@/lib/warehouse/delivery-journal-shared";
export {
  assertJournalSearchRange,
  deliveryJournalPresetRange,
  formatJournalPresetLabel,
  journalInsightsDefaultRange,
  matchesDeliveryReceiptQuery,
  normalizeJournalSearchQuery,
} from "@/lib/warehouse/delivery-journal-shared";

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
