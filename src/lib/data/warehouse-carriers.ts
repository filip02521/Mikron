import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { WAREHOUSE_CARRIERS } from "@/lib/warehouse/delivery-carriers";

export type WarehouseCarrierRow = {
  slug: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

function mapRow(row: Record<string, unknown>): WarehouseCarrierRow {
  return {
    slug: String(row.slug),
    label: String(row.label),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
  };
}

function seedFallback(): WarehouseCarrierRow[] {
  return WAREHOUSE_CARRIERS.map((carrier, index) => ({
    slug: carrier.value,
    label: carrier.label,
    sortOrder: (index + 1) * 10,
    isActive: true,
  }));
}

export async function fetchWarehouseCarriers(): Promise<WarehouseCarrierRow[]> {
  if (!hasSupabaseConfig()) return seedFallback();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_carriers")
    .select("slug, label, sort_order, is_active")
    .order("sort_order")
    .order("label");

  if (error) throw new Error(error.message);
  if (!data?.length) return seedFallback();

  return data.map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchActiveWarehouseCarriers(): Promise<WarehouseCarrierRow[]> {
  const all = await fetchWarehouseCarriers();
  return all.filter((carrier) => carrier.isActive);
}

export async function countWarehouseCarrierUsage(slug: string): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createAdminClient();
  const [receipts, hints, suppliers] = await Promise.all([
    supabase
      .from("warehouse_delivery_receipts")
      .select("id", { count: "exact", head: true })
      .eq("carrier", slug),
    supabase
      .from("warehouse_carrier_hints")
      .select("supplier_id", { count: "exact", head: true })
      .eq("carrier", slug),
    supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("default_delivery_carrier", slug),
  ]);

  if (receipts.error) throw new Error(receipts.error.message);
  if (hints.error) throw new Error(hints.error.message);
  if (suppliers.error) throw new Error(suppliers.error.message);

  return (receipts.count ?? 0) + (hints.count ?? 0) + (suppliers.count ?? 0);
}
