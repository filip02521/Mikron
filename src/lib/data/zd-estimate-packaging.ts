import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertOrderMultiple,
  assertPackagingUnits,
  normalizeOrderMultiple,
  normalizePackagingDocumentUnitMode,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";

export type ZdEstimatePackagingRow = {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
  /** Ile sztuk = 1 op. (A) lub wielokrotność dobicia (B); ≥ 2; brak wiersza = 1:1. */
  unitsPerPackage: number;
  /** Etykieta jednostki, np. „op.” / „paczka”. */
  packageLabel: string;
  /**
   * packages = 1 na ZD to opakowanie;
   * pieces_multiple = Do ZD w sztukach, dobij do wielokrotności N.
   */
  documentUnitMode: ZdPackagingDocumentUnitMode;
  /**
   * Wielokrotność liczby paczek (packages). null = off.
   * Ignorowane w pieces_multiple.
   */
  orderMultiple: number | null;
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
  document_unit_mode?: string | null;
  order_multiple?: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const SELECT_COLS =
  "subiekt_tw_id, tw_symbol, tw_nazwa, grt_id, grt_nazwa, units_per_package, package_label, document_unit_mode, order_multiple, note, created_at, updated_at, created_by";

const PG_UNIQUE_VIOLATION = "23505";

function mapOrderMultipleFromDb(raw: unknown): number | null {
  if (raw == null) return null;
  const n = normalizeOrderMultiple(Number(raw));
  return n >= 2 ? n : null;
}

export function mapZdEstimatePackagingRow(row: DbRow): ZdEstimatePackagingRow {
  const documentUnitMode = normalizePackagingDocumentUnitMode(
    row.document_unit_mode
  );
  const orderMultiple =
    documentUnitMode === "pieces_multiple"
      ? null
      : mapOrderMultipleFromDb(row.order_multiple);
  return {
    subiektTwId: Number(row.subiekt_tw_id),
    twSymbol: row.tw_symbol?.trim() || null,
    twNazwa: (row.tw_nazwa ?? "").trim() || "—",
    grtId: row.grt_id != null ? Number(row.grt_id) : null,
    grtNazwa: row.grt_nazwa?.trim() || null,
    unitsPerPackage: Math.trunc(Number(row.units_per_package)),
    packageLabel: (row.package_label ?? "op.").trim() || "op.",
    documentUnitMode,
    orderMultiple,
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
  documentUnitMode: ZdPackagingDocumentUnitMode;
  orderMultiple: number | null;
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
      document_unit_mode: input.documentUnitMode,
      order_multiple: input.orderMultiple,
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
 * Mode B: order_multiple zawsze null.
 */
export async function upsertZdEstimatePackaging(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  unitsPerPackage: number;
  packageLabel?: string;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
  orderMultiple?: number | null;
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
  const documentUnitMode = normalizePackagingDocumentUnitMode(
    input.documentUnitMode
  );
  const orderCheck = assertOrderMultiple(
    documentUnitMode === "pieces_multiple" ? null : input.orderMultiple
  );
  if (!orderCheck.ok) {
    throw new Error(orderCheck.message);
  }
  const orderMultiple =
    documentUnitMode === "pieces_multiple" ? null : orderCheck.orderMultiple;

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
      documentUnitMode,
      orderMultiple,
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
      document_unit_mode: documentUnitMode,
      order_multiple: orderMultiple,
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
      documentUnitMode,
      orderMultiple,
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
