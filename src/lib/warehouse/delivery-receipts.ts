import { addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { warsawNowParts } from "@/lib/time/warsaw";
import {
  normalizeShipmentCounts,
  type WarehouseCarrier,
  type WarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";

export type WarehouseDeliveryReceipt = {
  id: string;
  receivedDate: string;
  supplierId: string | null;
  supplierLabel: string;
  supplierName: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: number;
  palletCount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type WarehouseDeliveryDaySummary = {
  receiptCount: number;
  packageCount: number;
  palletCount: number;
};

export type WarehouseCarrierHint = {
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  typicalPackageCount: number;
  typicalPalletCount: number;
  useCount: number;
  source: "default" | "learned";
};

function mapRow(row: Record<string, unknown>): WarehouseDeliveryReceipt {
  const suppliers = row.suppliers as { name?: string } | null;
  const supplierName =
    suppliers?.name != null
      ? String(suppliers.name)
      : String(row.supplier_label ?? "").trim() || "—";

  const shipmentForm = String(row.shipment_form) as WarehouseShipmentForm;
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
    carrier: String(row.carrier) as WarehouseCarrier,
    shipmentForm,
    packageCount: counts.packageCount,
    palletCount: counts.palletCount,
    note: String(row.note ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: String(row.created_by),
  };
}

export function warsawTodayDateKey(date = new Date()): string {
  return warsawNowParts(date).dateKey;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseJournalDateKey(value: string): string | null {
  if (!DATE_KEY_RE.test(value)) return null;
  return parseDateOnly(value) ? value : null;
}

export function shiftJournalDateKey(dateKey: string, deltaDays: number): string {
  const parsed = parseJournalDateKey(dateKey);
  if (!parsed) throw new Error("Nieprawidłowa data.");
  return formatDateString(addDays(parseDateOnly(parsed)!, deltaDays));
}

export function assertJournalDateReadable(dateKey: string): void {
  const parsed = parseJournalDateKey(dateKey);
  if (!parsed) throw new Error("Nieprawidłowa data.");
  if (parsed > warsawTodayDateKey()) {
    throw new Error("Nie można przeglądać przyszłych dat.");
  }
}

export async function fetchDeliveryDatesWithEntries(limit = 31): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_delivery_receipts")
    .select("received_date")
    .order("received_date", { ascending: false })
    .limit(Math.min(500, Math.max(limit * 20, 60)));
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data ?? []) {
    const key = String(row.received_date);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchDeliveryReceiptsForDate(
  receivedDate: string
): Promise<WarehouseDeliveryReceipt[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_delivery_receipts")
    .select(
      "id, received_date, supplier_id, supplier_label, carrier, shipment_form, package_count, pallet_count, note, created_at, updated_at, created_by, suppliers(name)"
    )
    .eq("received_date", receivedDate)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function summarizeDeliveryReceiptsForDate(
  receivedDate: string
): Promise<WarehouseDeliveryDaySummary> {
  const rows = await fetchDeliveryReceiptsForDate(receivedDate);
  return {
    receiptCount: rows.length,
    packageCount: rows.reduce((s, r) => s + r.packageCount, 0),
    palletCount: rows.reduce((s, r) => s + r.palletCount, 0),
  };
}

async function fetchLearnedCarrierHint(
  supplierId: string
): Promise<WarehouseCarrierHint | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_carrier_hints")
    .select(
      "carrier, shipment_form, typical_package_count, typical_pallet_count, use_count, last_used_at"
    )
    .eq("supplier_id", supplierId);
  if (error) throw new Error(error.message);
  if (!data?.length) return null;

  type HintRow = (typeof data)[number];
  const carrierScore = new Map<string, number>();
  for (const row of data) {
    const carrier = String(row.carrier);
    carrierScore.set(carrier, (carrierScore.get(carrier) ?? 0) + Number(row.use_count ?? 0));
  }
  const dominantCarrier = [...carrierScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!dominantCarrier) return null;

  const forCarrier = data.filter((r) => String(r.carrier) === dominantCarrier) as HintRow[];
  const best = forCarrier.sort((a, b) => {
    const uc = Number(b.use_count ?? 0) - Number(a.use_count ?? 0);
    if (uc !== 0) return uc;
    return String(b.last_used_at ?? "").localeCompare(String(a.last_used_at ?? ""));
  })[0];
  if (!best) return null;

  return {
    carrier: String(best.carrier) as WarehouseCarrier,
    shipmentForm: String(best.shipment_form) as WarehouseShipmentForm,
    typicalPackageCount: Number(best.typical_package_count ?? 1),
    typicalPalletCount: Number(best.typical_pallet_count ?? 0),
    useCount: carrierScore.get(dominantCarrier) ?? Number(best.use_count ?? 1),
    source: "learned",
  };
}

export async function fetchCarrierHintForSupplier(
  supplierId: string
): Promise<WarehouseCarrierHint | null> {
  const supabase = createAdminClient();
  const { data: supplier, error: supplierError } = await supabase
    .from("suppliers")
    .select("default_delivery_carrier, default_delivery_shipment_form")
    .eq("id", supplierId)
    .maybeSingle();
  if (supplierError) throw new Error(supplierError.message);

  const learned = await fetchLearnedCarrierHint(supplierId);
  const defaultCarrier = supplier?.default_delivery_carrier
    ? (String(supplier.default_delivery_carrier) as WarehouseCarrier)
    : null;
  if (!defaultCarrier) return learned;

  const defaultForm = supplier?.default_delivery_shipment_form
    ? (String(supplier.default_delivery_shipment_form) as WarehouseShipmentForm)
    : learned?.shipmentForm ?? "paczki";

  return {
    carrier: defaultCarrier,
    shipmentForm: defaultForm,
    typicalPackageCount: learned?.typicalPackageCount ?? 1,
    typicalPalletCount: learned?.typicalPalletCount ?? 0,
    useCount: learned?.useCount ?? 0,
    source: "default",
  };
}

async function upsertCarrierHint(input: {
  supplierId: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: number;
  palletCount: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("warehouse_carrier_hints")
    .select("use_count, typical_package_count, typical_pallet_count")
    .eq("supplier_id", input.supplierId)
    .eq("carrier", input.carrier)
    .eq("shipment_form", input.shipmentForm)
    .maybeSingle();

  const useCount = Number(existing?.use_count ?? 0) + 1;
  const { error } = await supabase.from("warehouse_carrier_hints").upsert(
    {
      supplier_id: input.supplierId,
      carrier: input.carrier,
      shipment_form: input.shipmentForm,
      typical_package_count: input.packageCount,
      typical_pallet_count: input.palletCount,
      use_count: useCount,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id,carrier,shipment_form" }
  );
  if (error) throw new Error(error.message);
}

export async function createDeliveryReceipt(input: {
  receivedDate: string;
  supplierId: string | null;
  supplierLabel?: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: number;
  palletCount: number;
  note?: string;
  createdBy: string;
}): Promise<WarehouseDeliveryReceipt> {
  const counts = normalizeShipmentCounts(
    input.shipmentForm,
    input.packageCount,
    input.palletCount
  );
  if (counts.packageCount <= 0 && counts.palletCount <= 0) {
    throw new Error("Podaj liczbę paczek lub palet (co najmniej 1).");
  }
  if (!input.supplierId && !input.supplierLabel?.trim()) {
    throw new Error("Wybierz dostawcę lub wpisz nazwę.");
  }

  const supabase = createAdminClient();
  const at = new Date().toISOString();
  const { data, error } = await supabase
    .from("warehouse_delivery_receipts")
    .insert({
      received_date: input.receivedDate,
      supplier_id: input.supplierId,
      supplier_label: input.supplierLabel?.trim() ?? "",
      carrier: input.carrier,
      shipment_form: input.shipmentForm,
      package_count: counts.packageCount,
      pallet_count: counts.palletCount,
      note: input.note?.trim() ?? "",
      created_by: input.createdBy,
      updated_by: input.createdBy,
      created_at: at,
      updated_at: at,
    })
    .select(
      "id, received_date, supplier_id, supplier_label, carrier, shipment_form, package_count, pallet_count, note, created_at, updated_at, created_by, suppliers(name)"
    )
    .single();
  if (error) throw new Error(error.message);

  if (input.supplierId) {
    await upsertCarrierHint({
      supplierId: input.supplierId,
      carrier: input.carrier,
      shipmentForm: input.shipmentForm,
      packageCount: counts.packageCount,
      palletCount: counts.palletCount,
    });
  }

  return mapRow(data as Record<string, unknown>);
}

export async function updateDeliveryReceipt(input: {
  id: string;
  receivedDate: string;
  supplierId: string | null;
  supplierLabel?: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: number;
  palletCount: number;
  note?: string;
  updatedBy: string;
}): Promise<WarehouseDeliveryReceipt> {
  const today = warsawTodayDateKey();
  if (input.receivedDate !== today) {
    throw new Error("Można edytować tylko wpisy z dzisiejszej daty.");
  }
  const counts = normalizeShipmentCounts(
    input.shipmentForm,
    input.packageCount,
    input.palletCount
  );
  if (counts.packageCount <= 0 && counts.palletCount <= 0) {
    throw new Error("Podaj liczbę paczek lub palet (co najmniej 1).");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_delivery_receipts")
    .update({
      supplier_id: input.supplierId,
      supplier_label: input.supplierLabel?.trim() ?? "",
      carrier: input.carrier,
      shipment_form: input.shipmentForm,
      package_count: counts.packageCount,
      pallet_count: counts.palletCount,
      note: input.note?.trim() ?? "",
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("received_date", today)
    .select(
      "id, received_date, supplier_id, supplier_label, carrier, shipment_form, package_count, pallet_count, note, created_at, updated_at, created_by, suppliers(name)"
    )
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nie znaleziono wpisu lub minął dzień edycji.");

  if (input.supplierId) {
    await upsertCarrierHint({
      supplierId: input.supplierId,
      carrier: input.carrier,
      shipmentForm: input.shipmentForm,
      packageCount: counts.packageCount,
      palletCount: counts.palletCount,
    });
  }

  return mapRow(data as Record<string, unknown>);
}

export async function deleteDeliveryReceipt(id: string): Promise<void> {
  const today = warsawTodayDateKey();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("warehouse_delivery_receipts")
    .delete()
    .eq("id", id)
    .eq("received_date", today);
  if (error) throw new Error(error.message);
}
