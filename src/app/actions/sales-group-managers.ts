"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidateManagerPaths() {
  revalidatePath("/admin/uzytkownicy");
  revalidatePath("/zespol");
  revalidatePath("/zespol/handlowcy");
}

/** Przypisanie grup (Sklep/Biuro) do konta kierownika — tylko admin. */
export async function actionSetSalesManagerGroups(
  profileId: string,
  groupIds: string[]
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();

  const pid = profileId?.trim();
  if (!pid) return { error: "Brak identyfikatora użytkownika." };

  const unique = [...new Set(groupIds.map((g) => g.trim()).filter(Boolean))];

  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", pid)
    .maybeSingle();
  if (profileError) return { error: profileError.message };
  if (!profile) return { error: "Nie znaleziono użytkownika." };
  if (profile.role !== "sales_manager") {
    return { error: "Grupy przypisuje się tylko do roli kierownika handlowców." };
  }

  if (unique.length) {
    const { data: groups, error: groupsError } = await supabase
      .from("sales_groups")
      .select("id")
      .in("id", unique);
    if (groupsError) return { error: groupsError.message };
    if ((groups ?? []).length !== unique.length) {
      return { error: "Jedna z wybranych grup nie istnieje." };
    }
  }

  const { error: deleteError } = await supabase
    .from("sales_group_managers")
    .delete()
    .eq("profile_id", pid);
  if (deleteError) return { error: deleteError.message };

  if (unique.length) {
    const { error: insertError } = await supabase.from("sales_group_managers").insert(
      unique.map((group_id) => ({ profile_id: pid, group_id }))
    );
    if (insertError) return { error: insertError.message };
  }

  revalidateManagerPaths();
  return { success: true };
}
