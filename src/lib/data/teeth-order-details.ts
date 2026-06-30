import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { formatDbError } from "@/lib/supabase/db-errors";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import { parseTeethJaw, parseTeethKind } from "@/lib/teeth/teeth-catalog-types";
import { assertMinimalTeethDetailsForDb } from "@/lib/teeth/teeth-validation";
import type { IndividualOrderTeethDetail } from "@/types/database";

function isUndefinedColumnError(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes("schema cache") ||
    /\bcolumn\b.*\bdoes not exist\b/i.test(msg)
  );
}

function isMissingTableError(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return (
    error.code === "42P01" ||
    (msg.includes("individual_order_teeth_details") && msg.includes("does not exist"))
  );
}

export function mapTeethDetailRow(row: Record<string, unknown>): IndividualOrderTeethDetail {
  return {
    id: String(row.id),
    order_id: String(row.order_id),
    position: Number(row.position),
    color: String(row.color ?? ""),
    mould: row.mould != null ? String(row.mould) : null,
    size: row.size != null ? String(row.size) : null,
    jaw: parseTeethJaw(row.jaw, row.size),
    kind: parseTeethKind(row.kind),
  };
}

function buildTeethDetailsMap(
  rows: Record<string, unknown>[]
): Map<string, IndividualOrderTeethDetail[]> {
  const map = new Map<string, IndividualOrderTeethDetail[]>();
  for (const row of rows) {
    const entry = mapTeethDetailRow(row);
    const existing = map.get(entry.order_id);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(entry.order_id, [entry]);
    }
  }
  return map;
}

function mergeJawKindIntoDetails(
  details: IndividualOrderTeethDetail[],
  jawRows: Record<string, unknown>[],
  kindRows: Record<string, unknown>[]
): IndividualOrderTeethDetail[] {
  const jawById = new Map(
    jawRows.map((row) => [String(row.id), parseTeethJaw(row.jaw, row.size)])
  );
  const kindById = new Map(kindRows.map((row) => [String(row.id), parseTeethKind(row.kind)]));

  return details.map((detail) => ({
    ...detail,
    jaw: detail.jaw ?? jawById.get(detail.id) ?? null,
    kind: detail.kind ?? kindById.get(detail.id) ?? null,
  }));
}

function rebuildTeethDetailsMap(
  details: IndividualOrderTeethDetail[]
): Map<string, IndividualOrderTeethDetail[]> {
  const map = new Map<string, IndividualOrderTeethDetail[]>();
  for (const detail of details) {
    const existing = map.get(detail.order_id);
    if (existing) {
      existing.push(detail);
    } else {
      map.set(detail.order_id, [detail]);
    }
  }
  for (const rows of map.values()) {
    rows.sort((a, b) => a.position - b.position);
  }
  return map;
}

/** Wczytaj szczegóły zębów dla wielu zamówień (z fallbackiem gdy brak kolumn jaw/kind). */
export async function fetchTeethDetailsForOrders(
  orderIds: string[]
): Promise<Map<string, IndividualOrderTeethDetail[]>> {
  if (!orderIds.length) return new Map();
  if (!hasSupabaseConfig()) return new Map();

  const supabase = createAdminClient();
  const fullSelect = "id, order_id, position, color, mould, size, jaw, kind";

  const { data: fullData, error: fullError } = await supabase
    .from("individual_order_teeth_details")
    .select(fullSelect)
    .in("order_id", orderIds)
    .order("position", { ascending: true });

  if (!fullError) {
    return buildTeethDetailsMap((fullData ?? []) as Record<string, unknown>[]);
  }

  if (isMissingTableError(fullError)) {
    throw new Error(
      "Brak tabeli list zębów (individual_order_teeth_details). " +
        "Uruchom w Supabase migrację supabase/migrations/079_teeth_order_details.sql " +
        "(oraz 080_teeth_jaw.sql i 081_teeth_kind.sql)."
    );
  }

  if (!isUndefinedColumnError(fullError)) {
    throw new Error(`Nie udało się wczytać list zębów: ${formatDbError(fullError)}`);
  }

  const { data: baseData, error: baseError } = await supabase
    .from("individual_order_teeth_details")
    .select("id, order_id, position, color, mould, size")
    .in("order_id", orderIds)
    .order("position", { ascending: true });

  if (baseError) {
    if (isMissingTableError(baseError)) {
      throw new Error(
        "Brak tabeli list zębów (individual_order_teeth_details). " +
          "Uruchom migrację supabase/migrations/079_teeth_order_details.sql."
      );
    }
    throw new Error(`Nie udało się wczytać list zębów: ${formatDbError(baseError)}`);
  }

  const baseMap = buildTeethDetailsMap((baseData ?? []) as Record<string, unknown>[]);
  if (baseMap.size === 0) return baseMap;

  const [{ data: jawData, error: jawError }, { data: kindData, error: kindError }] =
    await Promise.all([
      supabase
        .from("individual_order_teeth_details")
        .select("id, order_id, position, jaw")
        .in("order_id", orderIds),
      supabase
        .from("individual_order_teeth_details")
        .select("id, order_id, position, kind")
        .in("order_id", orderIds),
    ]);

  if (jawError && !isUndefinedColumnError(jawError)) {
    throw new Error(`Nie udało się wczytać szczęki z listy zębów: ${formatDbError(jawError)}`);
  }
  if (kindError && !isUndefinedColumnError(kindError)) {
    throw new Error(`Nie udało się wczytać typu z listy zębów: ${formatDbError(kindError)}`);
  }

  const mergedRows: IndividualOrderTeethDetail[] = [];
  for (const rows of baseMap.values()) {
    mergedRows.push(
      ...mergeJawKindIntoDetails(
        rows,
        jawError ? [] : ((jawData ?? []) as Record<string, unknown>[]),
        kindError ? [] : ((kindData ?? []) as Record<string, unknown>[])
      )
    );
  }

  if (jawError || kindError) {
    console.warn(
      "[fetchTeethDetailsForOrders] Częściowy odczyt jaw/kind — uruchom migracje 080/081 jeśli jeszcze nie:",
      jawError?.message ?? kindError?.message
    );
  }

  return rebuildTeethDetailsMap(mergedRows);
}

type TeethDetailInsertRow = {
  order_id: string;
  position: number;
  color: string;
  mould: string | null;
  jaw?: "upper" | "lower" | null;
  kind?: "anterior" | "posterior" | null;
};

function errorMentionsColumn(error: { message?: string }, column: string): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes(column.toLowerCase());
}

async function insertTeethDetailRows(
  supabase: SupabaseClient,
  rows: TeethDetailInsertRow[]
): Promise<void> {
  if (!rows.length) return;

  const withJawAndKind = rows.map(({ order_id, position, color, mould, jaw, kind }) => ({
    order_id,
    position,
    color,
    mould,
    jaw: jaw ?? null,
    kind: kind ?? null,
  }));

  let { error } = await supabase.from("individual_order_teeth_details").insert(withJawAndKind);

  if (error && isUndefinedColumnError(error)) {
    if (errorMentionsColumn(error, "jaw")) {
      throw new Error(
        "Nie zapisano szczęki (góra/dół). Uruchom migrację supabase/migrations/080_teeth_jaw.sql w Supabase."
      );
    }

    const withJawOnly = rows.map(({ order_id, position, color, mould, jaw }) => ({
      order_id,
      position,
      color,
      mould,
      jaw: jaw ?? null,
    }));
    ({ error } = await supabase.from("individual_order_teeth_details").insert(withJawOnly));

    if (error && isUndefinedColumnError(error)) {
      if (errorMentionsColumn(error, "jaw")) {
        throw new Error(
          "Nie zapisano szczęki (góra/dół). Uruchom migrację supabase/migrations/080_teeth_jaw.sql w Supabase."
        );
      }
      throw new Error(
        "Nie zapisano typu zęba (przednie/tylne). Uruchom migrację supabase/migrations/081_teeth_kind.sql w Supabase."
      );
    }
  }

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "Nie zapisano listy zębów — brak tabeli individual_order_teeth_details. " +
          "Uruchom migrację supabase/migrations/079_teeth_order_details.sql."
      );
    }
    throw new Error(`Nie zapisano listy zębów: ${formatDbError(error)}`);
  }
}

/** Zapisz / usuń szczegóły zębów powiązane z pozycjami zamówienia. */
export async function saveTeethDetailsForOrders(
  supabase: SupabaseClient,
  entries: { orderId: string; isTeeth: boolean; teethDetails: TeethLineDetail[] | null }[]
): Promise<void> {
  for (const entry of entries) {
    if (!entry.isTeeth) {
      const { error } = await supabase
        .from("individual_order_teeth_details")
        .delete()
        .eq("order_id", entry.orderId);
      if (error && !isMissingTableError(error)) {
        throw new Error(`Nie usunięto listy zębów: ${formatDbError(error)}`);
      }
      continue;
    }

    assertMinimalTeethDetailsForDb(entry.teethDetails);
    const teethDetails = entry.teethDetails;
    if (!teethDetails?.length) continue;

    const { error: deleteError } = await supabase
      .from("individual_order_teeth_details")
      .delete()
      .eq("order_id", entry.orderId);
    if (deleteError && !isMissingTableError(deleteError)) {
      throw new Error(`Nie zapisano listy zębów: ${formatDbError(deleteError)}`);
    }

    const rows: TeethDetailInsertRow[] = teethDetails.map((d) => ({
        order_id: entry.orderId,
        position: d.position,
        color: d.color.trim(),
        mould: d.mould?.trim() || null,
        jaw: d.jaw ?? null,
        kind: d.kind ?? null,
      }));

    await insertTeethDetailRows(supabase, rows);
  }
}
