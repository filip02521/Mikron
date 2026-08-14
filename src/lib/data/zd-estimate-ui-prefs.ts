import { createClient } from "@/lib/supabase/server";
import {
  mergeZdEstimateUiPrefsIntoPreferences,
  parseZdEstimateUiPrefs,
  zdEstimateUiPrefsFromProfilePreferences,
  ZD_ESTIMATE_UI_PREFS_DEFAULTS,
  type ZdEstimateUiPrefs,
} from "@/lib/orders/zd-estimate-prefs";

export async function fetchOwnZdEstimateUiPrefs(): Promise<ZdEstimateUiPrefs> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ZD_ESTIMATE_UI_PREFS_DEFAULTS;

  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return ZD_ESTIMATE_UI_PREFS_DEFAULTS;
  return zdEstimateUiPrefsFromProfilePreferences(data.preferences);
}

export async function upsertOwnZdEstimateUiPrefs(
  patch: Partial<ZdEstimateUiPrefs>
): Promise<ZdEstimateUiPrefs> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const { data: current, error: fetchError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (fetchError || !current) {
    throw new Error(fetchError?.message ?? "Nie znaleziono profilu.");
  }

  const nextPrefs = mergeZdEstimateUiPrefsIntoPreferences(
    current.preferences,
    patch
  );
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferences: nextPrefs })
    .eq("id", user.id);
  if (updateError) throw new Error(updateError.message);
  return parseZdEstimateUiPrefs(nextPrefs.zd_estimate);
}
