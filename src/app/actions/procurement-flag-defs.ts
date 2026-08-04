"use server";

// @service-role-ok — autoryzacja requireOperations("mutate"); service role z pełnym scope po warstwie aplikacji.

import { requireOperations } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_PROCUREMENT_FLAG_DEFINITIONS,
} from "@/lib/security/text-limits";
import {
  isProcurementFlagColor,
  isProcurementFlagUuid,
  mapFlagDefinitionRow,
  normalizeProcurementFlagLabel,
  PROCUREMENT_FLAG_DEFS_MIGRATION_HINT,
  procurementFlagLabelsEqual,
  throwIfProcurementFlagColumnMissing,
  type ProcurementFlagColor,
  type ProcurementFlagDefinition,
} from "@/lib/orders/procurement-request-flag";

function revalidateAll() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  revalidatePath("/dostawy");
  revalidatePath("/historia");
  revalidatePath("/moje");
  revalidatePath("/plan");
  revalidatePath("/prosba");
  revalidatePath("/weryfikacja");
}

function throwIfDefsMissing(error: { message?: string }): void {
  throwIfProcurementFlagColumnMissing(error);
  if (
    error.message?.includes("procurement_flag_definitions") ||
    error.message?.includes("does not exist")
  ) {
    throw new Error(PROCUREMENT_FLAG_DEFS_MIGRATION_HINT);
  }
}

async function assertActiveCountUnderLimit(
  supabase: ReturnType<typeof createAdminClient>,
  excludeId?: string
): Promise<void> {
  let q = supabase
    .from("procurement_flag_definitions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (excludeId) q = q.neq("id", excludeId);
  const { count, error } = await q;
  if (error) {
    throwIfDefsMissing(error);
    throw new Error(error.message);
  }
  if ((count ?? 0) >= MAX_PROCUREMENT_FLAG_DEFINITIONS) {
    throw new Error(
      `Limit aktywnych flag (${MAX_PROCUREMENT_FLAG_DEFINITIONS}) został osiągnięty.`
    );
  }
}

/** Blokuje duplikat nazwy względem dowolnej definicji (także nieaktywnej). */
async function assertLabelAvailable(
  supabase: ReturnType<typeof createAdminClient>,
  label: string,
  excludeId?: string
): Promise<void> {
  const { data, error } = await supabase
    .from("procurement_flag_definitions")
    .select("id, label");
  if (error) {
    throwIfDefsMissing(error);
    throw new Error(error.message);
  }
  const clash = (data ?? []).find(
    (row) =>
      procurementFlagLabelsEqual(row.label, label) &&
      (!excludeId || row.id !== excludeId)
  );
  if (clash) {
    throw new Error(
      "Flaga o takiej nazwie już istnieje (także wśród nieaktywnych) — przywróć ją albo wybierz inną nazwę."
    );
  }
}

export async function actionCreateProcurementFlagDefinition(input: {
  label: string;
  color: string;
}): Promise<{ success: true; definition: ProcurementFlagDefinition }> {
  await requireOperations("mutate");
  const label = normalizeProcurementFlagLabel(input.label);
  if (!label) throw new Error("Podaj nazwę flagi.");
  if (!isProcurementFlagColor(input.color)) {
    throw new Error("Nieznany kolor flagi.");
  }
  const color: ProcurementFlagColor = input.color;

  const supabase = createAdminClient();
  await assertActiveCountUnderLimit(supabase);
  await assertLabelAvailable(supabase, label);

  const { data: top, error: topError } = await supabase
    .from("procurement_flag_definitions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topError) {
    throwIfDefsMissing(topError);
    throw new Error(topError.message);
  }
  const sortOrder = (top?.sort_order ?? -1) + 1;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("procurement_flag_definitions")
    .insert({
      label,
      color,
      sort_order: sortOrder,
      is_active: true,
      updated_at: now,
    })
    .select("id, label, color, sort_order, is_active")
    .single();

  if (error) {
    throwIfDefsMissing(error);
    if (error.message?.includes("procurement_flag_definitions_label_active_uidx")) {
      throw new Error("Flaga o takiej nazwie już istnieje.");
    }
    throw new Error(error.message);
  }
  const definition = mapFlagDefinitionRow(data);
  if (!definition) throw new Error("Nie udało się utworzyć flagi.");
  revalidateAll();
  return { success: true, definition };
}

export async function actionUpdateProcurementFlagDefinition(
  id: string,
  input: { label?: string; color?: string; isActive?: boolean }
): Promise<{ success: true; definition: ProcurementFlagDefinition }> {
  await requireOperations("mutate");
  if (!isProcurementFlagUuid(id)) throw new Error("Nieprawidłowy identyfikator flagi.");

  const supabase = createAdminClient();

  if (input.isActive === true) {
    await assertActiveCountUnderLimit(supabase, id);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.label !== undefined) {
    const label = normalizeProcurementFlagLabel(input.label);
    if (!label) throw new Error("Podaj nazwę flagi.");
    await assertLabelAvailable(supabase, label, id);
    patch.label = label;
  }
  if (input.color !== undefined) {
    if (!isProcurementFlagColor(input.color)) {
      throw new Error("Nieznany kolor flagi.");
    }
    patch.color = input.color;
  }
  if (input.isActive !== undefined) {
    patch.is_active = input.isActive;
  }

  const { data, error } = await supabase
    .from("procurement_flag_definitions")
    .update(patch)
    .eq("id", id)
    .select("id, label, color, sort_order, is_active")
    .single();

  if (error) {
    throwIfDefsMissing(error);
    if (error.message?.includes("procurement_flag_definitions_label_active_uidx")) {
      throw new Error("Flaga o takiej nazwie już istnieje.");
    }
    throw new Error(error.message);
  }
  const definition = mapFlagDefinitionRow(data);
  if (!definition) throw new Error("Nie znaleziono flagi.");
  revalidateAll();
  return { success: true, definition };
}

/**
 * Soft-delete gdy flaga jest używana; hard delete tylko gdy COUNT=0.
 * `opts.hard` wymusza hard i kończy się błędem, gdy flaga jest używana.
 */
export async function actionDeleteProcurementFlagDefinition(
  id: string,
  opts?: { hard?: boolean }
): Promise<{ success: true; hard: boolean }> {
  await requireOperations("mutate");
  if (!isProcurementFlagUuid(id)) throw new Error("Nieprawidłowy identyfikator flagi.");

  const supabase = createAdminClient();
  const { count, error: usageError } = await supabase
    .from("individual_orders")
    .select("id", { count: "exact", head: true })
    .eq("procurement_flag", id);
  if (usageError) {
    throwIfDefsMissing(usageError);
    throw new Error(usageError.message);
  }
  const used = (count ?? 0) > 0;

  const wantHard = opts?.hard === true || !used;
  if (wantHard) {
    if (used) {
      throw new Error(
        "Flaga jest używana na zamówieniach — dezaktywuj ją zamiast usuwać na stałe."
      );
    }
    const { error } = await supabase
      .from("procurement_flag_definitions")
      .delete()
      .eq("id", id);
    if (error) {
      throwIfDefsMissing(error);
      throw new Error(error.message);
    }
    revalidateAll();
    return { success: true, hard: true };
  }

  const { error } = await supabase
    .from("procurement_flag_definitions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    throwIfDefsMissing(error);
    throw new Error(error.message);
  }
  revalidateAll();
  return { success: true, hard: false };
}

export async function actionReorderProcurementFlagDefinitions(
  ids: string[]
): Promise<{ success: true }> {
  await requireOperations("mutate");
  const uniqueIds = [...new Set(ids.filter((id) => isProcurementFlagUuid(id)))];
  if (!uniqueIds.length) throw new Error("Brak flag do zmiany kolejności.");
  if (uniqueIds.length !== ids.length) {
    throw new Error("Nieprawidłowy identyfikator flagi.");
  }

  const supabase = createAdminClient();
  const { data: rows, error: fetchError } = await supabase
    .from("procurement_flag_definitions")
    .select("id")
    .in("id", uniqueIds);
  if (fetchError) {
    throwIfDefsMissing(fetchError);
    throw new Error(fetchError.message);
  }
  if (!rows || rows.length !== uniqueIds.length) {
    throw new Error("Lista flag jest nieaktualna — odśwież panel i spróbuj ponownie.");
  }

  for (let i = 0; i < uniqueIds.length; i++) {
    const { error } = await supabase
      .from("procurement_flag_definitions")
      .update({
        sort_order: i,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uniqueIds[i]!);
    if (error) {
      throwIfDefsMissing(error);
      throw new Error(error.message);
    }
  }

  revalidateAll();
  return { success: true };
}
