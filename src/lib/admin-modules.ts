import { createAdminClient } from "@/lib/supabase/admin";

export const MAIL_CENTER_MODULE_SLUG = "ivoclar_weekly_mail_center";

export async function fetchMailCenterModuleEnabledForUserId(
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_admin_modules")
    .select("enabled")
    .eq("user_id", userId)
    .eq("module_slug", MAIL_CENTER_MODULE_SLUG)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.enabled);
}

/**
 * Dla MVP (jeden moduł) zamiast listy zwracamy listę z 0/1 elementem,
 * żeby łatwo podpiąć filtr nav.
 */
export async function fetchEnabledAdminModulesForUserId(
  userId: string
): Promise<string[]> {
  const enabled = await fetchMailCenterModuleEnabledForUserId(userId);
  return enabled ? [MAIL_CENTER_MODULE_SLUG] : [];
}

export async function hasMailCenterModuleForUserId(userId: string): Promise<boolean> {
  return fetchMailCenterModuleEnabledForUserId(userId);
}

