"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrSalesTeamManagement } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { assertManagerCanUseGroupId } from "@/lib/data/sales-group-access";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidateGroupPaths() {
  revalidatePath("/zespol");
  revalidatePath("/zespol/handlowcy");
  revalidatePath("/zespol/grupy");
  revalidatePath("/admin/handlowcy");
}

export async function actionUpsertSalesGroup(form: {
  id?: string;
  name: string;
  sortOrder?: number;
}): Promise<{ success: true; id: string } | { error: string }> {
  const actor = await requireAdminOrSalesTeamManagement("mutate");

  const name = form.name.trim();
  if (!name) return { error: "Podaj nazwę grupy." };

  if (!isAdmin(actor.role)) {
    if (!form.id) {
      return { error: "Tylko administrator może tworzyć nowe grupy." };
    }
    try {
      await assertManagerCanUseGroupId(actor, form.id);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Brak uprawnień." };
    }
  }
  if (name.length > 80) return { error: "Nazwa grupy jest zbyt długa (max 80 znaków)." };

  const sortOrder =
    typeof form.sortOrder === "number" && Number.isFinite(form.sortOrder)
      ? Math.max(0, Math.floor(form.sortOrder))
      : 0;

  const supabase = createAdminClient();

  const duplicateQuery = supabase.from("sales_groups").select("id, name").ilike("name", name);
  if (form.id) duplicateQuery.neq("id", form.id);
  const { data: duplicate } = await duplicateQuery.maybeSingle();
  if (duplicate) {
    return { error: `Grupa „${duplicate.name}" już istnieje.` };
  }

  if (form.id) {
    const { error } = await supabase
      .from("sales_groups")
      .update({ name, sort_order: sortOrder })
      .eq("id", form.id);
    if (error) return { error: error.message };
    revalidateGroupPaths();
    return { success: true, id: form.id };
  }

  const { data: inserted, error } = await supabase
    .from("sales_groups")
    .insert({ name, sort_order: sortOrder })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidateGroupPaths();
  return { success: true, id: inserted.id };
}

export async function actionDeleteSalesGroup(
  id: string
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAdminOrSalesTeamManagement("mutate");

  const supabase = createAdminClient();

  const { data: group } = await supabase
    .from("sales_groups")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!group) return { error: "Nie znaleziono grupy." };

  if (!isAdmin(actor.role)) {
    try {
      await assertManagerCanUseGroupId(actor, id);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Brak uprawnień." };
    }
  }

  const { count } = await supabase
    .from("sales_people")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);

  if ((count ?? 0) > 0) {
    return {
      error: `Nie można usunąć grupy „${group.name}" — przypisanych jest ${count} handlowców. Najpierw przenieś ich do innej grupy.`,
    };
  }

  const { error } = await supabase.from("sales_groups").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateGroupPaths();
  return { success: true };
}
