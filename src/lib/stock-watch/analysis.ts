/**
 * Braki i zamówienia — czysta logika sygnałów (bez I/O).
 *
 * Ilość „Do ZD” NIE jest tu liczona — przychodzi z silnika zamówień
 * (`runZdOrderEngine` + `buildZdOrderList`), tak jak w Kreatorze ZD.
 * Tu tylko: ile dni starczy stanu, status alertu, wartość rotacji.
 *
 * Jednostki: sztuki karty Subiekta.
 */

import { addDays } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import {
  isPackagingPackagesMode,
  normalizeUnitsPerPackage,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";

/**
 * Para paczka↔sztuka (Kreator „Pary”): sprzedaż i cel na linii paczki są już w sztukach
 * (`applyZdEstimatePairs`), więc stan też musi być w sztukach — sztuki + paczki × przelicznik,
 * a otwarte ZD to reszta pokrycia pary. Linia sztuk ma sprzedaż 0 → „bez sprzedaży”.
 * Bez pary / bez partnera → null (zwykłe liczenie).
 */
export function pairStockPieces(
  pair:
    | {
        role: "pack" | "piece";
        unitsPerPack: number;
        coverSzt: number;
        pieceDostepne: number;
        packDostepne: number;
        partnerMissing?: boolean;
      }
    | null
    | undefined
): { availableQty: number; openZdQty: number } | null {
  if (!pair || pair.role !== "pack" || pair.partnerMissing) return null;
  const availableQty = finite(pair.pieceDostepne) + finite(pair.packDostepne) * finite(pair.unitsPerPack);
  return { availableQty, openZdQty: Math.max(0, finite(pair.coverSzt) - availableQty) };
}

/** „Krytyczne” = stanu dostępnego starczy na ≤ 48 h. */
export const STOCK_WATCH_CRITICAL_DAYS = 2;

export type StockWatchRule = "standard" | "on_request" | "excluded";

export type StockWatchStatus =
  | "out_of_stock"
  | "critical"
  /** Własny stan się kończy, ale kompletacja w Subiekcie (złożenie / rozłożenie) go pokrywa. */
  | "to_assemble"
  | "warning"
  | "ok"
  | "no_sales";

export type StockWatchPackaging = {
  unitsPerPackage: number;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
};

export type StockWatchInput = {
  /** `dostepne` (stan − rezerwacje) — może być ujemne. */
  availableQty: number;
  /** Otwarte ZD w sztukach. */
  openZdQty: number;
  /** Rotacja z Kreatora: sprzedaż w oknie / dni okna. */
  velocityDaily: number;
  /** Cel zapasu z Kreatora (po boost/cięciach), w sztukach. */
  targetQty: number;
  minStockQty: number | null;
  /** Cena netto za sztukę (null = brak ceny z ZD). */
  unitPriceNet: number | null;
  /** Ostatni dzień uwzględnionej sprzedaży (YYYY-MM-DD) — od niego liczymy datę wyczerpania. */
  salesEndDate: string;
  /**
   * Sztuki do uzyskania kompletacją bez zakupu (zestaw z części / składnik z kompletu).
   * Liczą się do pokrycia; `assemblyActionable` = własny stan nie wystarcza → „Do kompletacji”.
   */
  assemblyQty?: number | null;
  assemblyActionable?: boolean;
};

export type StockWatchResult = {
  daysOfCover: number | null;
  runOutDate: string | null;
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
  const available = finite(input.availableQty);
  const assembly = Math.max(0, finite(input.assemblyQty));
  // Rezerwacje ponad stan zjadają też to, co da kompletacja.
  const effective = available + assembly;
  const velocityDaily = Math.max(0, finite(input.velocityDaily));
  const minStock =
    input.minStockQty != null && Number.isFinite(input.minStockQty)
      ? Math.max(0, input.minStockQty)
      : null;

  const daysOfCover =
    velocityDaily > 0 ? round(Math.max(0, effective) / velocityDaily, 1) : null;

  const end = parseDateOnly(input.salesEndDate);
  const runOutDate =
    daysOfCover != null && end
      ? formatDateString(addDays(end, Math.floor(daysOfCover)))
      : null;

  // Co będzie na stanie po dostawach z otwartych ZD (bez ZK — jak „Do ZD” w Kreatorze).
  const projected = effective + Math.max(0, finite(input.openZdQty));
  const target = Math.max(finite(input.targetQty), minStock ?? 0);

  let status: StockWatchStatus;
  const belowMin = minStock != null && minStock > 0 && effective < minStock;
  // Sam stan karty (bez kompletacji) — czy półka jest pusta / na wyczerpaniu.
  const ownShort =
    available <= 0 ||
    (velocityDaily > 0 && available / velocityDaily <= STOCK_WATCH_CRITICAL_DAYS) ||
    (minStock != null && minStock > 0 && available < minStock);
  if (velocityDaily <= 0 && !belowMin) {
    status = "no_sales";
  } else if (effective <= 0) {
    status = "out_of_stock";
  } else if (daysOfCover != null && daysOfCover <= STOCK_WATCH_CRITICAL_DAYS) {
    status = "critical";
  } else if (projected < target) {
    // Poniżej celu Kreator i tak zamawia — kompletacja tego nie zastępuje.
    status = "warning";
  } else if (assembly > 0 && input.assemblyActionable === true && ownShort) {
    status = "to_assemble";
  } else {
    status = "ok";
  }

  const dailyValue =
    input.unitPriceNet != null ? round(velocityDaily * input.unitPriceNet, 2) : null;

  return { daysOfCover, runOutDate, dailyValue, status };
}

/**
 * Brak na stanie i nic w otwartych ZD — „dziura” bez towaru w drodze.
 * status out_of_stock = dostępne ≤ 0; openZdQty = szt. na niezrealizowanych ZD.
 */
export function isStockWatchEmptyNoIncoming(item: {
  status: StockWatchStatus;
  openZdQty: number;
}): boolean {
  return item.status === "out_of_stock" && item.openZdQty <= 0;
}

/**
 * Starczy na ≤ 48 h i nic w otwartych ZD. Krytyczny towar, który już jedzie, nie jest
 * „do zamówienia dziś” — chyba że dostawa nie zdąży (deliveryRisk before_delivery).
 */
export function isStockWatchCriticalNoIncoming(item: {
  status: StockWatchStatus;
  openZdQty: number;
}): boolean {
  return item.status === "critical" && item.openZdQty <= 0;
}

/** Kolejność alertów: brak (najpierw bez dostawy), potem krytyczne; w grupie — wartość / rotacja. */
export function compareStockWatchAlerts(
  a: {
    status: StockWatchStatus;
    dailyValue: number | null;
    velocityDaily: number;
    daysOfCover: number | null;
    openZdQty?: number;
  },
  b: {
    status: StockWatchStatus;
    dailyValue: number | null;
    velocityDaily: number;
    daysOfCover: number | null;
    openZdQty?: number;
  }
): number {
  const rank: Record<StockWatchStatus, number> = {
    out_of_stock: 0,
    critical: 1,
    to_assemble: 2,
    warning: 3,
    ok: 4,
    no_sales: 5,
  };
  const byStatus = rank[a.status] - rank[b.status];
  if (byStatus !== 0) return byStatus;
  // Wśród braków: najpierw te bez niczego w drodze (najbardziej „gołe”).
  if (a.status === "out_of_stock" && b.status === "out_of_stock") {
    const aIn = (a.openZdQty ?? 0) > 0 ? 1 : 0;
    const bIn = (b.openZdQty ?? 0) > 0 ? 1 : 0;
    if (aIn !== bIn) return aIn - bIn;
  }
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
