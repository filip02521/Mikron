/** Feature flags dla delivery_stats / ETA (env + app_settings). */

export const DELIVERY_STATS_FROM_SAMPLES_SETTING_KEY = "delivery_stats_from_samples";
export const DELIVERY_ETA_USE_P50_SETTING_KEY = "delivery_eta_use_p50";

function parseEnvFlag(raw: string | undefined, defaultEnabled: boolean): boolean {
  const v = raw?.trim().toLowerCase();
  if (v == null || v === "") return defaultEnabled;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return defaultEnabled;
}

/** Domyślnie off — dual-write bez cutoveru mean z samples. */
export function isDeliveryStatsFromSamplesEnvEnabled(): boolean {
  return parseEnvFlag(process.env.DELIVERY_STATS_FROM_SAMPLES, false);
}

/** Domyślnie off — primary ETA = mean; p50 w expanded gdy dostępne. */
export function isDeliveryEtaUseP50EnvEnabled(): boolean {
  return parseEnvFlag(process.env.ETA_USE_P50, false);
}

/** Cache z app_settings — ustawiane przez fetchDeliveryEtaUseP50Enabled. */
let useP50SyncCache: boolean | null = null;

export function setDeliveryEtaUseP50SyncCache(enabled: boolean): void {
  useP50SyncCache = enabled;
}

/** Sync read: cache DB → env. */
export function isDeliveryEtaUseP50EnabledSync(): boolean {
  if (useP50SyncCache != null) return useP50SyncCache;
  return isDeliveryEtaUseP50EnvEnabled();
}

export function parseDeliveryStatsFlagSetting(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    return typeof enabled === "boolean" ? enabled : null;
  }
  return null;
}

export function serializeDeliveryStatsFlagSetting(enabled: boolean): { enabled: boolean } {
  return { enabled: Boolean(enabled) };
}
