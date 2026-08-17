import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  normalizeZdBoostPowerPreset,
  parseZdBoostPowerPresetSetting,
  serializeZdBoostPowerPresetSetting,
  ZD_BOOST_POWER_DEFAULT,
  type ZdBoostPowerPreset,
} from "@/lib/orders/zd-estimate-boost-presets";

/** Klucz w app_settings (JSONB { preset }). */
export const ZD_ESTIMATE_SALES_TRACK_BOOST_SETTING_KEY =
  "zd_estimate_sales_track_boost";

export async function fetchZdBoostPowerPreset(): Promise<ZdBoostPowerPreset> {
  if (!hasSupabaseConfig()) return ZD_BOOST_POWER_DEFAULT;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ZD_ESTIMATE_SALES_TRACK_BOOST_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error("fetchZdBoostPowerPreset:", error.message);
    return ZD_BOOST_POWER_DEFAULT;
  }
  return parseZdBoostPowerPresetSetting(data?.value ?? null);
}

export async function upsertZdBoostPowerPreset(
  preset: ZdBoostPowerPreset
): Promise<ZdBoostPowerPreset> {
  const normalized = normalizeZdBoostPowerPreset(preset);
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: ZD_ESTIMATE_SALES_TRACK_BOOST_SETTING_KEY,
    value: serializeZdBoostPowerPresetSetting(normalized),
  });
  if (error) throw new Error(error.message);
  return normalized;
}
