/**
 * Korekty celu z historii snapshotu ZD (sztuki).
 *
 * 1) sales_spike — okno FS ma sprzedaż znacznie powyżej oczekiwanej
 *    względem ostatniego zamówienia → ściągamy zawyżony cel.
 * 2) history_slow — od linku sprzedaje się wolno względem zamówienia
 *    → delikatnie obniżamy cel (istniejąca logika).
 *
 * Snapshot `qty` = sztuki (ob_Ilosc × opakowanie/para przy zapisie).
 */

import type { SalesTrackReason } from "@/lib/orders/zd-estimate-sales-track";

export const ZD_HISTORY_TRACK = {
  /** Min. qty ze snapshotu (sztuki), żeby brać pod uwagę. */
  minOrderedQty: 1,
  /** Min. dni od powiązania ZD (history_slow). */
  minDaysSinceLink: 7,
  /** soldSinceLink / ordered poniżej → cut. */
  slowRatioFloor: 0.4,
  /** Max −% celu z historii (slow). */
  maxCutRatio: 0.2,
  /** Nie tniemy slow, gdy cover jest cienki (brak towaru). */
  skipWhenCoverDaysBelow: true,
} as const;

/**
 * Skok sprzedaży względem ostatniego ZD.
 * Oczekiwana sprzedaż w oknie ≈ lastOrderedQty × (dniOkresu / dniZapasu).
 */
export const ZD_SALES_SPIKE_TRACK = {
  minOrderedQty: 1,
  /** sprzedazOkres / expectedWindowSales powyżej → spike. */
  spikeRatioFloor: 1.75,
  /**
   * Po wykryciu: normalizujemy sprzedaż do expected × softCap
   * i skalujemy cel proporcjonalnie (z limitem cięcia).
   */
  softCapRatio: 1.2,
  /** Max −% celBase przy skoku. */
  maxCutRatio: 0.45,
  /** Podłoga celTracked / celBase. */
  minCelRatio: 0.5,
  /** Min. dni okna sprzedaży do oceny skoku. */
  minWindowDays: 7,
} as const;

export type HistoryTrackInput = {
  celTracked: number;
  celBase: number;
  /** Sprzedaż w oknie estimate (sztuki). */
  sprzedazOkres: number;
  /** Tempo dzienne. */
  sprzedazDziennie: number;
  /** dostepne + otwarteZd w sztukach. */
  coverStock: number;
  dniZapasu: number;
  /** Długość okna FS — do skalowania oczekiwanej sprzedaży. */
  dniOkresu?: number | null;
  /** Zamówione sztuki z ostatniego snapshotu ZD. */
  lastOrderedQty: number;
  linkedAt: string;
  nowMs?: number;
};

export type HistoryTrackAdjustment = {
  celTracked: number;
  deltaPieces: number;
  reason: Extract<SalesTrackReason, "history_slow"> | null;
  daysSinceLink: number;
  sellVsOrdered: number | null;
  soldSinceLink: number;
};

export type SalesSpikeAdjustment = {
  celTracked: number;
  deltaPieces: number;
  reason: Extract<SalesTrackReason, "sales_spike"> | null;
  expectedWindowSales: number;
  spikeRatio: number | null;
};

function daysBetween(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / (24 * 60 * 60 * 1000));
}

function resolveWindowDays(input: {
  dniOkresu?: number | null;
  dniZapasu: number;
}): number {
  const fromOkresu = Number(input.dniOkresu);
  if (Number.isFinite(fromOkresu) && fromOkresu > 0) {
    return Math.max(1, Math.round(fromOkresu));
  }
  return Math.max(1, Math.round(input.dniZapasu));
}

/**
 * Szacunek sprzedaży od daty powiązania ZD (nie całe okno FS).
 * tempo × dni, ograniczone sprzedazOkres z bieżącego estimate.
 */
export function estimateSoldSinceLink(input: {
  sprzedazOkres: number;
  sprzedazDziennie: number;
  daysSinceLink: number;
}): number {
  const soldWindow = Math.max(0, input.sprzedazOkres);
  const days = Math.max(0, input.daysSinceLink);
  const tempo = Math.max(0, input.sprzedazDziennie);
  if (!(days > 0)) return 0;
  if (tempo > 1e-9) {
    return Math.min(soldWindow, tempo * days);
  }
  return soldWindow;
}

/**
 * Oczekiwana sprzedaż w oknie FS przy tempie „jak ostatnie ZD”.
 * lastOrderedQty ≈ pokrycie na dniZapasu → proporcja do długości okna.
 */
export function expectedSalesFromLastOrder(input: {
  lastOrderedQty: number;
  dniZapasu: number;
  dniOkresu?: number | null;
}): number {
  const ordered = Math.max(0, input.lastOrderedQty);
  const dniZapasu = Math.max(1, Math.round(input.dniZapasu));
  const windowDays = resolveWindowDays({
    dniOkresu: input.dniOkresu,
    dniZapasu,
  });
  return ordered * (windowDays / dniZapasu);
}

/**
 * Skok sprzedaży: okno FS >> oczekiwane względem ostatniego zamówienia.
 * Ściąga zawyżony cel (Subiekt + boost sell-through) w dół.
 */
export function applySalesSpikeCut(
  input: HistoryTrackInput,
  policy: Partial<typeof ZD_SALES_SPIKE_TRACK> = {}
): SalesSpikeAdjustment {
  const p = { ...ZD_SALES_SPIKE_TRACK, ...policy };
  const ordered = Math.max(0, input.lastOrderedQty);
  const sprzedazOkres = Math.max(0, input.sprzedazOkres);
  const celBase = Math.max(0, input.celBase);
  const celIn = Math.max(0, input.celTracked);
  const windowDays = resolveWindowDays({
    dniOkresu: input.dniOkresu,
    dniZapasu: input.dniZapasu,
  });
  const expectedWindowSales = expectedSalesFromLastOrder({
    lastOrderedQty: ordered,
    dniZapasu: input.dniZapasu,
    dniOkresu: input.dniOkresu,
  });

  const empty = (): SalesSpikeAdjustment => ({
    celTracked: celIn,
    deltaPieces: 0,
    reason: null,
    expectedWindowSales,
    spikeRatio:
      expectedWindowSales > 0 ? sprzedazOkres / expectedWindowSales : null,
  });

  if (ordered < p.minOrderedQty) return empty();
  if (windowDays < p.minWindowDays) return empty();
  if (!(celIn > 0) || !(celBase > 0)) return empty();
  if (!(expectedWindowSales > 0)) return empty();

  const spikeRatio = sprzedazOkres / expectedWindowSales;
  if (!(spikeRatio >= p.spikeRatioFloor)) return empty();

  // Normalizuj sprzedaż do „miękkiego sufitu” i przeskaluj cel.
  const cappedSales = expectedWindowSales * p.softCapRatio;
  if (!(cappedSales > 0) || !(sprzedazOkres > cappedSales)) return empty();

  const scale = cappedSales / sprzedazOkres;
  const targetFromScale = celIn * scale;
  const maxCut = celBase * p.maxCutRatio;
  const floor = celBase * p.minCelRatio;
  const celTracked = Math.max(
    floor,
    Math.max(celIn - maxCut, targetFromScale)
  );
  const deltaPieces = celTracked - celIn;
  if (!(deltaPieces < -1e-9)) return empty();

  return {
    celTracked,
    deltaPieces,
    reason: "sales_spike",
    expectedWindowSales,
    spikeRatio,
  };
}

/**
 * Dolna granica: nie schodzimy poniżej 50% celBase
 * (chyba że celTracked już był niższy).
 */
export function applyHistorySlowCut(
  input: HistoryTrackInput,
  policy: Partial<typeof ZD_HISTORY_TRACK> = {}
): HistoryTrackAdjustment {
  const p = { ...ZD_HISTORY_TRACK, ...policy };
  const nowMs = input.nowMs ?? Date.now();
  const daysSinceLink = daysBetween(input.linkedAt, nowMs);
  const ordered = Math.max(0, input.lastOrderedQty);
  const soldSinceLink = estimateSoldSinceLink({
    sprzedazOkres: input.sprzedazOkres,
    sprzedazDziennie: input.sprzedazDziennie,
    daysSinceLink,
  });
  const celBase = Math.max(0, input.celBase);
  const celIn = Math.max(0, input.celTracked);

  const empty = (): HistoryTrackAdjustment => ({
    celTracked: celIn,
    deltaPieces: 0,
    reason: null,
    daysSinceLink,
    sellVsOrdered: ordered > 0 ? soldSinceLink / ordered : null,
    soldSinceLink,
  });

  if (ordered < p.minOrderedQty) return empty();
  if (daysSinceLink < p.minDaysSinceLink) return empty();
  if (!(celIn > 0) || !(celBase > 0)) return empty();

  const sellVsOrdered = soldSinceLink / ordered;
  if (!(sellVsOrdered < p.slowRatioFloor)) return empty();

  if (p.skipWhenCoverDaysBelow && input.sprzedazDziennie > 1e-9) {
    const coverDays = input.coverStock / input.sprzedazDziennie;
    if (coverDays < input.dniZapasu * 0.92) return empty();
  }

  const span = Math.max(1e-9, p.slowRatioFloor);
  const t = Math.min(1, (p.slowRatioFloor - sellVsOrdered) / span);
  const cut = celBase * (t * p.maxCutRatio);
  if (!(cut > 0)) return empty();

  const floor = celBase * 0.5;
  const celTracked = Math.max(floor, celIn - cut);
  const deltaPieces = celTracked - celIn;
  if (!(deltaPieces < -1e-9)) return empty();

  return {
    celTracked,
    deltaPieces,
    reason: "history_slow",
    daysSinceLink,
    sellVsOrdered,
    soldSinceLink,
  };
}

/**
 * Kolejność: najpierw skok sprzedaży, potem wolne po ZD.
 */
export function applyZdEstimateHistoryCuts(input: HistoryTrackInput): {
  celTracked: number;
  reasons: Array<Extract<SalesTrackReason, "sales_spike" | "history_slow">>;
} {
  const reasons: Array<
    Extract<SalesTrackReason, "sales_spike" | "history_slow">
  > = [];
  let celTracked = input.celTracked;

  const spike = applySalesSpikeCut({ ...input, celTracked });
  if (spike.reason) {
    celTracked = spike.celTracked;
    reasons.push(spike.reason);
  }

  const slow = applyHistorySlowCut({ ...input, celTracked });
  if (slow.reason) {
    celTracked = slow.celTracked;
    reasons.push(slow.reason);
  }

  return { celTracked, reasons };
}
