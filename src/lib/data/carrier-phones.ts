import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type CarrierPhoneRow = {
  id: string;
  carrierSlug: string;
  label: string;
  phone: string;
  sortOrder: number;
};

function mapRow(row: Record<string, unknown>): CarrierPhoneRow {
  return {
    id: String(row.id),
    carrierSlug: String(row.carrier_slug),
    label: String(row.label ?? ""),
    phone: String(row.phone),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function fetchCarrierPhones(
  carrierSlug?: string
): Promise<CarrierPhoneRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("warehouse_carrier_phones")
    .select("id, carrier_slug, label, phone, sort_order")
    .order("carrier_slug")
    .order("sort_order");

  if (carrierSlug) {
    query = query.eq("carrier_slug", carrierSlug);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createCarrierPhone(input: {
  carrierSlug: string;
  label: string;
  phone: string;
  sortOrder?: number;
}): Promise<CarrierPhoneRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_carrier_phones")
    .insert({
      carrier_slug: input.carrierSlug,
      label: input.label.trim(),
      phone: input.phone.trim(),
      sort_order: input.sortOrder ?? 0,
    })
    .select("id, carrier_slug, label, phone, sort_order")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updateCarrierPhone(input: {
  id: string;
  label: string;
  phone: string;
  sortOrder?: number;
}): Promise<CarrierPhoneRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("warehouse_carrier_phones")
    .update({
      label: input.label.trim(),
      phone: input.phone.trim(),
      sort_order: input.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id, carrier_slug, label, phone, sort_order")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteCarrierPhone(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("warehouse_carrier_phones")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
