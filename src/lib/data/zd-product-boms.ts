import { createAdminClient } from "@/lib/supabase/admin";
import { fetchZdProductPairs } from "@/lib/data/zd-product-pairs";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";

export type ZdProductBomSource = "manual";

export type ZdProductBomComponentRow = {
  id: string;
  componentTwId: number;
  qtyPerParent: number;
  componentSymbol: string | null;
  componentNazwa: string;
};

export type ZdProductBomRow = {
  id: string;
  parentTwId: number;
  label: string;
  stockAsCover: boolean;
  source: ZdProductBomSource;
  note: string;
  parentSymbol: string | null;
  parentNazwa: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  components: ZdProductBomComponentRow[];
};

type BomDbRow = {
  id: string;
  parent_tw_id: number;
  label: string | null;
  stock_as_cover: boolean;
  source: string;
  note: string | null;
  parent_symbol: string | null;
  parent_nazwa: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type CompDbRow = {
  id: string;
  bom_id: string;
  component_tw_id: number;
  qty_per_parent: number;
  component_symbol: string | null;
  component_nazwa: string | null;
};

const BOM_COLS =
  "id, parent_tw_id, label, stock_as_cover, source, note, parent_symbol, parent_nazwa, created_at, updated_at, created_by";

const COMP_COLS =
  "id, bom_id, component_tw_id, qty_per_parent, component_symbol, component_nazwa";

function mapComponent(row: CompDbRow): ZdProductBomComponentRow {
  return {
    id: row.id,
    componentTwId: Math.trunc(Number(row.component_tw_id)),
    qtyPerParent: Math.trunc(Number(row.qty_per_parent)),
    componentSymbol: row.component_symbol?.trim() || null,
    componentNazwa: (row.component_nazwa ?? "").trim() || "—",
  };
}

function mapBom(
  row: BomDbRow,
  components: ZdProductBomComponentRow[]
): ZdProductBomRow {
  return {
    id: row.id,
    parentTwId: Math.trunc(Number(row.parent_tw_id)),
    label: (row.label ?? "").trim(),
    stockAsCover: row.stock_as_cover !== false,
    source: "manual",
    note: (row.note ?? "").trim(),
    parentSymbol: row.parent_symbol?.trim() || null,
    parentNazwa: (row.parent_nazwa ?? "").trim() || "—",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    components,
  };
}

export async function fetchZdProductBoms(): Promise<ZdProductBomRow[]> {
  const supabase = createAdminClient();
  const { data: boms, error } = await supabase
    .from("zd_product_boms")
    .select(BOM_COLS)
    .order("parent_symbol", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  if (!boms?.length) return [];

  const ids = boms.map((b) => b.id);
  const { data: comps, error: compErr } = await supabase
    .from("zd_product_bom_components")
    .select(COMP_COLS)
    .in("bom_id", ids);
  if (compErr) throw new Error(compErr.message);

  const byBom = new Map<string, ZdProductBomComponentRow[]>();
  for (const raw of comps ?? []) {
    const c = mapComponent(raw as CompDbRow);
    const list = byBom.get((raw as CompDbRow).bom_id) ?? [];
    list.push(c);
    byBom.set((raw as CompDbRow).bom_id, list);
  }

  return (boms as BomDbRow[]).map((b) =>
    mapBom(
      b,
      (byBom.get(b.id) ?? []).sort((a, b) =>
        (a.componentSymbol ?? "").localeCompare(b.componentSymbol ?? "", "pl")
      )
    )
  );
}

export type UpsertZdProductBomComponentInput = {
  componentTwId: number;
  qtyPerParent: number;
  componentSymbol?: string | null;
  componentNazwa?: string | null;
};

export type UpsertZdProductBomInput = {
  parentTwId: number;
  label?: string | null;
  stockAsCover?: boolean;
  note?: string | null;
  parentSymbol?: string | null;
  parentNazwa?: string | null;
  components: UpsertZdProductBomComponentInput[];
  createdBy?: string | null;
};

function normalizeQty(raw: number): number | null {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1 || n > 100_000) return null;
  return n;
}

export async function upsertZdProductBom(
  input: UpsertZdProductBomInput
): Promise<ZdProductBomRow> {
  const parentTwId = Math.trunc(input.parentTwId);
  if (!(parentTwId > 0)) {
    throw new Error(ZD_BOM_UI.errBadParentId);
  }
  if (!input.components?.length) {
    throw new Error(ZD_BOM_UI.errNeedComponent);
  }

  const comps: UpsertZdProductBomComponentInput[] = [];
  const seenComp = new Set<number>();
  for (const c of input.components) {
    const tw = Math.trunc(c.componentTwId);
    const qty = normalizeQty(c.qtyPerParent);
    if (!(tw > 0) || !qty) {
      throw new Error(ZD_BOM_UI.errBadComponent);
    }
    if (tw === parentTwId) {
      throw new Error(ZD_BOM_UI.errParentIsComponent);
    }
    if (seenComp.has(tw)) {
      throw new Error(ZD_BOM_UI.errDuplicateComponent);
    }
    seenComp.add(tw);
    comps.push({
      componentTwId: tw,
      qtyPerParent: qty,
      componentSymbol: c.componentSymbol,
      componentNazwa: c.componentNazwa,
    });
  }

  const pairs = await fetchZdProductPairs();
  for (const pair of pairs) {
    if (pair.packTwId === parentTwId || pair.pieceTwId === parentTwId) {
      throw new Error(
        ZD_BOM_UI.errParentInPair(
          String(pair.packSymbol ?? pair.packTwId),
          String(pair.pieceSymbol ?? pair.pieceTwId)
        )
      );
    }
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();

  const { data: existing, error: exErr } = await supabase
    .from("zd_product_boms")
    .select(BOM_COLS)
    .eq("parent_tw_id", parentTwId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  let bomId: string;
  if (existing) {
    const { data, error } = await supabase
      .from("zd_product_boms")
      .update({
        label: (input.label ?? "").trim().slice(0, 200),
        stock_as_cover: input.stockAsCover !== false,
        note:
          input.note !== undefined
            ? (input.note ?? "").trim().slice(0, 500)
            : (existing as BomDbRow).note,
        parent_symbol:
          input.parentSymbol?.trim() ||
          (existing as BomDbRow).parent_symbol,
        parent_nazwa:
          (input.parentNazwa ?? "").trim() ||
          (existing as BomDbRow).parent_nazwa ||
          "—",
        updated_at: now,
      })
      .eq("id", (existing as BomDbRow).id)
      .select(BOM_COLS)
      .single();
    if (error) throw new Error(error.message);
    bomId = (data as BomDbRow).id;

    const { error: delErr } = await supabase
      .from("zd_product_bom_components")
      .delete()
      .eq("bom_id", bomId);
    if (delErr) throw new Error(delErr.message);
  } else {
    const { data, error } = await supabase
      .from("zd_product_boms")
      .insert({
        parent_tw_id: parentTwId,
        label: (input.label ?? "").trim().slice(0, 200),
        stock_as_cover: input.stockAsCover !== false,
        source: "manual",
        note: (input.note ?? "").trim().slice(0, 500),
        parent_symbol: input.parentSymbol?.trim() || null,
        parent_nazwa: (input.parentNazwa ?? "").trim() || "—",
        created_by: input.createdBy ?? null,
        created_at: now,
        updated_at: now,
      })
      .select(BOM_COLS)
      .single();
    if (error) throw new Error(error.message);
    bomId = (data as BomDbRow).id;
  }

  const { error: insErr } = await supabase
    .from("zd_product_bom_components")
    .insert(
      comps.map((c) => ({
        bom_id: bomId,
        component_tw_id: c.componentTwId,
        qty_per_parent: c.qtyPerParent,
        component_symbol: c.componentSymbol?.trim() || null,
        component_nazwa: (c.componentNazwa ?? "").trim() || "—",
      }))
    );
  if (insErr) throw new Error(insErr.message);

  const all = await fetchZdProductBoms();
  const row = all.find((b) => b.id === bomId);
  if (!row) throw new Error(ZD_BOM_UI.errReadBack);
  return row;
}

export async function deleteZdProductBom(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("zd_product_boms").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
