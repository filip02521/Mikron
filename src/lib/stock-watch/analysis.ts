/**
 * Braki i zamówienia — czysta logika analizy (bez I/O).
 *
 * Jednostki: sztuki karty Subiekta (jak `sprzedazOkres` / `tw_Stan` z /orders/zd/estimate).
 * Otwarte ZD przychodzą w jednostkach dokumentu — przeliczane na sztuki przez opakowanie.
 */

import { addDays } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import {
  isPackagingPackagesMode,
  normalizeUnitsPerPackage,
  zdDocumentUnitsToPieces,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";

/** Waga ostatnich 30 dni w rotacji (reszta = średnia z 60 dni). Szybciej łapie wzrost/spadek. */
export const STOCK_WATCH_VELOCITY_WEIGHT_30D = 0.7;

/** „Krytyczne” = stanu dostępnego starczy na ≤ 48 h. */
export const STOCK_WATCH_CRITICAL_DAYS = 2;

/** Dni zapasu, gdy dostawca nie ma ustawionego okresu („w razie potrzeby”). */
export const STOCK_WATCH_DEFAULT_BUFFER_DAYS = 30;

export type StockWatchRule = "standard" | "on_request" | "excluded";

export type StockWatchStatus =
  | "out_of_stock"
  | "critical"
  | "warning"
  | "ok"
  | "no_sales";

export type StockWatchPackaging = {
  unitsPerPackage: number;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
};

export type StockWatchInput = {
  stockQty: number;
  reservedQty: number;
  /** `dostepne` z API (stan − rezerwacje) — może być ujemne. */
  availableQty: number;
  /** Otwarte ZD w jednostkach dokumentu (przy opakowaniach: paczki). */
  openZdDocUnits: number;
  /**
   * Otwarte ZK bez rezerwacji — tylko informacyjnie. Jak w kreatorze ZD nie
   * wchodzi do propozycji: zalegające ZK (np. 144 szt na piec) zawyżały ilości.
   */
  openZkUnreservedQty: number;
  sales30d: number;
  sales60d: number;
  bufferDays: number;
  minStockQty: number | null;
  rule: StockWatchRule;
  packaging: StockWatchPackaging | null;
  /** Cena netto z ostatniej linii ZD — za jednostkę dokumentu. */
  lastZdPriceNet: number | null;
  /** Ostatni dzień uwzględnionej sprzedaży (YYYY-MM-DD) — od niego liczymy datę wyczerpania. */
  salesEndDate: string;
};

export type StockWatchResult = {
  openZdQty: number;
  velocityDaily: number;
  velocityTrend: number | null;
  daysOfCover: number | null;
  runOutDate: string | null;
  bufferDays: number;
  safetyStockQty: number;
  suggestedQty: number;
  unitPriceNet: number | null;
  dailyValue: number | null;
  status: StockWatchStatus;
};

function finite(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

/**
 * Średnia dzienna sprzedaż ważona: 70% ostatnie 30 dni + 30% ostatnie 60 dni.
 * Zwroty (ujemna sprzedaż) nie obniżają rotacji poniżej 0.
 */
export function computeSalesVelocity(sales30d: number, sales60d: number): {
  velocityDaily: number;
  trend: number | null;
} {
  const v30 = Math.max(0, finite(sales30d)) / 30;
  const v60 = Math.max(0, finite(sales60d)) / 60;
  const velocityDaily =
    STOCK_WATCH_VELOCITY_WEIGHT_30D * v30 +
    (1 - STOCK_WATCH_VELOCITY_WEIGHT_30D) * v60;
  return {
    velocityDaily: round(velocityDaily, 4),
    trend: v60 > 0 ? round(v30 / v60, 3) : null,
  };
}

/** Cena za sztukę z ceny ZD (przy opakowaniach ZD cena dotyczy paczki). */
export function unitPricePerPiece(
  priceNet: number | null | undefined,
  packaging: StockWatchPackaging | null
): number | null {
  const price = Number(priceNet);
  if (!Number.isFinite(price) || price <= 0) return null;
  const units = normalizeUnitsPerPackage(packaging?.unitsPerPackage);
  if (units > 1 && isPackagingPackagesMode(packaging?.documentUnitMode)) {
    return round(price / units, 4);
  }
  return round(price, 4);
}

export function analyzeStockWatchItem(input: StockWatchInput): StockWatchResult {
  const bufferDays =
    Number.isFinite(input.bufferDays) && input.bufferDays > 0
      ? Math.round(input.bufferDays)
      : STOCK_WATCH_DEFAULT_BUFFER_DAYS;
  const available = finite(input.availableQty);
  const openZdQty = zdDocumentUnitsToPieces(
    Math.max(0, finite(input.openZdDocUnits)),
    input.packaging?.unitsPerPackage,
    input.packaging?.documentUnitMode ?? "packages"
  );
  const minStock =
    input.minStockQty != null && Number.isFinite(input.minStockQty)
      ? Math.max(0, input.minStockQty)
      : null;

  const { velocityDaily, trend } = computeSalesVelocity(
    input.sales30d,
    input.sales60d
  );

  const daysOfCover =
    velocityDaily > 0 ? round(Math.max(0, available) / velocityDaily, 1) : null;

  const end = parseDateOnly(input.salesEndDate);
  const runOutDate =
    daysOfCover != null && end
      ? formatDateString(addDays(end, Math.floor(daysOfCover)))
      : null;

  const safetyStockQty = round(
    Math.max(velocityDaily * bufferDays, minStock ?? 0),
    2
  );
  // Co będzie na stanie po dostawach z otwartych ZD (bez ZK — jak „Do ZD” w kreatorze).
  const projected = available + openZdQty;
  const suggestedQty =
    input.rule === "standard"
      ? Math.max(0, Math.ceil(safetyStockQty - projected - 1e-9))
      : 0;

  let status: StockWatchStatus;
  const belowMin = minStock != null && minStock > 0 && available < minStock;
  if (velocityDaily <= 0 && !belowMin) {
    status = "no_sales";
  } else if (available <= 0) {
    status = "out_of_stock";
  } else if (daysOfCover != null && daysOfCover <= STOCK_WATCH_CRITICAL_DAYS) {
    status = "critical";
  } else if (projected < safetyStockQty) {
    status = "warning";
  } else {
    status = "ok";
  }

  const unitPriceNet = unitPricePerPiece(input.lastZdPriceNet, input.packaging);
  const dailyValue =
    unitPriceNet != null ? round(velocityDaily * unitPriceNet, 2) : null;

  return {
    openZdQty: round(openZdQty, 3),
    velocityDaily,
    velocityTrend: trend,
    daysOfCover,
    runOutDate,
    bufferDays,
    safetyStockQty,
    suggestedQty,
    unitPriceNet,
    dailyValue,
    status,
  };
}

/** Kolejność alertów: najpierw brak, potem krytyczne; w grupie — największa wartość / rotacja. */
export function compareStockWatchAlerts(
  a: Pick<StockWatchResult, "status" | "dailyValue" | "velocityDaily" | "daysOfCover">,
  b: Pick<StockWatchResult, "status" | "dailyValue" | "velocityDaily" | "daysOfCover">
): number {
  const rank: Record<StockWatchStatus, number> = {
    out_of_stock: 0,
    critical: 1,
    warning: 2,
    ok: 3,
    no_sales: 4,
  };
  const byStatus = rank[a.status] - rank[b.status];
  if (byStatus !== 0) return byStatus;
  const av = a.dailyValue ?? -1;
  const bv = b.dailyValue ?? -1;
  if (av !== bv) return bv - av;
  if (a.velocityDaily !== b.velocityDaily) return b.velocityDaily - a.velocityDaily;
  return (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity);
}

/**
 * Wskaźnik zdrowia magazynu (0–100): udział SKU w normie wśród aktywnych
 * (standard, z rotacją). Brak aktywnych = 100.
 */
export function computeStockHealthScore(
  items: ReadonlyArray<{ status: StockWatchStatus; rule: StockWatchRule }>
): { score: number; active: number; ok: number } {
  let active = 0;
  let ok = 0;
  for (const item of items) {
    if (item.rule !== "standard" || item.status === "no_sales") continue;
    active += 1;
    if (item.status === "ok") ok += 1;
  }
  return {
    score: active === 0 ? 100 : Math.round((ok / active) * 100),
    active,
    ok,
  };
}
