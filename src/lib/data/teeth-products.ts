import { cache } from "react";
import { fetchAllRows } from "@/lib/data/fetch-all-rows";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  parseTeethManufacturer,
  parseTeethProductLine,
  parseTeethKind,
  type TeethManufacturer,
  type TeethProductLine,
  type TeethKind,
} from "@/lib/teeth/teeth-catalog";

export type TeethProductRow = {
  subiektTwId: number;
  symbol: string | null;
  name: string;
  plu: string | null;
  note: string;
  manufacturer: TeethManufacturer | null;
  productLine: TeethProductLine | null;
  kind: TeethKind | null;
  createdAt: string;
  updatedAt: string;
};

export type TeethProductInfoEntry = {
  twId: number;
  manufacturer: TeethManufacturer | null;
  productLine: TeethProductLine | null;
  kind: TeethKind | null;
  symbol: string | null;
  name: string;
  plu: string | null;
};

function mapRow(row: Record<string, unknown>): TeethProductRow {
  return {
    subiektTwId: Number(row.subiekt_tw_id),
    symbol: row.symbol != null ? String(row.symbol) : null,
    name: String(row.name ?? ""),
    plu: row.plu != null ? String(row.plu) : null,
    note: String(row.note ?? ""),
    manufacturer: parseTeethManufacturer(row.manufacturer),
    productLine: parseTeethProductLine(row.product_line),
    kind: parseTeethKind(row.kind),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export const fetchTeethProducts = cache(async function fetchTeethProducts(): Promise<TeethProductRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const readAll = (cols: string) =>
    fetchAllRows<Record<string, unknown>>(() =>
      supabase
        .from("prosba_teeth_products")
        .select(cols)
        .order("name")
        .order("symbol")
        .order("subiekt_tw_id")
    );
  try {
    return (
      await readAll("subiekt_tw_id, symbol, name, plu, note, manufacturer, product_line, kind, created_at, updated_at")
    ).map(mapRow);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes("manufacturer") && !message.includes("product_line") && !message.includes("does not exist")) {
      throw e;
    }
    return (
      await readAll("subiekt_tw_id, symbol, name, plu, note, manufacturer, kind, created_at, updated_at")
    ).map(mapRow);
  }
});

export async function fetchTeethProductTwIds(): Promise<number[]> {
  const rows = await fetchTeethProducts();
  return rows.map((row) => row.subiektTwId);
}

export async function fetchTeethProductTwIdSet(): Promise<Set<number>> {
  const ids = await fetchTeethProductTwIds();
  return new Set(ids.map((id) => Math.trunc(id)));
}

export async function fetchTeethProductInfo(): Promise<TeethProductInfoEntry[]> {
  const rows = await fetchTeethProducts();
  return rows.map((row) => ({
    twId: row.subiektTwId,
    manufacturer: row.manufacturer,
    productLine: row.productLine,
    kind: row.kind,
    symbol: row.symbol,
    name: row.name,
    plu: row.plu,
  }));
}
