import { createAdminClient } from "@/lib/supabase/admin";

export type ZdEstimateExclusionRow = {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
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
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const SELECT_COLS =
  "subiekt_tw_id, tw_symbol, tw_nazwa, grt_id, grt_nazwa, note, created_at, updated_at, created_by";

/** Postgres unique_violation — równoległy insert tego samego tw_Id. */
const PG_UNIQUE_VIOLATION = "23505";

export function mapZdEstimateExclusionRow(row: DbRow): ZdEstimateExclusionRow {
  return {
    subiektTwId: Number(row.subiekt_tw_id),
    twSymbol: row.tw_symbol?.trim() || null,
    twNazwa: (row.tw_nazwa ?? "").trim() || "—",
    grtId: row.grt_id != null ? Number(row.grt_id) : null,
    grtNazwa: row.grt_nazwa?.trim() || null,
    note: (row.note ?? "").trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function fetchZdEstimateExclusions(): Promise<ZdEstimateExclusionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_exclusions")
    .select(SELECT_COLS)
    .order("tw_symbol", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapZdEstimateExclusionRow(row as DbRow));
}

export async function fetchZdEstimateExclusion(
  subiektTwId: number
): Promise<ZdEstimateExclusionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_exclusions")
    .select(SELECT_COLS)
    .eq("subiekt_tw_id", Math.trunc(subiektTwId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapZdEstimateExclusionRow(data as DbRow);
}

async function updateExistingExclusion(input: {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
  /** undefined = zostaw istniejącą notatkę */
  note?: string;
}): Promise<ZdEstimateExclusionRow> {
  const supabase = createAdminClient();
  const existing = await fetchZdEstimateExclusion(input.subiektTwId);
  if (!existing) {
    throw new Error("Wykluczenie nie istnieje (wyścig usunięcia).");
  }
  const note =
    input.note !== undefined
      ? input.note.trim().slice(0, 500)
      : existing.note;
  const { data, error } = await supabase
    .from("zd_estimate_exclusions")
    .update({
      tw_symbol: input.twSymbol ?? existing.twSymbol,
      tw_nazwa: input.twNazwa,
      grt_id: input.grtId ?? existing.grtId,
      grt_nazwa: input.grtNazwa ?? existing.grtNazwa,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("subiekt_tw_id", input.subiektTwId)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapZdEstimateExclusionRow(data as DbRow);
}

/**
 * Dodaje / odświeża wykluczenie.
 * Insert-first + fallback na unique → odporne na równoległe wykluczenie tego samego tw_Id.
 * `created_by` tylko przy pierwszym insertcie; `note` undefined przy update = bez zmiany.
 */
export async function upsertZdEstimateExclusion(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  note?: string;
  createdBy?: string | null;
}): Promise<ZdEstimateExclusionRow> {
  const subiektTwId = Math.trunc(input.subiektTwId);
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) {
    throw new Error("Niepoprawne tw_Id produktu.");
  }

  const twNazwa = input.twNazwa.trim() || `Towar ${subiektTwId}`;
  const twSymbol = input.twSymbol?.trim() || null;
  const grtId = input.grtId ?? null;
  const grtNazwa = input.grtNazwa?.trim() || null;
  const now = new Date().toISOString();

  const existing = await fetchZdEstimateExclusion(subiektTwId);
  if (existing) {
    return updateExistingExclusion({
      subiektTwId,
      twSymbol,
      twNazwa,
      grtId,
      grtNazwa,
      note: input.note,
    });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_exclusions")
    .insert({
      subiekt_tw_id: subiektTwId,
      tw_symbol: twSymbol,
      tw_nazwa: twNazwa,
      grt_id: grtId,
      grt_nazwa: grtNazwa,
      note: (input.note ?? "").trim().slice(0, 500),
      created_at: now,
      updated_at: now,
      created_by: input.createdBy ?? null,
    })
    .select(SELECT_COLS)
    .single();

  if (!error) {
    return mapZdEstimateExclusionRow(data as DbRow);
  }

  if (error.code === PG_UNIQUE_VIOLATION) {
    return updateExistingExclusion({
      subiektTwId,
      twSymbol,
      twNazwa,
      grtId,
      grtNazwa,
      note: input.note,
    });
  }

  throw new Error(error.message);
}

export async function updateZdEstimateExclusionNote(input: {
  subiektTwId: number;
  note: string;
}): Promise<ZdEstimateExclusionRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_estimate_exclusions")
    .update({
      note: input.note.trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("subiekt_tw_id", Math.trunc(input.subiektTwId))
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapZdEstimateExclusionRow(data as DbRow);
}

export async function deleteZdEstimateExclusion(
  subiektTwId: number
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_estimate_exclusions")
    .delete()
    .eq("subiekt_tw_id", Math.trunc(subiektTwId));
  if (error) throw new Error(error.message);
}

/** Usuwa wiele wykluczeń jedną operacją `.in(...)`. */
export async function deleteZdEstimateExclusionsMany(
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
    .from("zd_estimate_exclusions")
    .delete()
    .in("subiekt_tw_id", ids);
  if (error) throw new Error(error.message);
}
