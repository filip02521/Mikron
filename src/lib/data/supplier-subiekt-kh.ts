import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

export type SupplierSubiektKhAliasRow = {
  id: string;
  subiektKhId: number;
  kontrahentLabel: string | null;
  note: string | null;
  createdAt: string;
};

/** Wszystkie kh_Id przypisane do dostawcy (główny + dodatkowe). */
export function collectKhIdsForSupplierRef(s: AppSupplierRef): number[] {
  const ids = new Set<number>();
  const primary = s.subiektKhId;
  if (primary != null && Number.isFinite(primary) && primary > 0) {
    ids.add(Math.trunc(primary));
  }
  for (const id of s.additionalSubiektKhIds ?? []) {
    if (Number.isFinite(id) && id > 0) ids.add(Math.trunc(id));
  }
  return [...ids];
}

export async function fetchSupplierSubiektKhAliases(
  supplierId: string
): Promise<SupplierSubiektKhAliasRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("id, subiekt_kh_id, subiekt_label, note, created_at")
    .eq("supplier_id", supplierId)
    .order("subiekt_kh_id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    subiektKhId: Math.trunc(Number((r as { subiekt_kh_id: number }).subiekt_kh_id)),
    kontrahentLabel: (r as { subiekt_label?: string | null }).subiekt_label ?? null,
    note: (r as { note: string | null }).note,
    createdAt: String((r as { created_at: string }).created_at),
  }));
}

async function loadAliasesBySupplierId(): Promise<Map<string, number[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("supplier_id, subiekt_kh_id");
  if (error) throw new Error(error.message);
  const bySupplier = new Map<string, number[]>();
  for (const row of data ?? []) {
    const sid = String((row as { supplier_id: string }).supplier_id);
    const kh = Math.trunc(Number((row as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!Number.isFinite(kh) || kh <= 0) continue;
    const list = bySupplier.get(sid) ?? [];
    if (!list.includes(kh)) list.push(kh);
    bySupplier.set(sid, list);
  }
  return bySupplier;
}

/** kh_Id → supplier_id (główne pole + aliasy). */
export async function loadSupplierIdByKhMap(): Promise<Map<number, string>> {
  const supabase = createAdminClient();
  const map = new Map<number, string>();

  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, subiekt_kh_id")
    .not("subiekt_kh_id", "is", null);
  if (supErr) throw new Error(supErr.message);

  for (const s of suppliers ?? []) {
    const kh = Math.trunc(Number((s as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!Number.isFinite(kh) || kh <= 0) continue;
    map.set(kh, String((s as { id: string }).id));
  }

  const { data: aliases, error: aliasErr } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("supplier_id, subiekt_kh_id");
  if (aliasErr) throw new Error(aliasErr.message);

  for (const row of aliases ?? []) {
    const kh = Math.trunc(Number((row as { subiekt_kh_id: number }).subiekt_kh_id));
    if (!Number.isFinite(kh) || kh <= 0) continue;
    map.set(kh, String((row as { supplier_id: string }).supplier_id));
  }

  return map;
}

/** kh_Id → nazwa dostawcy (do podpowiedzi w panelu ZD). */
export async function loadSupplierNameByKhMap(): Promise<Map<number, string>> {
  const supabase = createAdminClient();
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id");
  if (error) throw new Error(error.message);

  const nameById = new Map<string, string>();
  for (const s of suppliers ?? []) {
    nameById.set(String((s as { id: string }).id), String((s as { name: string }).name));
  }

  const idByKh = await loadSupplierIdByKhMap();
  const nameByKh = new Map<number, string>();
  for (const [kh, supplierId] of idByKh.entries()) {
    const name = nameById.get(supplierId);
    if (name) nameByKh.set(kh, name);
  }
  return nameByKh;
}

export async function loadAppSupplierRefsWithAliases(): Promise<AppSupplierRef[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("suppliers").select("id, name, subiekt_kh_id").order("name");
  if (error) throw new Error(error.message);

  const aliasesBySupplier = await loadAliasesBySupplierId();

  return (data ?? []).map((s) => {
    const id = String((s as { id: string }).id);
    const primary =
      (s as { subiekt_kh_id: number | null }).subiekt_kh_id != null
        ? Math.trunc(Number((s as { subiekt_kh_id: number }).subiekt_kh_id))
        : null;
    const rawAliases = aliasesBySupplier.get(id) ?? [];
    const additionalSubiektKhIds = rawAliases.filter((kh) => kh !== primary);
    return {
      id,
      name: String((s as { name: string }).name),
      subiektKhId: primary,
      additionalSubiektKhIds:
        additionalSubiektKhIds.length > 0 ? additionalSubiektKhIds : undefined,
    };
  });
}

export async function findSupplierIdOwningKhId(
  khId: number,
  excludeSupplierId?: string
): Promise<{ supplierId: string; via: "primary" | "alias" } | null> {
  const kh = Math.trunc(khId);
  if (!Number.isFinite(kh) || kh <= 0) return null;

  const supabase = createAdminClient();

  const { data: primary } = await supabase
    .from("suppliers")
    .select("id")
    .eq("subiekt_kh_id", kh)
    .maybeSingle();
  if (primary?.id) {
    const sid = String(primary.id);
    if (sid !== excludeSupplierId) return { supplierId: sid, via: "primary" };
  }

  const { data: alias } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("supplier_id")
    .eq("subiekt_kh_id", kh)
    .maybeSingle();
  if (alias?.supplier_id) {
    const sid = String(alias.supplier_id);
    if (sid !== excludeSupplierId) return { supplierId: sid, via: "alias" };
  }

  return null;
}
