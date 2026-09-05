import type { SupabaseClient } from "@/lib/db/admin";

/** Po zmianie e-mailu na karcie handlowca — zsynchronizuj login w auth i profiles. */
export async function syncLinkedSalesPersonLoginEmail(
  supabase: SupabaseClient,
  salesPersonId: string,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  if (profileLookupError) return profileLookupError.message;
  if (!profile) return null;

  const currentEmail = (profile.email ?? "").trim().toLowerCase();
  if (currentEmail === normalized) return null;

  const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
    email: normalized,
  });
  if (authError) return authError.message;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: normalized })
    .eq("id", profile.id);

  if (profileError) return profileError.message;
  return null;
}

/**
 * Po powiązaniu konta z handlowcem — ustaw e-mail na karcie = e-mail logowania,
 * żeby powiadomienia (Tablica, regał…) trafiały tam, gdzie wskazuje panel Użytkownicy.
 */
export async function syncSalesPersonCardEmailFromProfile(
  supabase: SupabaseClient,
  salesPersonId: string,
  profileEmail: string | null | undefined
): Promise<string | null> {
  const normalized = profileEmail?.trim().toLowerCase();
  if (!normalized) return null;

  const { data: sp, error: lookupError } = await supabase
    .from("sales_people")
    .select("email")
    .eq("id", salesPersonId)
    .maybeSingle();

  if (lookupError) return lookupError.message;
  if (!sp) return null;

  const current = (sp.email ?? "").trim().toLowerCase();
  if (current === normalized) return null;

  const { error } = await supabase
    .from("sales_people")
    .update({ email: normalized })
    .eq("id", salesPersonId);

  return error?.message ?? null;
}
