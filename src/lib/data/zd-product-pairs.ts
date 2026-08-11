import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUnitsPerPack } from "@/lib/orders/zd-product-pair-units";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";

export type ZdProductPairSource = "manual" | "subiekt_komplet";

export type ZdProductPairRow = {
  id: string;
  packTwId: number;
  pieceTwId: number;
  unitsPerPack: number;
  source: ZdProductPairSource;
  subiektKplId: number | null;
  packSymbol: string | null;
  packNazwa: string;
  pieceSymbol: string | null;
  pieceNazwa: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

type DbRow = {
  id: string;
  pack_tw_id: number;
  piece_tw_id: number;
  units_per_pack: number;
  source: string;
  subiekt_kpl_id: number | null;
  pack_symbol: string | null;
  pack_nazwa: string | null;
  piece_symbol: string | null;
  piece_nazwa: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const SELECT_COLS =
  "id, pack_tw_id, piece_tw_id, units_per_pack, source, subiekt_kpl_id, pack_symbol, pack_nazwa, piece_symbol, piece_nazwa, note, created_at, updated_at, created_by";

function mapSource(raw: string): ZdProductPairSource {
  return raw === "subiekt_komplet" ? "subiekt_komplet" : "manual";
}

export function mapZdProductPairRow(row: DbRow): ZdProductPairRow {
  return {
    id: row.id,
    packTwId: Number(row.pack_tw_id),
    pieceTwId: Number(row.piece_tw_id),
    unitsPerPack: Math.trunc(Number(row.units_per_pack)),
    source: mapSource(row.source),
    subiektKplId:
      row.subiekt_kpl_id != null ? Number(row.subiekt_kpl_id) : null,
    packSymbol: row.pack_symbol?.trim() || null,
    packNazwa: (row.pack_nazwa ?? "").trim() || "—",
    pieceSymbol: row.piece_symbol?.trim() || null,
    pieceNazwa: (row.piece_nazwa ?? "").trim() || "—",
    note: (row.note ?? "").trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function fetchZdProductPairs(): Promise<ZdProductPairRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_product_pairs")
    .select(SELECT_COLS)
    .order("pack_symbol", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapZdProductPairRow(r as DbRow));
}

export async function fetchZdProductPairByTwId(
  twId: number
): Promise<ZdProductPairRow | null> {
  const id = Math.trunc(twId);
  if (!(id > 0)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zd_product_pairs")
    .select(SELECT_COLS)
    .or(`pack_tw_id.eq.${id},piece_tw_id.eq.${id}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapZdProductPairRow(data as DbRow);
}

export type UpsertZdProductPairInput = {
  packTwId: number;
  pieceTwId: number;
  unitsPerPack: number;
  source?: ZdProductPairSource;
  subiektKplId?: number | null;
  packSymbol?: string | null;
  packNazwa?: string | null;
  pieceSymbol?: string | null;
  pieceNazwa?: string | null;
  note?: string | null;
  createdBy?: string | null;
  /** Nadpisz wiersz manual nawet gdy sync — tylko dla source=manual z UI. */
  forceManual?: boolean;
};

export async function upsertZdProductPair(
  input: UpsertZdProductPairInput
): Promise<ZdProductPairRow> {
  const packTwId = Math.trunc(input.packTwId);
  const pieceTwId = Math.trunc(input.pieceTwId);
  const units = normalizeUnitsPerPack(input.unitsPerPack);
  if (!(packTwId > 0) || !(pieceTwId > 0)) {
    throw new Error("Nieprawidłowe tw_Id paczki lub sztuk.");
  }
  if (packTwId === pieceTwId) {
    throw new Error("Paczka i sztuki muszą być różnymi towarami.");
  }
  if (!units) {
    throw new Error("units_per_pack musi być liczbą całkowitą ≥ 2.");
  }

  const source: ZdProductPairSource = input.source ?? "manual";
  const now = new Date().toISOString();
  const supabase = createAdminClient();

  // Parent składu nie może być pack/piece — odwrotna walidacja do upsert BOM.
  const { data: bomParents, error: bomErr } = await supabase
    .from("zd_product_boms")
    .select("parent_tw_id, parent_symbol")
    .in("parent_tw_id", [packTwId, pieceTwId]);
  if (bomErr) throw new Error(bomErr.message);
  if (bomParents?.length) {
    const hit = bomParents[0] as {
      parent_tw_id: number;
      parent_symbol: string | null;
    };
    throw new Error(
      ZD_BOM_UI.errPairIsBomParent(
        String(hit.parent_symbol ?? hit.parent_tw_id)
      )
    );
  }

  // Konflikt: existing piece/pack occupied by other pair
  const { data: conflicts, error: confErr } = await supabase
    .from("zd_product_pairs")
    .select(SELECT_COLS)
    .or(
      `pack_tw_id.in.(${packTwId},${pieceTwId}),piece_tw_id.in.(${packTwId},${pieceTwId})`
    );
  if (confErr) throw new Error(confErr.message);

  for (const raw of conflicts ?? []) {
    const row = mapZdProductPairRow(raw as DbRow);
    const samePair =
      row.packTwId === packTwId && row.pieceTwId === pieceTwId;
    if (samePair) continue;
    if (row.source === "manual" && source === "subiekt_komplet" && !input.forceManual) {
      throw new Error(
        `Konflikt z ręczną parą ${row.packSymbol ?? row.packTwId} ↔ ${row.pieceSymbol ?? row.pieceTwId} — sync pomija.`
      );
    }
    if (!samePair) {
      throw new Error(
        `Towar już w innej parze (${row.packSymbol ?? row.packTwId} ↔ ${row.pieceSymbol ?? row.pieceTwId}).`
      );
    }
  }

  const existingSame = (conflicts ?? [])
    .map((r) => mapZdProductPairRow(r as DbRow))
    .find((r) => r.packTwId === packTwId && r.pieceTwId === pieceTwId);

  if (existingSame) {
    if (
      existingSame.source === "manual" &&
      source === "subiekt_komplet" &&
      !input.forceManual
    ) {
      return existingSame; // manual wygrywa — nie nadpisuj
    }
    const { data, error } = await supabase
      .from("zd_product_pairs")
      .update({
        units_per_pack: units,
        source,
        subiekt_kpl_id: input.subiektKplId ?? existingSame.subiektKplId,
        pack_symbol: input.packSymbol?.trim() || existingSame.packSymbol,
        pack_nazwa:
          (input.packNazwa ?? "").trim() || existingSame.packNazwa,
        piece_symbol: input.pieceSymbol?.trim() || existingSame.pieceSymbol,
        piece_nazwa:
          (input.pieceNazwa ?? "").trim() || existingSame.pieceNazwa,
        note:
          input.note !== undefined
            ? (input.note ?? "").trim().slice(0, 500)
            : existingSame.note,
        updated_at: now,
      })
      .eq("id", existingSame.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapZdProductPairRow(data as DbRow);
  }

  const { data, error } = await supabase
    .from("zd_product_pairs")
    .insert({
      pack_tw_id: packTwId,
      piece_tw_id: pieceTwId,
      units_per_pack: units,
      source,
      subiekt_kpl_id: input.subiektKplId ?? null,
      pack_symbol: input.packSymbol?.trim() || null,
      pack_nazwa: (input.packNazwa ?? "").trim() || "—",
      piece_symbol: input.pieceSymbol?.trim() || null,
      piece_nazwa: (input.pieceNazwa ?? "").trim() || "—",
      note: (input.note ?? "").trim().slice(0, 500),
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapZdProductPairRow(data as DbRow);
}

export async function deleteZdProductPair(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_product_pairs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteZdProductPairByPackTwId(
  packTwId: number
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zd_product_pairs")
    .delete()
    .eq("pack_tw_id", Math.trunc(packTwId));
  if (error) throw new Error(error.message);
}
