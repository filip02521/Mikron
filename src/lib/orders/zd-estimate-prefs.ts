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

/** Opcjonalne kolumny listy (Towar / Do ZD / Akcje zawsze widoczne). */
export const ZD_ESTIMATE_OPTIONAL_COLUMNS = [
  "packaging",
  "status",
  "stock",
  "available",
  "sales",
  "target",
  "openZd",
  "zk",
] as const;

export type ZdEstimateOptionalColumn =
  (typeof ZD_ESTIMATE_OPTIONAL_COLUMNS)[number];

export type ZdEstimateColumnVisibility = Record<
  ZdEstimateOptionalColumn,
  boolean
>;

export const ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS: ZdEstimateColumnVisibility =
  {
    packaging: true,
    status: true,
    stock: false,
    available: true,
    sales: true,
    target: true,
    openZd: true,
    zk: false,
  };

/** Domyślna kolejność opcjonalnych kolumn w menu (Opak. w tabeli jest pinowane przed Do ZD). */
export const ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS: ZdEstimateOptionalColumn[] = [
  ...ZD_ESTIMATE_OPTIONAL_COLUMNS,
];

/**
 * Sekcje skanu listy — granice wizualne tylko przy zmianie grupy
 * (nie przy pierwszej kolumnie po Do ZD — tam jest już sticky edge).
 * `flow` = Dost. / Sprzed. / Cel / Otwarte — jedna zwarta grupa.
 * `packaging` jest pinowane przed Do ZD (nie w scrollu).
 */
export const ZD_ESTIMATE_COLUMN_SECTIONS = {
  packaging: "pack",
  status: "meta",
  stock: "stock",
  available: "flow",
  sales: "flow",
  target: "flow",
  openZd: "flow",
  zk: "diag",
} as const satisfies Record<ZdEstimateOptionalColumn, string>;

export type ZdEstimateColumnSection =
  (typeof ZD_ESTIMATE_COLUMN_SECTIONS)[ZdEstimateOptionalColumn];

/** Widoczne kolumny scrollowane (bez Opak. — to sticky przed Do ZD). */
export function resolveZdEstimateScrollableColumnOrder(
  columns: ZdEstimateColumnVisibility,
  columnOrder: readonly ZdEstimateOptionalColumn[]
): ZdEstimateOptionalColumn[] {
  return resolveZdEstimateVisibleColumnOrder(columns, columnOrder).filter(
    (key) => key !== "packaging"
  );
}

/** Klucze, na których zaczyna się nowa sekcja w widocznej kolejności. */
export function resolveZdEstimateColumnSectionStarts(
  visibleOrder: readonly ZdEstimateOptionalColumn[]
): Set<ZdEstimateOptionalColumn> {
  const starts = new Set<ZdEstimateOptionalColumn>();
  let prevSection: ZdEstimateColumnSection | null = null;
  for (const key of visibleOrder) {
    const section = ZD_ESTIMATE_COLUMN_SECTIONS[key];
    if (prevSection != null && section !== prevSection) {
      starts.add(key);
    }
    prevSection = section;
  }
  return starts;
}

/** Skrót zakresu (grupa / cecha) w ulubionych — id Subiekta + cached nazwa. */
export type ZdEstimateFavoriteRef = {
  id: number;
  label: string;
};

export const ZD_ESTIMATE_FAVORITE_SCOPE_CAP = 12;

/**
 * Seed chipów grupy gdy w prefs **brak** klucza `favoriteGroups`
 * (nie gdy użytkownik zapisał pustą listę `[]`).
 */
export const ZD_ESTIMATE_FAVORITE_GROUPS_SEED: readonly ZdEstimateFavoriteRef[] =
  [
    { id: 17, label: "Falcon" },
    { id: 28, label: "Ivoclar Technical" },
    { id: 3, label: "Ivoclar Clinical" },
    { id: 264, label: "Ivoclar DIGITAL" },
  ];

export type ZdEstimateUiPrefs = {
  zapasMin: number;
  showAdvanced: boolean;
  /** @deprecated Preferuj `columns.zk` — trzymane dla kompatybilności odczytu. */
  showZkColumn: boolean;
  /** @deprecated Preferuj `columns.stock`. */
  showStockDetail: boolean;
  /** Widoczność opcjonalnych kolumn listy. */
  columns: ZdEstimateColumnVisibility;
  /** Kolejność opcjonalnych kolumn (pełna permutacja kluczy). */
  columnOrder: ZdEstimateOptionalColumn[];
  listFilter: ZdEstimateListFilter;
  sortKey: ZdEstimateListSortKey;
  sortDir: ZdEstimateListSortDir;
  /**
   * Ostatnie dni zapasu — fallback gdy brak interwału dostawcy/grupy.
   * Nie nadpisuje zapasu z harmonogramu przy launchu z Dziś.
   */
  dniZapasu: number | null;
  /** Ulubione grupy towarowe (kolejność = kolejność chipów). */
  favoriteGroups: ZdEstimateFavoriteRef[];
  /** Ulubione cechy towarów. */
  favoriteCechy: ZdEstimateFavoriteRef[];
};

export const ZD_ESTIMATE_UI_PREFS_DEFAULTS: ZdEstimateUiPrefs = {
  zapasMin: 0,
  showAdvanced: false,
  showZkColumn: false,
  showStockDetail: false,
  columns: { ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS },
  columnOrder: [...ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS],
  listFilter: "order",
  sortKey: "doZd",
  sortDir: "desc",
  dniZapasu: null,
  favoriteGroups: ZD_ESTIMATE_FAVORITE_GROUPS_SEED.map((f) => ({ ...f })),
  favoriteCechy: [],
};

const SORT_KEYS = new Set<ZdEstimateListSortKey>([
  "symbol",
  "name",
  "doZd",
  "confidence",
]);

const OPTIONAL_COLUMN_SET = new Set<string>(ZD_ESTIMATE_OPTIONAL_COLUMNS);

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

export function parseZdEstimateColumnVisibility(
  raw: unknown,
  legacy?: { showZkColumn?: unknown; showStockDetail?: unknown }
): ZdEstimateColumnVisibility {
  const base: ZdEstimateColumnVisibility = {
    ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
  };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const key of ZD_ESTIMATE_OPTIONAL_COLUMNS) {
      if (typeof obj[key] === "boolean") {
        base[key] = obj[key];
      }
    }
  } else {
    // Legacy: tylko showZkColumn / showStockDetail
    if (typeof legacy?.showStockDetail === "boolean") {
      base.stock = legacy.showStockDetail;
    }
    if (typeof legacy?.showZkColumn === "boolean") {
      base.zk = legacy.showZkColumn;
    }
  }
  return base;
}

export function zdEstimateColumnVisibilityEqual(
  a: ZdEstimateColumnVisibility,
  b: ZdEstimateColumnVisibility
): boolean {
  return ZD_ESTIMATE_OPTIONAL_COLUMNS.every((key) => a[key] === b[key]);
}

export function toggleZdEstimateColumnVisibility(
  columns: ZdEstimateColumnVisibility,
  key: ZdEstimateOptionalColumn
): ZdEstimateColumnVisibility {
  if (!OPTIONAL_COLUMN_SET.has(key)) return columns;
  return { ...columns, [key]: !columns[key] };
}

/** Pełna kolejność: zapisane klucze + brakujące dopięte na końcu w kolejności domyślnej. */
export function parseZdEstimateColumnOrder(
  raw: unknown
): ZdEstimateOptionalColumn[] {
  const ordered: ZdEstimateOptionalColumn[] = [];
  const seen = new Set<ZdEstimateOptionalColumn>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (
        typeof item === "string" &&
        OPTIONAL_COLUMN_SET.has(item) &&
        !seen.has(item as ZdEstimateOptionalColumn)
      ) {
        const key = item as ZdEstimateOptionalColumn;
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  for (const key of ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
}

export function zdEstimateColumnOrderEqual(
  a: readonly ZdEstimateOptionalColumn[],
  b: readonly ZdEstimateOptionalColumn[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((key, i) => key === b[i]);
}

export function moveZdEstimateColumnOrder(
  order: readonly ZdEstimateOptionalColumn[],
  key: ZdEstimateOptionalColumn,
  direction: "up" | "down"
): ZdEstimateOptionalColumn[] {
  const next = parseZdEstimateColumnOrder(order);
  const i = next.indexOf(key);
  if (i < 0) return next;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= next.length) return next;
  const swap = next[i]!;
  next[i] = next[j]!;
  next[j] = swap;
  return next;
}

/** Widoczne kolumny w zapisanej kolejności. */
export function resolveZdEstimateVisibleColumnOrder(
  columns: ZdEstimateColumnVisibility,
  columnOrder: readonly ZdEstimateOptionalColumn[]
): ZdEstimateOptionalColumn[] {
  return parseZdEstimateColumnOrder(columnOrder).filter((key) => columns[key]);
}

/**
 * Parsuje listę ulubionych.
 * `whenMissing` tylko gdy wywołujący wie, że klucza nie było w JSON.
 */
export function parseZdEstimateFavoriteRefs(
  raw: unknown,
  whenMissing?: readonly ZdEstimateFavoriteRef[]
): ZdEstimateFavoriteRef[] {
  if (raw === undefined && whenMissing) {
    return whenMissing.map((f) => ({ id: f.id, label: f.label }));
  }
  if (!Array.isArray(raw)) return [];
  const out: ZdEstimateFavoriteRef[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const id = Math.trunc(Number(row.id));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    const label = String(row.label ?? "").trim() || `#${id}`;
    seen.add(id);
    out.push({ id, label });
    if (out.length >= ZD_ESTIMATE_FAVORITE_SCOPE_CAP) break;
  }
  return out;
}

export function zdEstimateFavoriteRefsEqual(
  a: readonly ZdEstimateFavoriteRef[],
  b: readonly ZdEstimateFavoriteRef[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((f, i) => f.id === b[i]!.id && f.label === b[i]!.label);
}

export function isZdEstimateFavorite(
  list: readonly ZdEstimateFavoriteRef[],
  id: number
): boolean {
  const n = Math.trunc(Number(id));
  if (!Number.isFinite(n) || n <= 0) return false;
  return list.some((f) => f.id === n);
}

export type ToggleZdEstimateFavoriteResult =
  | { ok: true; next: ZdEstimateFavoriteRef[]; added: boolean }
  | {
      ok: false;
      reason: "at_cap";
      next: ZdEstimateFavoriteRef[];
      added: false;
    };

/** Toggle ulubionego — nowe na końcu; cap bez dodania. */
export function toggleZdEstimateFavorite(
  list: readonly ZdEstimateFavoriteRef[],
  ref: ZdEstimateFavoriteRef
): ToggleZdEstimateFavoriteResult {
  const id = Math.trunc(Number(ref.id));
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: true, next: [...list], added: false };
  }
  const label = String(ref.label ?? "").trim() || `#${id}`;
  if (list.some((f) => f.id === id)) {
    return {
      ok: true,
      next: list.filter((f) => f.id !== id),
      added: false,
    };
  }
  if (list.length >= ZD_ESTIMATE_FAVORITE_SCOPE_CAP) {
    return { ok: false, reason: "at_cap", next: [...list], added: false };
  }
  return {
    ok: true,
    next: [...list, { id, label }],
    added: true,
  };
}

/** Parsuje surowy JSON — nieznane / boost pola są ignorowane. */
export function parseZdEstimateUiPrefs(raw: unknown): ZdEstimateUiPrefs {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const sortKey = asSortKey(obj.sortKey);
  const columns = parseZdEstimateColumnVisibility(obj.columns, {
    showZkColumn: obj.showZkColumn,
    showStockDetail: obj.showStockDetail,
  });
  const columnOrder = parseZdEstimateColumnOrder(obj.columnOrder);
  const hasFavoriteGroups = Object.prototype.hasOwnProperty.call(
    obj,
    "favoriteGroups"
  );
  const hasFavoriteCechy = Object.prototype.hasOwnProperty.call(
    obj,
    "favoriteCechy"
  );
  return {
    zapasMin: asZapasMin(obj.zapasMin),
    showAdvanced: asBool(obj.showAdvanced, false),
    showZkColumn: columns.zk,
    showStockDetail: columns.stock,
    columns,
    columnOrder,
    listFilter: asListFilter(obj.listFilter),
    sortKey,
    sortDir: asSortDir(obj.sortDir, sortKey),
    dniZapasu: asDniZapasu(obj.dniZapasu),
    favoriteGroups: hasFavoriteGroups
      ? parseZdEstimateFavoriteRefs(obj.favoriteGroups)
      : parseZdEstimateFavoriteRefs(undefined, ZD_ESTIMATE_FAVORITE_GROUPS_SEED),
    favoriteCechy: hasFavoriteCechy
      ? parseZdEstimateFavoriteRefs(obj.favoriteCechy)
      : [],
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
    // Legacy mirrors — stare klienty / skrypty
    showZkColumn: normalized.columns.zk,
    showStockDetail: normalized.columns.stock,
    columns: { ...normalized.columns },
    columnOrder: [...normalized.columnOrder],
    listFilter: normalized.listFilter,
    sortKey: normalized.sortKey,
    sortDir: normalized.sortDir,
    ...(normalized.dniZapasu != null
      ? { dniZapasu: normalized.dniZapasu }
      : {}),
    // Zawsze zapisuj klucze — `[]` ≠ brak klucza (seed).
    favoriteGroups: normalized.favoriteGroups.map((f) => ({
      id: f.id,
      label: f.label,
    })),
    favoriteCechy: normalized.favoriteCechy.map((f) => ({
      id: f.id,
      label: f.label,
    })),
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
  const nextColumns = patch.columns
    ? parseZdEstimateColumnVisibility(patch.columns)
    : { ...current.columns };
  if (patch.showZkColumn != null && patch.columns == null) {
    nextColumns.zk = patch.showZkColumn;
  }
  if (patch.showStockDetail != null && patch.columns == null) {
    nextColumns.stock = patch.showStockDetail;
  }
  // Kolejność: zawsze pełna permutacja (brakujące klucze dopinane na końcu).
  const nextOrder = parseZdEstimateColumnOrder(
    patch.columnOrder ?? current.columnOrder
  );
  const nextFavorites = {
    favoriteGroups:
      patch.favoriteGroups != null
        ? parseZdEstimateFavoriteRefs(patch.favoriteGroups)
        : current.favoriteGroups,
    favoriteCechy:
      patch.favoriteCechy != null
        ? parseZdEstimateFavoriteRefs(patch.favoriteCechy)
        : current.favoriteCechy,
  };
  const next = parseZdEstimateUiPrefs({
    ...current,
    ...patch,
    // Zawsze zapisuj komplet — widoczność i układ nie mogą wypaść z merge.
    columns: nextColumns,
    columnOrder: nextOrder,
    showZkColumn: nextColumns.zk,
    showStockDetail: nextColumns.stock,
    ...nextFavorites,
  });
  const serialized = serializeZdEstimateUiPrefs(next);
  return {
    ...root,
    [ZD_ESTIMATE_PREFS_KEY]: serialized,
  };
}

export function zdEstimateUiPrefsEqual(
  a: ZdEstimateUiPrefs,
  b: ZdEstimateUiPrefs
): boolean {
  return (
    a.zapasMin === b.zapasMin &&
    a.showAdvanced === b.showAdvanced &&
    zdEstimateColumnVisibilityEqual(a.columns, b.columns) &&
    zdEstimateColumnOrderEqual(a.columnOrder, b.columnOrder) &&
    a.listFilter === b.listFilter &&
    a.sortKey === b.sortKey &&
    a.sortDir === b.sortDir &&
    a.dniZapasu === b.dniZapasu &&
    zdEstimateFavoriteRefsEqual(a.favoriteGroups, b.favoriteGroups) &&
    zdEstimateFavoriteRefsEqual(a.favoriteCechy, b.favoriteCechy)
  );
}
