import { cache } from "react";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { TeethSupplierShortage, TeethSupplierShortageWithSupplier } from "@/types/database";
import {
  parseTeethKind,
} from "@/lib/teeth/teeth-catalog";
import type { TeethKind, TeethManufacturer, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import type { TeethShortageMatchInput } from "@/lib/teeth/teeth-shortage-match";

const SELECT_COLS =
  "id, supplier_id, manufacturer, product_line, color, mould, kind, available_from, note, active, created_by, updated_by, created_at, updated_at";

function mapRow(row: Record<string, unknown>): TeethSupplierShortage {
  return {
    id: String(row.id),
    supplier_id: String(row.supplier_id),
    manufacturer: String(row.manufacturer ?? ""),
    product_line: String(row.product_line ?? ""),
    color: String(row.color ?? ""),
    mould: String(row.mould ?? ""),
    kind: parseTeethKind(row.kind),
    available_from: row.available_from != null ? String(row.available_from) : null,
    note: String(row.note ?? ""),
    active: row.active !== false,
    created_by: row.created_by != null ? String(row.created_by) : null,
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export type ActiveTeethShortageEntry = TeethShortageMatchInput;

export const fetchActiveTeethShortages = cache(
  async function fetchActiveTeethShortages(): Promise<ActiveTeethShortageEntry[]> {
    if (!hasSupabaseConfig()) return [];
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("teeth_supplier_shortages")
      .select(`${SELECT_COLS}, suppliers(name)`)
      .eq("active", true)
      .order("product_line")
      .order("color");

    if (error) {
      if (error.message.includes("teeth_supplier_shortages") || error.code === "42P01") {
        return [];
      }
      throw new Error(error.message);
    }

    return (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const suppliers = row.suppliers as { name?: string } | null;
      const mapped = mapRow(row);
      return {
        id: mapped.id,
        supplierId: mapped.supplier_id,
        supplierName: suppliers?.name?.trim() || "Dostawca",
        productLine: mapped.product_line,
        color: mapped.color,
        mould: mapped.mould,
        kind: mapped.kind,
        availableFrom: mapped.available_from,
        note: mapped.note,
        active: mapped.active,
      } satisfies ActiveTeethShortageEntry;
    });
  }
);

export async function fetchTeethShortages(options?: {
  includeInactive?: boolean;
}): Promise<TeethSupplierShortageWithSupplier[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("teeth_supplier_shortages")
    .select(`${SELECT_COLS}, suppliers(name)`)
    .order("active", { ascending: false })
    .order("available_from", { ascending: true, nullsFirst: true })
    .order("product_line")
    .order("color");

  if (!options?.includeInactive) {
    q = q.eq("active", true);
  }

  const { data, error } = await q;
  if (error) {
    if (error.message.includes("teeth_supplier_shortages") || error.code === "42P01") {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const suppliers = row.suppliers as { name?: string } | null;
    const mapped = mapRow(row);
    return {
      ...mapped,
      supplier_name: suppliers?.name?.trim() || "Dostawca",
    };
  });
}

export type UpsertTeethShortageInput = {
  id?: string | null;
  supplierId: string;
  productLine: TeethProductLine;
  manufacturer: TeethManufacturer;
  color: string;
  mould: string;
  kind: TeethKind | null;
  availableFrom: string | null;
  note: string;
  actorUserId: string;
};

export async function upsertTeethShortageRow(
  input: UpsertTeethShortageInput
): Promise<TeethSupplierShortage> {
  const supabase = createAdminClient();
  const basePayload = {
    supplier_id: input.supplierId,
    manufacturer: input.manufacturer,
    product_line: input.productLine,
    color: input.color.trim(),
    mould: (input.mould ?? "").trim(),
    kind: input.kind,
    available_from: input.availableFrom,
    note: input.note.trim(),
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  };

  if (input.id?.trim()) {
    // Edycja nie zmienia active — reaktywacja tylko przez setTeethShortageActive.
    const { data, error } = await supabase
      .from("teeth_supplier_shortages")
      .update(basePayload)
      .eq("id", input.id.trim())
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(mapShortageWriteError(error.message, "write"));
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("teeth_supplier_shortages")
    .insert({
      ...basePayload,
      active: true,
      created_by: input.actorUserId,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(mapShortageWriteError(error.message, "write"));
  return mapRow(data as Record<string, unknown>);
}

export async function setTeethShortageActive(input: {
  id: string;
  active: boolean;
  actorUserId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teeth_supplier_shortages")
    .update({
      active: input.active,
      updated_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) {
    throw new Error(
      mapShortageWriteError(error.message, input.active ? "activate" : "write"),
    );
  }
}

function mapShortageWriteError(
  message: string,
  context: "write" | "activate" = "write",
): string {
  if (
    message.includes("teeth_supplier_shortages_active_variant_uidx") ||
    message.toLowerCase().includes("duplicate")
  ) {
    if (context === "activate") {
      return "Nie można przywrócić — ten wariant jest już aktywny na innym wpisie. Dezaktywuj konflikt albo zmień wariant.";
    }
    return "Ten wariant (dostawca + linia + kolor + fason) jest już na liście aktywnych braków.";
  }
  return message;
}
