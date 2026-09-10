/**
 * Ephemeral sessionStorage persistence for the ZD estimate prep form
 * (/zakupy/szacunek) — values the user sets BEFORE running „Policz".
 *
 * Sesja zewnętrzna (DB-backed, post-Policz) nadal ma pierwszeństwo:
 * `applyExternalSessionPayload` nadpisuje te wartości po restore.
 *
 * Przechowujemy tylko kluczowe pola wyboru zakresu i parametry Policz.
 * Nie trzymamy list wyników, qty overrides, ani stanu post-create.
 */

import {
  ZD_BOOST_POWER_PRESET_IDS,
  normalizeZdBoostPowerPreset,
  type ZdBoostPowerPreset,
} from "@/lib/orders/zd-estimate-boost-presets";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateSalesWindowSource } from "@/lib/orders/zd-estimate-sales-window";
import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
} from "@/app/actions/zd-estimate";

export const ZD_ESTIMATE_PREP_FORM_SESSION_KEY =
  "zd_estimate_prep_form_v1";

const SCHEMA_VERSION = 1;

export type ZdEstimatePrepFormSession = {
  v: number;
  scopeMode: ZdEstimateRunMode;
  selectedGroup: ZdEstimateGroupOption | null;
  selectedCecha: ZdEstimateCechaOption | null;
  groupQuery: string;
  cechaQuery: string;
  supplierId: string | null;
  dniZapasu: string;
  dataOd: string;
  dataDo: string;
  zapasMin: string;
  showAdvanced: boolean;
  salesWindowSource: ZdEstimateSalesWindowSource;
  boostPreset: ZdBoostPowerPreset;
  extrasPolicy: ZdEstimateExtrasPolicy;
};

function canUseSessionStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  );
}

function isZdEstimateRunMode(v: unknown): v is ZdEstimateRunMode {
  return v === "grupa" || v === "cecha";
}

function isZdEstimateSalesWindowSource(
  v: unknown
): v is ZdEstimateSalesWindowSource {
  return v === "stock" || v === "manual";
}

function isZdEstimateExtrasPolicy(
  v: unknown
): v is ZdEstimateExtrasPolicy {
  return v === "sum" || v === "max";
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNullableNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

function asSupplierMatchSource(
  v: unknown
): "mapping" | "name" | null {
  return v === "mapping" || v === "name" ? v : null;
}

function parseGroupOption(
  raw: unknown
): ZdEstimateGroupOption | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ZdEstimateGroupOption>;
  if (typeof r.grt_Id !== "number" || typeof r.grt_Nazwa !== "string") {
    return null;
  }
  return {
    grt_Id: r.grt_Id,
    grt_Nazwa: r.grt_Nazwa,
    supplierId: asNullableString(r.supplierId),
    supplierName: asNullableString(r.supplierName),
    dniZapasu: asNullableNumber(r.dniZapasu),
    stockLabel: asNullableString(r.stockLabel),
    subiektKhId: asNullableNumber(r.subiektKhId),
    additionalSubiektKhIds: asNumberArray(r.additionalSubiektKhIds),
    supplierMatchSource: asSupplierMatchSource(r.supplierMatchSource),
    supplierMappingUnresolved: Boolean(r.supplierMappingUnresolved),
  };
}

function parseCechaOption(
  raw: unknown
): ZdEstimateCechaOption | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ZdEstimateCechaOption>;
  if (typeof r.ctw_Id !== "number" || typeof r.ctw_Nazwa !== "string") {
    return null;
  }
  return {
    ctw_Id: r.ctw_Id,
    ctw_Nazwa: r.ctw_Nazwa,
    supplierId: asNullableString(r.supplierId),
    supplierName: asNullableString(r.supplierName),
    dniZapasu: asNullableNumber(r.dniZapasu),
    stockLabel: asNullableString(r.stockLabel),
    subiektKhId: asNullableNumber(r.subiektKhId),
    additionalSubiektKhIds: asNumberArray(r.additionalSubiektKhIds),
    supplierMatchSource: asSupplierMatchSource(r.supplierMatchSource),
    supplierMappingUnresolved: Boolean(r.supplierMappingUnresolved),
  };
}

/**
 * Odczytaj zapisany stan formularza przygotowawczego.
 * Zwraca null gdy brak / uszkodzony / nieprawidłowa wersja.
 */
export function readZdEstimatePrepFormSession(): ZdEstimatePrepFormSession | null {
  if (!canUseSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(
    ZD_ESTIMATE_PREP_FORM_SESSION_KEY
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ZdEstimatePrepFormSession>;
    if (parsed.v !== SCHEMA_VERSION) return null;
    if (!isZdEstimateRunMode(parsed.scopeMode)) return null;
    if (!isZdEstimateSalesWindowSource(parsed.salesWindowSource)) {
      return null;
    }
    if (!isZdEstimateExtrasPolicy(parsed.extrasPolicy)) return null;
    const boostPreset = normalizeZdBoostPowerPreset(parsed.boostPreset);
    if (!ZD_BOOST_POWER_PRESET_IDS.includes(boostPreset)) return null;
    return {
      v: SCHEMA_VERSION,
      scopeMode: parsed.scopeMode,
      selectedGroup: parseGroupOption(parsed.selectedGroup),
      selectedCecha: parseCechaOption(parsed.selectedCecha),
      groupQuery: typeof parsed.groupQuery === "string" ? parsed.groupQuery : "",
      cechaQuery: typeof parsed.cechaQuery === "string" ? parsed.cechaQuery : "",
      supplierId:
        parsed.supplierId != null && String(parsed.supplierId).trim()
          ? String(parsed.supplierId)
          : null,
      dniZapasu:
        typeof parsed.dniZapasu === "string" ? parsed.dniZapasu : "",
      dataOd: typeof parsed.dataOd === "string" ? parsed.dataOd : "",
      dataDo: typeof parsed.dataDo === "string" ? parsed.dataDo : "",
      zapasMin: typeof parsed.zapasMin === "string" ? parsed.zapasMin : "0",
      showAdvanced: Boolean(parsed.showAdvanced),
      salesWindowSource: parsed.salesWindowSource,
      boostPreset,
      extrasPolicy: parsed.extrasPolicy,
    };
  } catch {
    return null;
  }
}

/**
 * Zapisz stan formularza przygotowawczego (fire-and-forget, bez throw).
 */
export function writeZdEstimatePrepFormSession(
  values: Omit<ZdEstimatePrepFormSession, "v">
): void {
  if (!canUseSessionStorage()) return;
  try {
    const payload: ZdEstimatePrepFormSession = { v: SCHEMA_VERSION, ...values };
    window.sessionStorage.setItem(
      ZD_ESTIMATE_PREP_FORM_SESSION_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // sessionStorage pełny / niedostępny — ignoruj (ephemeral feature).
  }
}

/**
 * Wyczyść zapisany stan formularza przygotowawczego.
 */
export function clearZdEstimatePrepFormSession(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(ZD_ESTIMATE_PREP_FORM_SESSION_KEY);
  } catch {
    // ignore
  }
}
