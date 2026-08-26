import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { assertStrictBooleanInput } from "@/lib/env/informacja-stock-auto";
import {
  DELIVERY_ETA_USE_P50_SETTING_KEY,
  DELIVERY_STATS_FROM_SAMPLES_SETTING_KEY,
  isDeliveryEtaUseP50EnvEnabled,
  isDeliveryStatsFromSamplesEnvEnabled,
  parseDeliveryStatsFlagSetting,
  serializeDeliveryStatsFlagSetting,
  setDeliveryEtaUseP50SyncCache,
} from "@/lib/env/delivery-stats-flags";

async function fetchFlag(
  key: string,
  envFallback: () => boolean
): Promise<boolean> {
  const fallback = envFallback();
  if (!hasSupabaseConfig()) return fallback;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      console.error(`fetchDeliveryStatsFlag(${key}):`, error.message);
      return fallback;
    }
    return parseDeliveryStatsFlagSetting(data?.value) ?? fallback;
  } catch (e) {
    console.error(`fetchDeliveryStatsFlag(${key}) failed:`, e);
    return fallback;
  }
}

async function upsertFlag(key: string, enabled: boolean): Promise<boolean> {
  const normalized = assertStrictBooleanInput(enabled, "enabled");
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value: serializeDeliveryStatsFlagSetting(normalized),
  });
  if (error) throw new Error(error.message);
  return normalized;
}

export async function fetchDeliveryStatsFromSamplesEnabled(): Promise<boolean> {
  return fetchFlag(
    DELIVERY_STATS_FROM_SAMPLES_SETTING_KEY,
    isDeliveryStatsFromSamplesEnvEnabled
  );
}

export async function upsertDeliveryStatsFromSamplesEnabled(
  enabled: boolean
): Promise<boolean> {
  return upsertFlag(DELIVERY_STATS_FROM_SAMPLES_SETTING_KEY, enabled);
}

export async function fetchDeliveryEtaUseP50Enabled(): Promise<boolean> {
  const enabled = await fetchFlag(
    DELIVERY_ETA_USE_P50_SETTING_KEY,
    isDeliveryEtaUseP50EnvEnabled
  );
  setDeliveryEtaUseP50SyncCache(enabled);
  return enabled;
}

export async function upsertDeliveryEtaUseP50Enabled(enabled: boolean): Promise<boolean> {
  const normalized = await upsertFlag(DELIVERY_ETA_USE_P50_SETTING_KEY, enabled);
  setDeliveryEtaUseP50SyncCache(normalized);
  return normalized;
}
