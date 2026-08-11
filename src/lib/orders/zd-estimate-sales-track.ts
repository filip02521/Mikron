/**
 * Podążanie za sprzedażą w szacunku ZD (dwukierunkowe).
 *
 * Cel z Subiekta (`celZapasu`) już ≈ tempo sprzedaży × dniZapasu.
 * Ta warstwa **koryguje cel**:
 * - w górę przy cienkim pokryciu / wysokim sell-through,
 * - w dół przy grubym pokryciu / niskim sell-through / martwym SKU z zapasem.
 *
 * Cover liczy `dostepne + otwarteZd` w **sztukach**
 * (otwarte ZD z API przeliczone × opakowanie przed wywołaniem).
 * Deadband wokół dniZapasu ogranicza oscylację boost/cut.
 *
 * Bez historii między uruchomieniami: każdy run jest snapshotem FS + stanu.
 */

export const ZD_SALES_TRACK = {
  /** Ułamek brakującego pokrycia dokładany do celu (stopniowość). */
  coverRamp: 0.4,
  /** Max dodatkowych dni pokrycia z cienkiego stanu. */
  maxCoverExtraDays: 10,
  /** Sell-through powyżej tego → zaczynamy % boost. */
  sellThroughFloor: 0.45,
  /** Max +% do celu z sell-through (przy wyprzedaniu ~100%). */
  sellThroughMaxBoost: 0.15,
  /** Max łączne podbicie względem bazowego celu. */
  maxTotalBoostRatio: 0.35,
  /** ± ułamek dniZapasu bez sygnału thin/fat cover. */
  coverDeadbandRatio: 0.08,
  /** Ułamek nadmiaru dni odejmowany od celu (fat cover). */
  coverCutRamp: 0.35,
  /** Max dni uciętych z fat cover. */
  maxCoverCutDays: 8,
  /** Sell-through poniżej tego → % cut. */
  sellThroughLowFloor: 0.25,
  /** Max −% do celu z niskiego sell-through. */
  sellThroughMaxCut: 0.12,
  /** Max łączne cięcie względem bazowego celu. */
  maxTotalCutRatio: 0.30,
  /** Podłoga celTracked / celBase przy żywej sprzedaży. */
  minCelRatio: 0.5,
  /** Min. sprzedaż w oknie — poniżej: ścieżka martwego SKU. */
  minSprzedazOkres: 1,
} as const;

export type SalesTrackReason =
  | "thin_cover"
  | "sell_through"
  | "fat_cover"
  | "low_sell_through"
  | "dead_stock"
  | "history_slow"
  | "sales_spike";

export type SalesTrackAdjustment = {
  /** Czy wyszła niezerowa korekta celu. */
  applied: boolean;
  celBase: number;
  celTracked: number;
  /** Signed: +podbicie / −cięcie (po limitach). */
  deltaPieces: number;
  /** Dni pokrycia = coverStock / tempo (null gdy brak tempa). */
  coverDays: number | null;
  /** sprzedaz / (sprzedaz + coverStock). */
  sellThrough: number | null;
  reasons: SalesTrackReason[];
};

const DELTA_EPS = 1e-9;

function asFinite(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Tempo dzienne: pole API, albo fallback sprzedazOkres / dniOkresu
 * (gdy Subiekt nie podał sprzedazDziennie).
 */
export function resolveSprzedazDziennie(input: {
  sprzedazOkres: number;
  sprzedazDziennie: number;
  dniOkresu?: number | null;
  /** Fallback dni okna, gdy brak dniOkresu — zwykle dniZapasu runu. */
  fallbackDniOkresu?: number | null;
}): number {
  const direct = Math.max(0, asFinite(input.sprzedazDziennie));
  if (direct > 1e-9) return direct;

  const okres = Math.max(0, asFinite(input.sprzedazOkres));
  if (!(okres > 0)) return 0;

  const fromOkresu = asFinite(input.dniOkresu, NaN);
  const fromFallback = asFinite(input.fallbackDniOkresu, NaN);
  const days = Math.max(
    1,
    Math.round(
      Number.isFinite(fromOkresu) && fromOkresu > 0
        ? fromOkresu
        : Number.isFinite(fromFallback) && fromFallback > 0
          ? fromFallback
          : 30
    )
  );
  return okres / days;
}

function roundHintQty(n: number): number {
  const abs = Math.abs(n);
  if (abs >= 10) return Math.round(n);
  return Math.round(n * 10) / 10;
}

/**
 * Liczy cel zapasu po korekcie za sprzedażą (boost i/lub cut).
 */
export function computeSalesTrackedCel(input: {
  celZapasu: number;
  sprzedazOkres: number;
  sprzedazDziennie: number;
  dostepne: number;
  /** Otwarte ZD w sztukach (cover = dostepne + otwarteZd). */
  otwarteZd?: number;
  dniZapasu: number;
  /** Długość okna FS z API — do fallbacku tempa dziennego. */
  dniOkresu?: number | null;
  enabled?: boolean;
  /** Domyślnie true — sygnały cięcia. */
  cutsEnabled?: boolean;
  policy?: Partial<typeof ZD_SALES_TRACK>;
}): SalesTrackAdjustment {
  const policy = { ...ZD_SALES_TRACK, ...input.policy };
  const celBase = Math.max(0, asFinite(input.celZapasu));
  const sprzedazOkres = Math.max(0, asFinite(input.sprzedazOkres));
  const dniZapasu = Math.max(1, Math.round(asFinite(input.dniZapasu, 30)));
  const sprzedazDziennie = resolveSprzedazDziennie({
    sprzedazOkres,
    sprzedazDziennie: input.sprzedazDziennie,
    dniOkresu: input.dniOkresu,
    fallbackDniOkresu: dniZapasu,
  });
  const dostepne = Math.max(0, asFinite(input.dostepne));
  const otwarteZd = Math.max(0, asFinite(input.otwarteZd));
  const coverStock = dostepne + otwarteZd;
  const enabled = input.enabled !== false;
  const cutsEnabled = input.cutsEnabled !== false;

  const empty = (
    coverDays: number | null = null,
    sellThrough: number | null = null
  ): SalesTrackAdjustment => ({
    applied: false,
    celBase,
    celTracked: celBase,
    deltaPieces: 0,
    coverDays,
    sellThrough,
    reasons: [],
  });

  if (!enabled) {
    return empty();
  }

  const coverDays =
    sprzedazDziennie > 1e-9 ? coverStock / sprzedazDziennie : null;
  const pool = sprzedazOkres + coverStock;
  const sellThrough = pool > 0 ? sprzedazOkres / pool : null;

  // Martwy / szum — osobna ścieżka (ew. zerowanie przy zapasie ≥ celu).
  if (sprzedazOkres < policy.minSprzedazOkres) {
    if (!cutsEnabled) return empty(coverDays, sellThrough);
    if (celBase <= 0 || coverStock >= celBase - DELTA_EPS) {
      return {
        applied: celBase > DELTA_EPS,
        celBase,
        celTracked: 0,
        deltaPieces: celBase > DELTA_EPS ? -celBase : 0,
        coverDays,
        sellThrough,
        reasons: celBase > DELTA_EPS ? ["dead_stock"] : [],
      };
    }
    return empty(coverDays, sellThrough);
  }

  const lo = dniZapasu * (1 - policy.coverDeadbandRatio);
  const hi = dniZapasu * (1 + policy.coverDeadbandRatio);

  const boostReasons: SalesTrackReason[] = [];
  let boost = 0;

  if (coverDays != null && coverDays < lo) {
    const shortfallDays = dniZapasu - coverDays;
    const extraDays = Math.min(
      policy.maxCoverExtraDays,
      shortfallDays * policy.coverRamp
    );
    if (extraDays > 0) {
      boost += sprzedazDziennie * extraDays;
      boostReasons.push("thin_cover");
    }
  }

  if (
    sellThrough != null &&
    sellThrough > policy.sellThroughFloor &&
    celBase > 0
  ) {
    const span = Math.max(1e-9, 1 - policy.sellThroughFloor);
    const t = Math.min(1, (sellThrough - policy.sellThroughFloor) / span);
    const fromSt = celBase * (t * policy.sellThroughMaxBoost);
    if (fromSt > 0) {
      boost += fromSt;
      boostReasons.push("sell_through");
    }
  }

  boost = Math.min(boost, celBase * policy.maxTotalBoostRatio);

  const cutReasons: SalesTrackReason[] = [];
  let cut = 0;

  if (cutsEnabled && celBase > 0) {
    if (coverDays != null && coverDays > hi) {
      const surplusDays = coverDays - dniZapasu;
      const cutDays = Math.min(
        policy.maxCoverCutDays,
        surplusDays * policy.coverCutRamp
      );
      if (cutDays > 0) {
        cut += sprzedazDziennie * cutDays;
        cutReasons.push("fat_cover");
      }
    }

    if (
      sellThrough != null &&
      sellThrough < policy.sellThroughLowFloor &&
      coverStock > 0
    ) {
      const span = Math.max(1e-9, policy.sellThroughLowFloor);
      const t = Math.min(1, (policy.sellThroughLowFloor - sellThrough) / span);
      const fromSt = celBase * (t * policy.sellThroughMaxCut);
      if (fromSt > 0) {
        cut += fromSt;
        cutReasons.push("low_sell_through");
      }
    }

    cut = Math.min(cut, celBase * policy.maxTotalCutRatio);
  }

  const deltaRaw = boost - cut;
  if (Math.abs(deltaRaw) <= DELTA_EPS) {
    return empty(coverDays, sellThrough);
  }

  let celTracked = celBase + deltaRaw;
  if (deltaRaw < 0) {
    const floor = celBase * policy.minCelRatio;
    celTracked = Math.max(floor, celTracked);
  } else {
    celTracked = Math.min(celBase + celBase * policy.maxTotalBoostRatio, celTracked);
  }
  celTracked = Math.max(0, celTracked);

  const deltaPieces = celTracked - celBase;
  if (Math.abs(deltaPieces) <= DELTA_EPS) {
    return empty(coverDays, sellThrough);
  }

  const reasons = [...boostReasons, ...cutReasons];

  return {
    applied: true,
    celBase,
    celTracked,
    deltaPieces,
    coverDays,
    sellThrough,
    reasons,
  };
}

/** Krótki opis korekty do UI / title. */
export function formatSalesTrackHint(
  adj: Pick<SalesTrackAdjustment, "applied" | "deltaPieces" | "reasons">
): string | null {
  if (!adj.applied || !(Math.abs(adj.deltaPieces) > DELTA_EPS)) return null;
  const bits: string[] = [];
  if (adj.reasons.includes("thin_cover")) bits.push("cienkie pokrycie");
  if (adj.reasons.includes("sell_through")) bits.push("wysoka sprzedaż");
  if (adj.reasons.includes("fat_cover")) bits.push("grube pokrycie");
  if (adj.reasons.includes("low_sell_through")) bits.push("niska sprzedaż");
  if (adj.reasons.includes("dead_stock")) bits.push("brak sprzedaży");
  if (adj.reasons.includes("history_slow")) bits.push("wolne po ZD");
  if (adj.reasons.includes("sales_spike")) bits.push("skok sprzedaży");
  const why = bits.length ? bits.join(" · ") : "sprzedaż";
  const q = roundHintQty(adj.deltaPieces);
  const sign = q > 0 ? "+" : "";
  return `${sign}${q} szt (śledzenie: ${why})`;
}
