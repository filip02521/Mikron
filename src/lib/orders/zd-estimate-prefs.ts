/**
 * Per-user UI prefs kreatora ZD (`profiles.preferences.zd_estimate`).
 * Nigdy nie trzyma mocy boosta — to `app_settings`.
 *
 * `dniZapasu` zapisuj tylko po ręcznej zmianie pola w UI — nie po launchu
 * z Dziś / wyborze grupy (to zapas stock, nie osobisty fallback).
 */

import {
  defaultDirForZdEstimateSortKey,
  type ZdEstimateListSortDir,
  type ZdEstimateListSortKey,
} from "@/lib/orders/zd-estimate-sort";

export const ZD_ESTIMATE_PREFS_KEY = "zd_estimate";

export const ZD_ESTIMATE_LIST_FILTERS = [
  "order",
  "all",
  "excluded",
  "review",
] as const;

export type ZdEstimateListFilter = (typeof ZD_ESTIMATE_LIST_FILTERS)[number];

export type ZdEstimateUiPrefs = {
  zapasMin: number;
  showAdvanced: boolean;
  showZkColumn: boolean;
  showStockDetail: boolean;
  listFilter: ZdEstimateListFilter;
  sortKey: ZdEstimateListSortKey;
  sortDir: ZdEstimateListSortDir;
  /**
   * Ostatnie dni zapasu — fallback gdy brak interwału dostawcy/grupy.
   * Nie nadpisuje zapasu z harmonogramu przy launchu z Dziś.
   */
  dniZapasu: number | null;
};

export const ZD_ESTIMATE_UI_PREFS_DEFAULTS: ZdEstimateUiPrefs = {
  zapasMin: 0,
  showAdvanced: false,
  showZkColumn: false,
  showStockDetail: false,
  listFilter: "order",
  sortKey: "doZd",
  sortDir: "desc",
  dniZapasu: null,
};

const SORT_KEYS = new Set<ZdEstimateListSortKey>([
  "symbol",
  "name",
  "doZd",
  "confidence",
]);

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asZapasMin(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(10_000, n);
}

function asDniZapasu(value: unknown): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(365, n);
}

function asListFilter(value: unknown): ZdEstimateListFilter {
  return ZD_ESTIMATE_LIST_FILTERS.includes(value as ZdEstimateListFilter)
    ? (value as ZdEstimateListFilter)
    : "order";
}

function asSortKey(value: unknown): ZdEstimateListSortKey {
  return SORT_KEYS.has(value as ZdEstimateListSortKey)
    ? (value as ZdEstimateListSortKey)
    : "doZd";
}

function asSortDir(
  value: unknown,
  sortKey: ZdEstimateListSortKey
): ZdEstimateListSortDir {
  if (value === "asc" || value === "desc") return value;
  return defaultDirForZdEstimateSortKey(sortKey);
}

/** Parsuje surowy JSON — nieznane / boost pola są ignorowane. */
export function parseZdEstimateUiPrefs(raw: unknown): ZdEstimateUiPrefs {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const sortKey = asSortKey(obj.sortKey);
  return {
    zapasMin: asZapasMin(obj.zapasMin),
    showAdvanced: asBool(obj.showAdvanced, false),
    showZkColumn: asBool(obj.showZkColumn, false),
    showStockDetail: asBool(obj.showStockDetail, false),
    listFilter: asListFilter(obj.listFilter),
    sortKey,
    sortDir: asSortDir(obj.sortDir, sortKey),
    dniZapasu: asDniZapasu(obj.dniZapasu),
  };
}

export function zdEstimateUiPrefsFromProfilePreferences(
  preferences: unknown
): ZdEstimateUiPrefs {
  const root =
    preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? (preferences as Record<string, unknown>)
      : {};
  return parseZdEstimateUiPrefs(root[ZD_ESTIMATE_PREFS_KEY]);
}

export function serializeZdEstimateUiPrefs(
  prefs: ZdEstimateUiPrefs
): Record<string, unknown> {
  const normalized = parseZdEstimateUiPrefs(prefs);
  return {
    zapasMin: normalized.zapasMin,
    showAdvanced: normalized.showAdvanced,
    showZkColumn: normalized.showZkColumn,
    showStockDetail: normalized.showStockDetail,
    listFilter: normalized.listFilter,
    sortKey: normalized.sortKey,
    sortDir: normalized.sortDir,
    ...(normalized.dniZapasu != null
      ? { dniZapasu: normalized.dniZapasu }
      : {}),
  };
}

/** Merge patch do `profiles.preferences` — nie rusza boostu ani innych kluczy. */
export function mergeZdEstimateUiPrefsIntoPreferences(
  existing: unknown,
  patch: Partial<ZdEstimateUiPrefs>
): Record<string, unknown> {
  const root =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const current = parseZdEstimateUiPrefs(root[ZD_ESTIMATE_PREFS_KEY]);
  const next = parseZdEstimateUiPrefs({ ...current, ...patch });
  return {
    ...root,
    [ZD_ESTIMATE_PREFS_KEY]: serializeZdEstimateUiPrefs(next),
  };
}

export function zdEstimateUiPrefsEqual(
  a: ZdEstimateUiPrefs,
  b: ZdEstimateUiPrefs
): boolean {
  return (
    a.zapasMin === b.zapasMin &&
    a.showAdvanced === b.showAdvanced &&
    a.showZkColumn === b.showZkColumn &&
    a.showStockDetail === b.showStockDetail &&
    a.listFilter === b.listFilter &&
    a.sortKey === b.sortKey &&
    a.sortDir === b.sortDir &&
    a.dniZapasu === b.dniZapasu
  );
}
