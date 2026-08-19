import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  assertStrictBooleanInput,
  INFORMACJA_STOCK_AUTO_SETTING_KEY,
  isInformacjaStockAutoEnvEnabled,
  parseInformacjaStockAutoSetting,
  serializeInformacjaStockAutoSetting,
} from "@/lib/env/informacja-stock-auto";

export async function fetchInformacjaStockAutoEnabled(): Promise<boolean> {
  const fallback = isInformacjaStockAutoEnvEnabled();
  if (!hasSupabaseConfig()) return fallback;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", INFORMACJA_STOCK_AUTO_SETTING_KEY)
      .maybeSingle();
    if (error) {
      console.error("fetchInformacjaStockAutoEnabled:", error.message);
      return fallback;
    }
    return parseInformacjaStockAutoSetting(data?.value) ?? fallback;
  } catch (e) {
    console.error("fetchInformacjaStockAutoEnabled failed:", e);
    return fallback;
  }
}

export async function upsertInformacjaStockAutoEnabled(enabled: boolean): Promise<boolean> {
  const normalized = assertStrictBooleanInput(enabled, "enabled");
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: INFORMACJA_STOCK_AUTO_SETTING_KEY,
    value: serializeInformacjaStockAutoSetting(normalized),
  });
  if (error) throw new Error(error.message);
  return normalized;
}
