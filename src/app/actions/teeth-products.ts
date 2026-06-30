"use server";

// @service-role-ok — autoryzacja require*(); zapis listy zębów.

import { revalidatePath } from "next/cache";
import { requireAdmin, requireAdminForMutation } from "@/lib/auth";
import { fetchTeethProducts, type TeethProductRow } from "@/lib/data/teeth-products";
import { upsertSubiektProduct } from "@/lib/data/product-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionSuggestProducts } from "@/app/actions/subiekt";
import type { SubiektProduct } from "@/lib/subiekt/types";
import {
  isTeethManufacturer,
  isTeethProductLine,
  detectTeethKind,
  detectTeethProductLine,
  manufacturerForProductLine,
  defaultProductLineForManufacturer,
  parseTeethProductLine,
  type TeethManufacturer,
  type TeethKind,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";

function revalidateTeethPaths() {
  revalidatePath("/admin/produkty/zeby");
  revalidatePath("/admin/produkty");
  revalidatePath("/prosba");
  revalidatePath("/zamowienia/nowe");
  revalidatePath("/podsumowanie");
  revalidatePath("/weryfikacja");
  revalidatePath("/", "layout");
}

function mapSubiektProduct(product: SubiektProduct): {
  subiektTwId: number;
  symbol: string | null;
  name: string;
  plu: string | null;
} {
  const subiektTwId = Math.trunc(product.tw_Id);
  const name = product.tw_Nazwa?.trim() || product.tw_Symbol?.trim() || `Towar ${subiektTwId}`;
  return {
    subiektTwId,
    symbol: product.tw_Symbol?.trim() || null,
    name,
    plu: String(product.tw_PLU ?? "").trim() || product.tw_PodstKodKresk?.trim() || null,
  };
}

export async function actionListTeethProducts(): Promise<TeethProductRow[]> {
  await requireAdmin();
  return fetchTeethProducts();
}

export async function actionSearchSubiektProductsForTeethAdmin(
  query: string
): Promise<
  | { ok: true; items: Array<{ subiektTwId: number; symbol: string | null; name: string; plu: string | null }> }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) {
    return { ok: false, error: "Wpisz co najmniej 2 znaki symbolu, nazwy lub kodu." };
  }

  const result = await actionSuggestProducts(q, "combined");
  if (!result.ok) {
    console.error("Subiekt lookup error for teeth products:", result.feedback);
    return { ok: false, error: result.feedback?.message ?? "Nie udało się wyszukać w Subiekcie." };
  }

  const existing = new Set((await fetchTeethProducts()).map((row) => row.subiektTwId));
  const items = (result.items ?? [])
    .map(mapSubiektProduct)
    .filter((item) => !existing.has(item.subiektTwId))
    .slice(0, 12);

  return { ok: true, items };
}

export async function actionAddTeethProduct(input: {
  subiektTwId: number;
  symbol?: string | null;
  name: string;
  plu?: string | null;
  note?: string;
  manufacturer?: string | null;
  productLine?: string | null;
  kind?: string | null;
}): Promise<{ success: true } | { error: string }> {
  const user = await requireAdminForMutation();

  const subiektTwId = Math.trunc(input.subiektTwId);
  if (!Number.isFinite(subiektTwId) || subiektTwId <= 0) {
    return { error: "Nieprawidłowy identyfikator towaru z Subiekta." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Brak nazwy produktu." };

  const note = (input.note ?? "").trim();
  if (note.length > 500) return { error: "Notatka jest zbyt długa (max 500 znaków)." };

  const manufacturerRaw = (input.manufacturer ?? "").trim();
  let manufacturer = manufacturerRaw && isTeethManufacturer(manufacturerRaw) ? manufacturerRaw : null;

  const productLineRaw = (input.productLine ?? "").trim();
  let productLine: TeethProductLine | null =
    productLineRaw && isTeethProductLine(productLineRaw) ? productLineRaw : null;
  if (!productLine) {
    productLine = detectTeethProductLine(name, { manufacturer });
  }
  if (productLine && !manufacturer) {
    manufacturer = manufacturerForProductLine(productLine);
  }

  const kindRaw = (input.kind ?? "").trim();
  const kind: TeethKind | null = kindRaw === "anterior" || kindRaw === "posterior"
    ? kindRaw
    : detectTeethKind(name);

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("prosba_teeth_products")
    .select("subiekt_tw_id")
    .eq("subiekt_tw_id", subiektTwId)
    .maybeSingle();

  if (existing) {
    return { error: "Ten towar jest już na liście zębów." };
  }

  await upsertSubiektProduct({
    subiektTwId,
    symbol: input.symbol ?? null,
    name,
    plu: input.plu ?? null,
  });

  const now = new Date().toISOString();
  const { error } = await supabase.from("prosba_teeth_products").insert({
    subiekt_tw_id: subiektTwId,
    symbol: input.symbol ?? null,
    name,
    plu: input.plu ?? null,
    note,
    manufacturer,
    product_line: productLine,
    kind,
    created_by: user.id === "dev" ? null : user.id,
    updated_at: now,
  });

  if (error) return { error: error.message };

  revalidateTeethPaths();
  return { success: true };
}

export async function actionUpdateTeethProductNote(
  subiektTwId: number,
  note: string
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const id = Math.trunc(subiektTwId);
  const trimmed = note.trim();
  if (trimmed.length > 500) return { error: "Notatka jest zbyt długa (max 500 znaków)." };

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("prosba_teeth_products")
    .select("subiekt_tw_id")
    .eq("subiekt_tw_id", id)
    .maybeSingle();

  if (!row) return { error: "Nie znaleziono pozycji na liście." };

  const { error } = await supabase
    .from("prosba_teeth_products")
    .update({ note: trimmed, updated_at: new Date().toISOString() })
    .eq("subiekt_tw_id", id);

  if (error) return { error: error.message };

  revalidateTeethPaths();
  return { success: true };
}

export async function actionUpdateTeethProductManufacturer(
  subiektTwId: number,
  manufacturer: string | null
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const id = Math.trunc(subiektTwId);
  const raw = (manufacturer ?? "").trim();
  const parsed = raw && isTeethManufacturer(raw) ? (raw as TeethManufacturer) : null;

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("prosba_teeth_products")
    .select("subiekt_tw_id, product_line")
    .eq("subiekt_tw_id", id)
    .maybeSingle();

  if (!row) return { error: "Nie znaleziono pozycji na liście." };

  let nextProductLine = parseTeethProductLine(row.product_line);
  if (parsed) {
    if (
      !nextProductLine ||
      manufacturerForProductLine(nextProductLine) !== parsed
    ) {
      nextProductLine = defaultProductLineForManufacturer(parsed);
    }
  }

  const { error } = await supabase
    .from("prosba_teeth_products")
    .update({
      manufacturer: parsed,
      product_line: nextProductLine,
      updated_at: new Date().toISOString(),
    })
    .eq("subiekt_tw_id", id);

  if (error) return { error: error.message };

  revalidateTeethPaths();
  return { success: true };
}

export async function actionUpdateTeethProductProductLine(
  subiektTwId: number,
  productLine: string | null
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const id = Math.trunc(subiektTwId);
  const raw = (productLine ?? "").trim();
  const parsed: TeethProductLine | null = raw && isTeethProductLine(raw) ? raw : null;

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("prosba_teeth_products")
    .select("subiekt_tw_id")
    .eq("subiekt_tw_id", id)
    .maybeSingle();

  if (!row) return { error: "Nie znaleziono pozycji na liście." };

  const updatePayload: {
    product_line: TeethProductLine | null;
    updated_at: string;
    manufacturer?: TeethManufacturer | null;
  } = {
    product_line: parsed,
    updated_at: new Date().toISOString(),
  };
  if (parsed) {
    updatePayload.manufacturer = manufacturerForProductLine(parsed);
  }

  const { error } = await supabase
    .from("prosba_teeth_products")
    .update(updatePayload)
    .eq("subiekt_tw_id", id);

  if (error) return { error: error.message };

  revalidateTeethPaths();
  return { success: true };
}

export async function actionUpdateTeethProductKind(
  subiektTwId: number,
  kind: string | null
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const id = Math.trunc(subiektTwId);
  const raw = (kind ?? "").trim();
  const parsed: TeethKind | null = raw === "anterior" || raw === "posterior" ? raw : null;

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("prosba_teeth_products")
    .select("subiekt_tw_id")
    .eq("subiekt_tw_id", id)
    .maybeSingle();

  if (!row) return { error: "Nie znaleziono pozycji na liście." };

  const { error } = await supabase
    .from("prosba_teeth_products")
    .update({ kind: parsed, updated_at: new Date().toISOString() })
    .eq("subiekt_tw_id", id);

  if (error) return { error: error.message };

  revalidateTeethPaths();
  return { success: true };
}

export async function actionRemoveTeethProduct(
  subiektTwId: number
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const id = Math.trunc(subiektTwId);
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("prosba_teeth_products")
    .select("name")
    .eq("subiekt_tw_id", id)
    .maybeSingle();

  if (!row) return { error: "Nie znaleziono pozycji na liście." };

  const { error } = await supabase.from("prosba_teeth_products").delete().eq("subiekt_tw_id", id);
  if (error) return { error: error.message };

  revalidateTeethPaths();
  return { success: true };
}
