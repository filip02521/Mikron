import type { SupabaseClient } from "@/lib/db/admin";

/** Sprawdza, czy handlowiec nie jest już powiązany z innym kontem. */
export async function assertUniqueSalesPersonLink(
  supabase: SupabaseClient,
  salesPersonId: string | null,
  excludeUserId?: string
): Promise<string | null> {
  if (!salesPersonId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  if (error) return error.message;
  if (data && data.id !== excludeUserId) {
    return `Ten handlowiec jest już powiązany z kontem ${data.email ?? data.id}.`;
  }
  return null;
}

/**
 * Po ustawieniu hasła z linku zaproszenia — dopina powiązanie z handlowcem z metadanej zaproszenia.
 * Celowo NIE jest server action: id użytkownika musi pochodzić z sesji wołającego.
 * Nie zmienia roli kont innych niż handlowiec (awansowany kierownik nie zostaje zdegradowany).
 */
export async function finalizeSalesPersonInviteForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: true } | { error: string }> {
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authData.user) {
    return { error: authError?.message ?? "Nie znaleziono użytkownika." };
  }

  const raw = authData.user.user_metadata?.sales_person_id;
  const salesPersonId = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  if (!salesPersonId) return { success: true };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return { error: profileError.message };
  if (profile?.role && profile.role !== "sales") return { success: true };

  const linkError = await assertUniqueSalesPersonLink(supabase, salesPersonId, userId);
  if (linkError) return { error: linkError };

  const email = authData.user.email?.trim().toLowerCase();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: "sales",
      sales_person_id: salesPersonId,
      ...(email ? { email } : {}),
    })
    .eq("id", userId);

  return error ? { error: error.message } : { success: true };
}
