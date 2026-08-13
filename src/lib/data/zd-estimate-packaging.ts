import { createAdminClient } from "@/lib/supabase/admin";
import { assertPackagingUnits } from "@/lib/orders/zd-estimate-packaging";

export type ZdEstimatePackagingRow = {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
  /** Ile sztuk przychodzi przy wpisie „1” na ZD (≥ 2; brak wiersza = sztuki 1:1). */
  unitsPerPackage: number;
  /** Etykieta jednostki, np. „op.” / „paczka”. */
  packageLabel: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

type DbRow = {
  subiekt_tw_id: number;
  tw_symbol: string | null;
  tw_nazwa: string | null;
  grt_id: number | null;
  grt_nazwa: string | null;
  units_per_package: number;
  package_label: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const SELECT_COLS =
  "subiekt_tw_id, tw_symbol, tw_nazwa, grt_id, grt_nazwa, units_per_package, package_label, note, created_at, updated_at, created_by";

const PG_UNIQUE_VIOLATION = "23505";

export function mapZdEstimatePackagingRow(row: DbRow): ZdEstimatePackagingRow {
  return {
    subiektTwId: Number(row.subiekt_tw_id),
    twSymbol: row.tw_symbol?.trim() || null,
    twNazwa: (row.tw_nazwa ?? "").trim() || "—",
    grtId: row.grt_id != null ? Number(row.grt_id) : null,
    grtNazwa: row.grt_nazwa?.trim() || null,
    unitsPerPackage: Math.trunc(Number(row.units_per_package)),
    packageLabel: (row.package_label ?? "op.").trim() || "op.",
    note: (row.note ?? "").trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function fetchZdEstimatePackaging(): Promise<ZdEstimatePackagingRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_packaging")
    .select(SELECT_COLS)
    .order("tw_symbol", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapZdEstimatePackagingRow(row as DbRow));
}

export async function fetchZdEstimatePackagingOne(
  subiektTwId: number
): Promise<ZdEstimatePackagingRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_packaging")
    .select(SELECT_COLS)
    .eq("subiekt_tw_id", Math.trunc(subiektTwId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapZdEstimatePackagingRow(data as DbRow);
}

async function updateExistingPackaging(input: {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
  unitsPerPackage: number;
  packageLabel: string;
  note?: string;
}): Promise<ZdEstimatePackagingRow> {
  const existing = await fetchZdEstimatePackagingOne(input.subiektTwId);
  if (!existing) {
    throw new Error("Ustawienie opakowania nie istnieje (wyścig usunięcia).");
  }
  const supabase = createAdminClient();
  const note =
    input.note !== undefined
      ? input.note.trim().slice(0, 500)
      : existing.note;
  const { data, error } = await supabase
    .from("zd_estimate_packaging")
    .update({
      tw_symbol: input.twSymbol ?? existing.twSymbol,
      tw_nazwa: input.twNazwa,
      grt_id: input.grtId ?? existing.grtId,
      grt_nazwa: input.grtNazwa ?? existing.grtNazwa,
      units_per_package: input.unitsPerPackage,
      package_label: input.packageLabel,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("subiekt_tw_id", input.subiektTwId)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapZdEstimatePackagingRow(data as DbRow);
}

/**
 * Zapisuje opakowanie (units_per_package ≥ 2, zgodnie z DB).
 * Sztuki 1:1: deleteZdEstimatePackaging / „Usuń” w UI — nie upsert(1).
 */
export async function upsertZdEstimatePackaging(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  unitsPerPackage: number;
  packageLabel?: string;
  note?: string;
  createdBy?: string | null;
}): Promise<ZdEstimatePackagingRow | null> {
  const subiektTwId = Math.trunc(input.subiektTwId);
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) {
    throw new Error("Niepoprawne tw_Id produktu.");
  }

  const unitsCheck = assertPackagingUnits(input.unitsPerPackage);
  if (!unitsCheck.ok) {
    throw new Error(unitsCheck.message);
  }
  const units = unitsCheck.units;

  const twNazwa = input.twNazwa.trim() || `Towar ${subiektTwId}`;
  const twSymbol = input.twSymbol?.trim() || null;
  const grtId = input.grtId ?? null;
  const grtNazwa = input.grtNazwa?.trim() || null;
  const packageLabel = (input.packageLabel ?? "op.").trim().slice(0, 24) || "op.";
  const now = new Date().toISOString();

  const existing = await fetchZdEstimatePackagingOne(subiektTwId);
  if (existing) {
    return updateExistingPackaging({
      subiektTwId,
      twSymbol,
      twNazwa,
      grtId,
      grtNazwa,
      unitsPerPackage: units,
      packageLabel,
      note: input.note,
    });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_packaging")
    .insert({
      subiekt_tw_id: subiektTwId,
      tw_symbol: twSymbol,
      tw_nazwa: twNazwa,
      grt_id: grtId,
      grt_nazwa: grtNazwa,
      units_per_package: units,
      package_label: packageLabel,
      note: (input.note ?? "").trim().slice(0, 500),
      created_at: now,
      updated_at: now,
      created_by: input.createdBy ?? null,
    })
    .select(SELECT_COLS)
    .single();

  if (!error) {
    return mapZdEstimatePackagingRow(data as DbRow);
  }
  if (error.code === PG_UNIQUE_VIOLATION) {
    return updateExistingPackaging({
      subiektTwId,
      twSymbol,
      twNazwa,
      grtId,
      grtNazwa,
      unitsPerPackage: units,
      packageLabel,
      note: input.note,
    });
  }
  throw new Error(error.message);
}

export async function deleteZdEstimatePackaging(
  subiektTwId: number
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_estimate_packaging")
    .delete()
    .eq("subiekt_tw_id", Math.trunc(subiektTwId));
  if (error) throw new Error(error.message);
}

/** Usuwa wiele opakowań jedną operacją `.in(...)`. */
export async function deleteZdEstimatePackagingMany(
  subiektTwIds: number[]
): Promise<void> {
  const ids = [
    ...new Set(
      subiektTwIds
        .map((id) => Math.trunc(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
  if (!ids.length) return;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_estimate_packaging")
    .delete()
    .in("subiekt_tw_id", ids);
  if (error) throw new Error(error.message);
}
