import { createAdminClient } from "@/lib/supabase/admin";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";

export type ZdEstimateSupplierScopeRow = {
  supplierId: string;
  mode: ZdEstimateRunMode;
  grupaId: number | null;
  cechaId: number | null;
  label: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

type DbRow = {
  supplier_id: string;
  mode: string;
  grupa_id: number | null;
  cecha_id: number | null;
  label: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

const SELECT_COLS =
  "supplier_id, mode, grupa_id, cecha_id, label, created_at, updated_at, updated_by";

export function mapZdEstimateSupplierScopeRow(
  row: DbRow
): ZdEstimateSupplierScopeRow {
  const mode: ZdEstimateRunMode =
    row.mode === "cecha" ? "cecha" : "grupa";
  return {
    supplierId: row.supplier_id,
    mode,
    grupaId: row.grupa_id != null ? Math.trunc(Number(row.grupa_id)) : null,
    cechaId: row.cecha_id != null ? Math.trunc(Number(row.cecha_id)) : null,
    label: (row.label ?? "").trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function fetchZdEstimateSupplierScope(
  supplierId: string
): Promise<ZdEstimateSupplierScopeRow | null> {
  const id = supplierId.trim();
  if (!id) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_supplier_scopes")
    .select(SELECT_COLS)
    .eq("supplier_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapZdEstimateSupplierScopeRow(data as DbRow);
}

export async function listZdEstimateSupplierScopes(): Promise<
  ZdEstimateSupplierScopeRow[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_supplier_scopes")
    .select(SELECT_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapZdEstimateSupplierScopeRow(row as DbRow)
  );
}

export async function deleteZdEstimateSupplierScope(
  supplierId: string
): Promise<void> {
  const id = supplierId.trim();
  if (!id) throw new Error("Brak supplierId.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_estimate_supplier_scopes")
    .delete()
    .eq("supplier_id", id);
  if (error) throw new Error(error.message);
}

export async function upsertZdEstimateSupplierScope(input: {
  supplierId: string;
  mode: ZdEstimateRunMode;
  grupaId?: number | null;
  cechaId?: number | null;
  label?: string | null;
  updatedBy?: string | null;
}): Promise<ZdEstimateSupplierScopeRow> {
  const supplierId = input.supplierId.trim();
  if (!supplierId) throw new Error("Brak supplierId.");

  const mode = input.mode;
  const grupaId =
    mode === "grupa" ? Math.trunc(Number(input.grupaId)) : null;
  const cechaId =
    mode === "cecha" ? Math.trunc(Number(input.cechaId)) : null;

  if (mode === "grupa" && (!(grupaId != null && grupaId > 0))) {
    throw new Error("Dla trybu grupa wymagane jest grupaId > 0.");
  }
  if (mode === "cecha" && (!(cechaId != null && cechaId > 0))) {
    throw new Error("Dla trybu cecha wymagane jest cechaId > 0.");
  }

  const label = (input.label ?? "").trim().slice(0, 200);
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_supplier_scopes")
    .upsert(
      {
        supplier_id: supplierId,
        mode,
        grupa_id: mode === "grupa" ? grupaId : null,
        cecha_id: mode === "cecha" ? cechaId : null,
        label,
        updated_at: now,
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: "supplier_id" }
    )
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapZdEstimateSupplierScopeRow(data as DbRow);
}
