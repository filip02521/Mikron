import type { SupabaseClient } from "@supabase/supabase-js";

/** Usuwa przypisania grup kierownika (np. przed zmianą roli). */
export async function deleteSalesManagerGroupsForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<string | null> {
  const { error } = await supabase
    .from("sales_group_managers")
    .delete()
    .eq("profile_id", profileId);
  return error?.message ?? null;
}

/** Zapisuje grupy — profil musi mieć już rolę sales_manager. */
export async function replaceSalesManagerGroupsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  groupIds: string[]
): Promise<string | null> {
  const unique = [...new Set(groupIds.map((g) => g.trim()).filter(Boolean))];

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) return profileError.message;
  if (!profile) return "Nie znaleziono użytkownika.";
  if (profile.role !== "sales_manager") {
    return "Grupy przypisuje się tylko do roli kierownika handlowców.";
  }

  if (unique.length) {
    const { data: groups, error: groupsError } = await supabase
      .from("sales_groups")
      .select("id")
      .in("id", unique);
    if (groupsError) return groupsError.message;
    if ((groups ?? []).length !== unique.length) {
      return "Jedna z wybranych grup nie istnieje.";
    }
  }

  const delErr = await deleteSalesManagerGroupsForProfile(supabase, profileId);
  if (delErr) return delErr;

  if (!unique.length) return null;

  const { error: insertError } = await supabase.from("sales_group_managers").insert(
    unique.map((group_id) => ({ profile_id: profileId, group_id }))
  );
  return insertError?.message ?? null;
}
