export const INFORMACJA_STOCK_AUTO_SETTING_KEY = "informacja_stock_auto_enabled";

/** Legacy fallback z env — brak env / inna wartość = włączone. */
export function isInformacjaStockAutoEnvEnabled(): boolean {
  const raw = process.env.INFORMACJA_STOCK_AUTO_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

/** Globalne ustawienie w app_settings; null = brak wpisu, użyj fallbacku z env. */
export function parseInformacjaStockAutoSetting(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    return typeof enabled === "boolean" ? enabled : null;
  }
  return null;
}

export function serializeInformacjaStockAutoSetting(enabled: boolean): { enabled: boolean } {
  return { enabled: Boolean(enabled) };
}

/** Odrzuca stringi i truthy/falsy — tylko prawdziwy boolean. */
export function assertStrictBooleanInput(value: unknown, label = "wartość"): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Oczekiwano ${label} typu boolean (true/false).`);
  }
  return value;
}
