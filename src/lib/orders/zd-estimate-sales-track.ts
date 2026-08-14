/**
 * Podążanie za sprzedażą w kreatorze ZD (dwukierunkowe).
 *
 * Cel z Subiekta (`celZapasu`) już ≈ tempo sprzedaży × dniZapasu.
 * Ta warstwa **koryguje cel**:
 * - w górę przy cienkim pokryciu / wysokim sell-through,
 * - w dół przy grubym pokryciu / niskim sell-through / martwym SKU z zapasem.
 *
 * Boost nie zwiększa ilości Do ZD przy niskiej pewności (vs Zapas);
 * przy wyższej — skalowany allow ∝ confidence. Cięcia nigdy nie są holdowane
 * (baseline = cel po cut, hold/scale tylko dokłada boost).
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
  maxTotalCutRatio: 0.3,
  /** Podłoga celTracked / celBase przy żywej sprzedaży. */
  minCelRatio: 0.5,
  /** Min. sprzedaż w oknie — poniżej: ścieżka martwego SKU. */
  minSprzedazOkres: 1,
  /** soldInZapas ≤ lo → demandStrength = 0. */
  confidenceDemandUnitLo: 1,
  /** soldInZapas ≥ hi → demandStrength = 1 (pełny allow qty). */
  confidenceDemandUnitHi: 6,
  confidenceDemandWeight: 0.65,
  confidenceSeverityWeight: 0.35,
  /** Poniżej — boost nie dokłada sztuk Do ZD. */
  boostQtyConfidenceMin: 0.5,
  /** Poniżej (przy allow) — flaga qtyReview. */
  boostQtyReviewConfidenceMax: 0.75,
} as const;

export type SalesTrackReason =
  | "thin_cover"
  | "sell_through"
  | "fat_cover"
  | "low_sell_through"
  | "dead_stock"
  | "history_slow"
  | "sales_spike"
  | "boost_held"
  | "boost_scaled";

export type SalesTrackAdjustment = {
  /** Czy wyszła niezerowa korekta celu. */
  applied: boolean;
  celBase: number;
  celTracked: number;
  /** Signed: +podbicie / −cięcie (po limitach / hold). */
  deltaPieces: number;
  /** Dni pokrycia = coverStock / tempo (null gdy brak tempa). */
  coverDays: number | null;
  /** sprzedaz / (sprzedaz + coverStock). */
  sellThrough: number | null;
  reasons: SalesTrackReason[];
  /** 0..1 — pewność dokupu sztuk z boostu względem Zapasu. */
  confidence: number;
  /** Wątpliwa ilość — do weryfikacji w UI. */
  qtyReview: boolean;
  /** Sztuki wstrzymane / niedopuszczone względem pełnego boostu. */
  heldExtraQty: number;
  /**
   * Sztuki Do ZD dozwolone z boostu ponad baseline po samym cut
   * (gdy brak cut — ponad qtyBase).
   */
  allowedExtraQty: number;
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

function clamp01(n: number): number {
  if (!(n > 0)) return 0;
  if (n >= 1) return 1;
  return n;
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

/** Długość okna FS: dniOkresu API, inaczej fallback (zwykle dniZapasu). */
export function resolveDniOkresuEffective(
  dniOkresu: number | null | undefined,
  fallbackDniZapasu: number
): number {
  const fromOkresu = asFinite(dniOkresu, NaN);
  if (Number.isFinite(fromOkresu) && fromOkresu > 0) {
    return Math.max(1, Math.round(fromOkresu));
  }
  const fromFallback = asFinite(fallbackDniZapasu, NaN);
  if (Number.isFinite(fromFallback) && fromFallback > 0) {
    return Math.max(1, Math.round(fromFallback));
  }
  return 30;
}

/** Sprzedaż przeskalowana do horyzontu Zapasu runu. */
export function soldNormalizedToZapas(input: {
  sprzedazOkres: number;
  dniOkresuEffective: number;
  dniZapasu: number;
}): number {
  const sold = Math.max(0, asFinite(input.sprzedazOkres));
  const okno = Math.max(1, asFinite(input.dniOkresuEffective, 1));
  const zapas = Math.max(1, asFinite(input.dniZapasu, 1));
  return sold * (zapas / okno);
}

/**
 * Ilość do zamówienia jak computeManualOrderQty
 * (ceil z Number.EPSILON).
 */
export function orderQtyFromCel(cel: number, coverStock: number): number {
  const raw = asFinite(cel) - Math.max(0, asFinite(coverStock));
  if (!(raw > 0)) return 0;
  return Math.ceil(raw - Number.EPSILON);
}

/**
 * Cel dający dokładnie `targetOrderQty` szt. Do ZD.
 * Preferuje `celBase + extra`, żeby delta UI = extra (bez szumu z cover).
 */
export function celForTargetOrderQty(input: {
  celBase: number;
  coverStock: number;
  targetOrderQty: number;
}): number {
  const cover = Math.max(0, asFinite(input.coverStock));
  const target = Math.max(0, Math.round(asFinite(input.targetOrderQty)));
  const celBase = Math.max(0, asFinite(input.celBase));
  if (target === 0) {
    // Stan pokrywa zapotrzebowanie — nie zawyżaj celu ponad bazę.
    return Math.min(celBase, cover);
  }
  const preferred = celBase + (target - orderQtyFromCel(celBase, cover));
  if (orderQtyFromCel(preferred, cover) === target) {
    return Math.max(0, preferred);
  }
  return cover + target;
}

/**
 * Pewność dokupu sztuk z boostu (0..1).
 * Demand i pilność wyłącznie z soldInZapas / Zapasu / cover — bez sprzedazDziennie API.
 */
export function computeBoostConfidence(input: {
  sprzedazOkres: number;
  dniOkresuEffective: number;
  dniZapasu: number;
  /** Cover w sztukach (dostepne + otwarteZd). */
  coverStock: number;
  policy?: Partial<typeof ZD_SALES_TRACK>;
}): number {
  const policy = { ...ZD_SALES_TRACK, ...input.policy };
  const soldInZapas = soldNormalizedToZapas({
    sprzedazOkres: input.sprzedazOkres,
    dniOkresuEffective: input.dniOkresuEffective,
    dniZapasu: input.dniZapasu,
  });
  const lo = policy.confidenceDemandUnitLo;
  const hi = policy.confidenceDemandUnitHi;
  const span = Math.max(1e-9, hi - lo);
  const demandStrength = clamp01((soldInZapas - lo) / span);

  // Tempo z normalizowanej sprzedaży — nie z API sprzedazDziennie.
  const tempoFromSold = soldInZapas / Math.max(1, input.dniZapasu);
  const coverStock = Math.max(0, asFinite(input.coverStock));
  const coverDays =
    tempoFromSold > 1e-9 ? coverStock / tempoFromSold : null;
  const shortfallRatio =
    coverDays == null
      ? 0
      : clamp01((input.dniZapasu - coverDays) / input.dniZapasu);
  const severity = shortfallRatio * demandStrength;

  return clamp01(
    policy.confidenceDemandWeight * demandStrength +
      policy.confidenceSeverityWeight * severity
  );
}

/**
 * Po history cut: zsynchronizuj meta qty z faktycznym celem
 * (held/allowed nie mogą opisywać już nieaktualnego boostu).
 */
export function reconcileSalesTrackQtyMetaAfterHistory(input: {
  celBase: number;
  celTracked: number;
  coverStock: number;
  confidence: number;
  reasons: SalesTrackReason[];
  policy?: Partial<typeof ZD_SALES_TRACK>;
}): {
  salesTrackQtyReview: boolean;
  salesTrackHeldExtraQty: number;
  salesTrackAllowedExtraQty: number;
  salesTrackReasons: SalesTrackReason[];
} {
  const policy = { ...ZD_SALES_TRACK, ...input.policy };
  const qtyBase = orderQtyFromCel(input.celBase, input.coverStock);
  const qtyNow = orderQtyFromCel(input.celTracked, input.coverStock);
  const allowed = Math.max(0, qtyNow - qtyBase);
  const reasons = input.reasons.filter(
    (r) => r !== "boost_held" && r !== "boost_scaled"
  );
  if (allowed > 0) {
    const review =
      input.confidence < policy.boostQtyReviewConfidenceMax;
    return {
      salesTrackQtyReview: review,
      salesTrackHeldExtraQty: 0,
      salesTrackAllowedExtraQty: allowed,
      salesTrackReasons: reasons,
    };
  }
  return {
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    salesTrackReasons: reasons,
  };
}

function roundHintQty(n: number): number {
  const abs = Math.abs(n);
  if (abs >= 10) return Math.round(n);
  return Math.round(n * 10) / 10;
}

function roundHintPct(confidence: number): number {
  return Math.round(clamp01(confidence) * 100);
}

const TRACK_DEFAULTS = {
  confidence: 0,
  qtyReview: false,
  heldExtraQty: 0,
  allowedExtraQty: 0,
} as const;

/**
 * Liczy cel zapasu po korekcie za sprzedażą (boost i/lub cut)
 * oraz ceil-hold / skalowaniu sztuk Do ZD wg confidence.
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
  const dniOkresuEffective = resolveDniOkresuEffective(
    input.dniOkresu,
    dniZapasu
  );
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
    sellThrough: number | null = null,
    confidence = 0
  ): SalesTrackAdjustment => ({
    applied: false,
    celBase,
    celTracked: celBase,
    deltaPieces: 0,
    coverDays,
    sellThrough,
    reasons: [],
    confidence,
    qtyReview: false,
    heldExtraQty: 0,
    allowedExtraQty: 0,
  });

  if (!enabled) {
    return empty();
  }

  const coverDays =
    sprzedazDziennie > 1e-9 ? coverStock / sprzedazDziennie : null;
  const pool = sprzedazOkres + coverStock;
  const sellThrough = pool > 0 ? sprzedazOkres / pool : null;

  const confidence =
    sprzedazOkres >= policy.minSprzedazOkres
      ? computeBoostConfidence({
          sprzedazOkres,
          dniOkresuEffective,
          dniZapasu,
          coverStock,
          policy,
        })
      : 0;

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
        ...TRACK_DEFAULTS,
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
    return empty(coverDays, sellThrough, confidence);
  }

  let celRaw = celBase + deltaRaw;
  if (deltaRaw < 0) {
    const floor = celBase * policy.minCelRatio;
    celRaw = Math.max(floor, celRaw);
  } else {
    celRaw = Math.min(celBase + celBase * policy.maxTotalBoostRatio, celRaw);
  }
  celRaw = Math.max(0, celRaw);

  // Cut zawsze wchodzi w baseline; hold/scale dotyczy wyłącznie boostu.
  const celAfterCut =
    cut > DELTA_EPS
      ? Math.max(celBase * policy.minCelRatio, Math.max(0, celBase - cut))
      : celBase;
  const qtyAfterCut = orderQtyFromCel(celAfterCut, coverStock);
  const qtyRaw = orderQtyFromCel(celRaw, coverStock);
  const extraWanted = Math.max(0, qtyRaw - qtyAfterCut);

  const reasons: SalesTrackReason[] = [...boostReasons, ...cutReasons];
  let celTracked = celRaw;
  let qtyReview = false;
  let heldExtraQty = 0;
  let allowedExtraQty = 0;

  if (extraWanted > 0) {
    if (confidence < policy.boostQtyConfidenceMin) {
      // Hold boostu: zostaw pełny cut, bez dokupu sztuk z boostu.
      allowedExtraQty = 0;
      celTracked = celAfterCut;
      heldExtraQty = extraWanted;
      qtyReview = true;
      reasons.push("boost_held");
    } else {
      allowedExtraQty = Math.min(
        extraWanted,
        Math.max(1, Math.round(extraWanted * confidence))
      );
      const targetQty = qtyAfterCut + allowedExtraQty;
      celTracked = celForTargetOrderQty({
        celBase: celAfterCut,
        coverStock,
        targetOrderQty: targetQty,
      });
      heldExtraQty = extraWanted - allowedExtraQty;
      if (allowedExtraQty < extraWanted) {
        reasons.push("boost_scaled");
      }
      qtyReview =
        confidence < policy.boostQtyReviewConfidenceMax ||
        allowedExtraQty < extraWanted;
    }
  } else if (celRaw > celAfterCut + DELTA_EPS) {
    // Boost ułamkowy bez wzrostu Do ZD — nie zawyżaj celTracked w UI.
    celTracked = celAfterCut;
  }
  // else: cut / passthrough — celTracked = celRaw

  // Niezmiennik: Do ZD = qtyAfterCut + allowedExtra (gdy był boost qty).
  const qtyFinal = orderQtyFromCel(celTracked, coverStock);
  if (extraWanted > 0) {
    const expected = qtyAfterCut + allowedExtraQty;
    if (qtyFinal !== expected) {
      celTracked = celForTargetOrderQty({
        celBase: celAfterCut,
        coverStock,
        targetOrderQty: expected,
      });
    }
  }

  const deltaPieces = celTracked - celBase;
  const hasHoldOrScale =
    reasons.includes("boost_held") || reasons.includes("boost_scaled");
  if (Math.abs(deltaPieces) <= DELTA_EPS && !hasHoldOrScale) {
    return empty(coverDays, sellThrough, confidence);
  }

  return {
    applied: Math.abs(deltaPieces) > DELTA_EPS,
    celBase,
    celTracked,
    deltaPieces,
    coverDays,
    sellThrough,
    reasons,
    confidence,
    qtyReview,
    heldExtraQty,
    allowedExtraQty,
  };
}

/** Krótki opis korekty do UI / title. */
export function formatSalesTrackHint(
  adj: Pick<SalesTrackAdjustment, "applied" | "deltaPieces" | "reasons"> &
    Partial<
      Pick<
        SalesTrackAdjustment,
        "confidence" | "qtyReview" | "heldExtraQty" | "allowedExtraQty"
      >
    >
): string | null {
  const confPct = roundHintPct(adj.confidence ?? 0);
  const held = Math.max(0, Math.round(asFinite(adj.heldExtraQty)));
  const allowed = Math.max(0, Math.round(asFinite(adj.allowedExtraQty)));

  // Czysty hold (bez zmiany celu / cutu) — krótki komunikat.
  if (
    adj.reasons.includes("boost_held") &&
    held > 0 &&
    !(Math.abs(adj.deltaPieces) > DELTA_EPS)
  ) {
    return `bez +${held} szt (pewność ${confPct}% — sprawdź)`;
  }
  if (
    adj.reasons.includes("boost_scaled") &&
    allowed > 0 &&
    adj.deltaPieces > DELTA_EPS
  ) {
    const wanted = allowed + held;
    return `+${allowed} szt z +${wanted} (pewność ${confPct}% — sprawdź)`;
  }

  if (!(Math.abs(adj.deltaPieces) > DELTA_EPS)) {
    if (adj.qtyReview) {
      return `pewność ${confPct}% — sprawdź`;
    }
    return null;
  }

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
  const review =
    adj.qtyReview && confPct < 100 ? ` · pewność ${confPct}%` : "";
  const holdNote =
    adj.reasons.includes("boost_held") && held > 0
      ? ` · bez +${held} boost`
      : "";
  return `${sign}${q} szt (śledzenie: ${why}${review}${holdNote})`;
}
