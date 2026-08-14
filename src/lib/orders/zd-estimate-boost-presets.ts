/**
 * Wspólna moc boosta Kreatora ZD — 4 zamknięte presety (bez suwaków).
 * DEFAULT = gentle (bezpieczne podążanie za sprzedażą).
 */

import { ZD_SALES_TRACK } from "@/lib/orders/zd-estimate-sales-track";

export type ZdBoostPowerPreset =
  | "off"
  | "gentle"
  | "standard"
  | "aggressive";

export type ZdSalesTrackPolicy = typeof ZD_SALES_TRACK;

export const ZD_BOOST_POWER_DEFAULT: ZdBoostPowerPreset = "gentle";

export const ZD_BOOST_POWER_PRESET_IDS: readonly ZdBoostPowerPreset[] = [
  "off",
  "gentle",
  "standard",
  "aggressive",
] as const;

type PresetDef = {
  id: ZdBoostPowerPreset;
  label: string;
  hint: string;
  /** Partial nadpisujący ZD_SALES_TRACK; standard = {}. */
  partial: {
    [K in keyof ZdSalesTrackPolicy]?: number;
  };
};

/**
 * Knobs boost-only. Cut / deadband / ST floors / history — bez zmian.
 * off: zeruje boost; salesTrack zostaje true (cięcia działają).
 */
export const ZD_BOOST_PRESET_DEFS: readonly PresetDef[] = [
  {
    id: "off",
    label: "Wyłączony",
    hint: "Bez podbijania sztuk; cięcia przy grubym cover nadal działają.",
    partial: {
      maxTotalBoostRatio: 0,
      sellThroughMaxBoost: 0,
      coverRamp: 0,
      maxCoverExtraDays: 0,
    },
  },
  {
    id: "gentle",
    label: "Delikatny (zalecany)",
    hint: "Przy silnej sprzedaży podąża (+~20% celu); przy słabej pewności nie dokłada.",
    partial: {
      maxTotalBoostRatio: 0.2,
      sellThroughMaxBoost: 0.08,
      coverRamp: 0.25,
      maxCoverExtraDays: 6,
      boostQtyConfidenceMin: 0.55,
    },
  },
  {
    id: "standard",
    label: "Standard (dotychczasowe)",
    hint: "Dotychczasowa moc podbijania (cap 35%).",
    partial: {},
  },
  {
    id: "aggressive",
    label: "Agresywny",
    hint: "Mocniejsze podbicie (do +50% celu przy wysokiej pewności).",
    partial: {
      maxTotalBoostRatio: 0.5,
      sellThroughMaxBoost: 0.22,
      coverRamp: 0.55,
      maxCoverExtraDays: 14,
      boostQtyConfidenceMin: 0.45,
    },
  },
] as const;

export function normalizeZdBoostPowerPreset(
  value: unknown
): ZdBoostPowerPreset {
  if (
    value === "off" ||
    value === "gentle" ||
    value === "standard" ||
    value === "aggressive"
  ) {
    return value;
  }
  return ZD_BOOST_POWER_DEFAULT;
}

export function boostPresetDef(
  preset: ZdBoostPowerPreset
): PresetDef {
  return (
    ZD_BOOST_PRESET_DEFS.find((d) => d.id === preset) ??
    ZD_BOOST_PRESET_DEFS.find((d) => d.id === ZD_BOOST_POWER_DEFAULT)!
  );
}

/**
 * Pełna polityka po merge + assert — nigdy ad-hoc Partial z UI.
 */
export function policyForBoostPreset(
  preset: ZdBoostPowerPreset | null | undefined
): ZdSalesTrackPolicy {
  const id = normalizeZdBoostPowerPreset(preset);
  const def = boostPresetDef(id);
  const policy = { ...ZD_SALES_TRACK, ...def.partial } as ZdSalesTrackPolicy;
  assertBoostPolicySafe(policy);
  return policy;
}

export function assertBoostPolicySafe(
  policy: ZdSalesTrackPolicy
): void {
  const {
    sellThroughMaxBoost,
    maxTotalBoostRatio,
    coverRamp,
    maxCoverExtraDays,
    boostQtyConfidenceMin,
    boostQtyReviewConfidenceMax,
  } = policy;

  if (!(sellThroughMaxBoost >= 0)) {
    throw new Error("sellThroughMaxBoost < 0");
  }
  if (!(sellThroughMaxBoost <= maxTotalBoostRatio + 1e-12)) {
    throw new Error("sellThroughMaxBoost > maxTotalBoostRatio");
  }
  if (!(maxTotalBoostRatio <= 0.6 + 1e-12)) {
    throw new Error("maxTotalBoostRatio > 0.60");
  }
  if (!(coverRamp >= 0 && coverRamp <= 1 + 1e-12)) {
    throw new Error("coverRamp poza [0, 1]");
  }
  if (!(maxCoverExtraDays >= 0 && maxCoverExtraDays <= 21 + 1e-12)) {
    throw new Error("maxCoverExtraDays poza [0, 21]");
  }
  if (
    !(
      boostQtyConfidenceMin >= 0 &&
      boostQtyConfidenceMin <= boostQtyReviewConfidenceMax + 1e-12 &&
      boostQtyReviewConfidenceMax <= 1 + 1e-12
    )
  ) {
    throw new Error("confidence gates niespójne");
  }
}

/** Parse wartości z app_settings JSON. */
export function parseZdBoostPowerPresetSetting(
  raw: unknown
): ZdBoostPowerPreset {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const preset = (raw as { preset?: unknown }).preset;
    return normalizeZdBoostPowerPreset(preset);
  }
  if (typeof raw === "string") {
    return normalizeZdBoostPowerPreset(raw);
  }
  return ZD_BOOST_POWER_DEFAULT;
}

export function serializeZdBoostPowerPresetSetting(
  preset: ZdBoostPowerPreset
): { preset: ZdBoostPowerPreset } {
  return { preset: normalizeZdBoostPowerPreset(preset) };
}
