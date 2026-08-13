/**
 * Agregacja pary pack↔piece w kreatorze ZD.
 * Popyt/cover w sztukach; zamówienie tylko na pack (piecesNeeded → packaging/ratio).
 */

import {
  computeManualOrderQty,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import {
  applyZdEstimateHistoryCuts,
} from "@/lib/orders/zd-estimate-history-track";
import {
  computeSalesTrackedCel,
  reconcileSalesTrackQtyMetaAfterHistory,
  resolveSprzedazDziennie,
  type SalesTrackReason,
} from "@/lib/orders/zd-estimate-sales-track";
import {
  indexZdProductPairs,
  pairCoverPieces,
  pairSalesPieces,
  type ZdProductPairRef,
  type ZdProductPairRole,
} from "@/lib/orders/zd-product-pair-units";

export type ZdEstimatePairMeta = {
  role: ZdProductPairRole;
  twinTwId: number;
  unitsPerPack: number;
  sprzedazSzt: number;
  coverSzt: number;
  pieceSprzedaz: number;
  packSprzedaz: number;
  pieceDostepne: number;
  packDostepne: number;
  /** Brak partnera w wyniku estimate — nie cichy half-merge. */
  partnerMissing?: boolean;
};

export type ManualZdEstimateLineWithPair = ManualZdEstimateLine & {
  pair?: ZdEstimatePairMeta | null;
};

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export type ZdEstimateHistoryQtyEntry = {
  lastOrderedQty: number;
  linkedAt: string;
};

/**
 * Historia pary do cut: suma sztuk pack+piece (bez × ratio).
 * linkedAt = nowszy spośród wpisów z qty > 0.
 */
export function mergePairHistoryForCut(
  histPack?: ZdEstimateHistoryQtyEntry | null,
  histPiece?: ZdEstimateHistoryQtyEntry | null
): ZdEstimateHistoryQtyEntry | null {
  const packQty = Math.max(0, asNum(histPack?.lastOrderedQty));
  const pieceQty = Math.max(0, asNum(histPiece?.lastOrderedQty));
  const lastOrderedQty = packQty + pieceQty;
  if (!(lastOrderedQty > 0)) return null;

  const dates: string[] = [];
  if (packQty > 0 && histPack?.linkedAt) dates.push(histPack.linkedAt);
  if (pieceQty > 0 && histPiece?.linkedAt) dates.push(histPiece.linkedAt);
  if (dates.length === 0) {
    if (histPack?.linkedAt) dates.push(histPack.linkedAt);
    if (histPiece?.linkedAt) dates.push(histPiece.linkedAt);
  }
  if (dates.length === 0) return null;

  let linkedAt = dates[0]!;
  for (const d of dates.slice(1)) {
    if (Date.parse(d) > Date.parse(linkedAt)) linkedAt = d;
  }
  return { lastOrderedQty, linkedAt };
}

export type ApplyZdEstimatePairsOptions = {
  dniZapasu: number;
  dniOkresu?: number | null;
  zapasMin?: number;
  salesTrack?: boolean;
  salesTrackCuts?: boolean;
  /** tw_Id wykluczone z zamówienia (pack wykluczony → qty 0). */
  excludedTwIds?: ReadonlySet<number> | null;
  historyByTwId?: ReadonlyMap<number, ZdEstimateHistoryQtyEntry> | null;
  /**
   * tw_Id partnerów których nie było w lines — fail-loud na pack.
   * Puste = wszyscy partnerzy obecni.
   */
  missingPartnerTwIds?: ReadonlySet<number> | null;
};

/**
 * Po zmapowaniu linii 1:1 — scala pary i ustawia qty.
 * Piece: doZamowieniaReczne = 0.
 * Pack: piecesNeeded ze złączonego celu/cover (w sztukach).
 */
export function applyZdEstimatePairs(
  lines: ManualZdEstimateLine[],
  pairs: readonly ZdProductPairRef[],
  options: ApplyZdEstimatePairsOptions
): ManualZdEstimateLineWithPair[] {
  const index = indexZdProductPairs(pairs);
  if (index.size === 0) {
    return lines.map((l) => ({ ...l, pair: null }));
  }

  const byTw = new Map(lines.map((l) => [l.tw_Id, l]));
  const processed = new Set<number>();
  const out: ManualZdEstimateLineWithPair[] = [];
  const excluded = options.excludedTwIds ?? null;
  const missing = options.missingPartnerTwIds ?? null;
  const dniZapasu = Math.max(1, Math.round(options.dniZapasu));
  const zapasMin = Math.max(0, asNum(options.zapasMin));
  const salesTrack = options.salesTrack !== false;
  const salesTrackCuts = options.salesTrackCuts !== false;

  for (const line of lines) {
    if (processed.has(line.tw_Id)) continue;
    const hit = index.get(line.tw_Id);
    if (!hit) {
      out.push({ ...line, pair: null });
      processed.add(line.tw_Id);
      continue;
    }

    const { pair } = hit;
    const packLine = byTw.get(pair.packTwId) ?? null;
    const pieceLine = byTw.get(pair.pieceTwId) ?? null;
    const partnerMissing =
      (missing?.has(pair.packTwId) ?? false) ||
      (missing?.has(pair.pieceTwId) ?? false) ||
      !packLine ||
      !pieceLine;

    // Oznacz obie strony gdy są w lines
    if (packLine) processed.add(packLine.tw_Id);
    if (pieceLine) processed.add(pieceLine.tw_Id);

    const ratio = pair.unitsPerPack;
    const pieceSprzedaz = pieceLine ? asNum(pieceLine.sprzedazOkres) : 0;
    const packSprzedaz = packLine ? asNum(packLine.sprzedazOkres) : 0;
    const pieceDost = pieceLine ? Math.max(0, asNum(pieceLine.dostepne)) : 0;
    const packDost = packLine ? Math.max(0, asNum(packLine.dostepne)) : 0;
    const packZd = packLine ? Math.max(0, asNum(packLine.otwarteZd)) : 0;
    const pieceZd = pieceLine ? Math.max(0, asNum(pieceLine.otwarteZd)) : 0;

    const sprzedazSzt = partnerMissing
      ? 0
      : pairSalesPieces({
          pieceSprzedazOkres: pieceSprzedaz,
          packSprzedazOkres: packSprzedaz,
          unitsPerPack: ratio,
        });
    const coverSzt = partnerMissing
      ? 0
      : pairCoverPieces({
          pieceDostepne: pieceDost,
          packDostepne: packDost,
          unitsPerPack: ratio,
          packOtwarteZd: packZd,
          pieceOtwarteZd: pieceZd,
        });

    const tempo = resolveSprzedazDziennie({
      sprzedazOkres: sprzedazSzt,
      sprzedazDziennie: 0,
      dniOkresu: options.dniOkresu,
      fallbackDniOkresu: dniZapasu,
    });
    const celBase = partnerMissing
      ? 0
      : tempo * dniZapasu + zapasMin;

    let celTracked = celBase;
    let salesTrackDelta = 0;
    let salesTrackReasons: SalesTrackReason[] = [];
    let salesTrackConfidence = 0;
    let salesTrackQtyReview = false;
    let salesTrackHeldExtraQty = 0;
    let salesTrackAllowedExtraQty = 0;

    if (!partnerMissing && salesTrack && celBase > 0) {
      const track = computeSalesTrackedCel({
        celZapasu: celBase,
        sprzedazOkres: sprzedazSzt,
        sprzedazDziennie: tempo,
        dostepne: coverSzt, // cover już z ZD — otwarteZd=0 w track
        otwarteZd: 0,
        dniZapasu,
        dniOkresu: options.dniOkresu,
        enabled: true,
        cutsEnabled: salesTrackCuts,
      });
      celTracked = track.celTracked;
      salesTrackDelta = track.deltaPieces;
      salesTrackReasons = [...track.reasons];
      salesTrackConfidence = track.confidence;
      salesTrackQtyReview = track.qtyReview;
      salesTrackHeldExtraQty = track.heldExtraQty;
      salesTrackAllowedExtraQty = track.allowedExtraQty;

      const hist = mergePairHistoryForCut(
        options.historyByTwId?.get(pair.packTwId),
        options.historyByTwId?.get(pair.pieceTwId)
      );
      if (hist && salesTrackCuts) {
        const histAdj = applyZdEstimateHistoryCuts({
          celTracked,
          celBase,
          sprzedazOkres: sprzedazSzt,
          sprzedazDziennie: tempo,
          coverStock: coverSzt,
          dniZapasu,
          dniOkresu: options.dniOkresu,
          lastOrderedQty: hist.lastOrderedQty,
          linkedAt: hist.linkedAt,
        });
        if (histAdj.reasons.length > 0) {
          celTracked = histAdj.celTracked;
          salesTrackDelta = celTracked - celBase;
          salesTrackReasons.push(...histAdj.reasons);
          const reconciled = reconcileSalesTrackQtyMetaAfterHistory({
            celBase,
            celTracked,
            coverStock: coverSzt,
            confidence: salesTrackConfidence,
            reasons: salesTrackReasons,
          });
          salesTrackReasons = reconciled.salesTrackReasons;
          salesTrackQtyReview = reconciled.salesTrackQtyReview;
          salesTrackHeldExtraQty = reconciled.salesTrackHeldExtraQty;
          salesTrackAllowedExtraQty = reconciled.salesTrackAllowedExtraQty;
        }
      }
    }

    const packExcluded = excluded?.has(pair.packTwId) === true;
    let piecesNeeded = 0;
    if (!partnerMissing && !packExcluded) {
      piecesNeeded = computeManualOrderQty({
        celZapasu: celTracked,
        dostepne: coverSzt,
        otwarteZd: 0, // już w coverSzt
      });
    }

    const baseMeta = (
      r: ZdProductPairRole,
      twin: number
    ): ZdEstimatePairMeta => ({
      role: r,
      twinTwId: twin,
      unitsPerPack: ratio,
      sprzedazSzt,
      coverSzt,
      pieceSprzedaz,
      packSprzedaz,
      pieceDostepne: pieceDost,
      packDostepne: packDost,
      partnerMissing: partnerMissing || undefined,
    });

    if (packLine) {
      out.push({
        ...packLine,
        celZapasu: celBase,
        celZapasuTracked: celTracked,
        salesTrackDelta,
        salesTrackReasons,
        salesTrackConfidence,
        salesTrackQtyReview,
        salesTrackHeldExtraQty,
        salesTrackAllowedExtraQty,
        sprzedazOkres: sprzedazSzt,
        sprzedazDziennie: tempo,
        doZamowieniaReczne: piecesNeeded,
        wkladZk: Math.max(0, packLine.doZamowieniaApi - piecesNeeded),
        pair: baseMeta("pack", pair.pieceTwId),
      });
    }

    if (pieceLine) {
      out.push({
        ...pieceLine,
        celZapasu: celBase,
        celZapasuTracked: celTracked,
        salesTrackDelta: 0,
        salesTrackReasons: [],
        salesTrackConfidence: 0,
        salesTrackQtyReview: false,
        salesTrackHeldExtraQty: 0,
        salesTrackAllowedExtraQty: 0,
        doZamowieniaReczne: 0,
        wkladZk: 0,
        pair: baseMeta("piece", pair.packTwId),
      });
    }

    // Gdy w lines była tylko jedna strona — już obsłużone; druga dociągnięta wcześniej do byTw
  }

  return out;
}

/** Effective units_per_package: para pack wygrywa z packaging DB. */
export function effectiveUnitsPerPackageForTwId(
  twId: number,
  pairIndex: ReadonlyMap<
    number,
    { pair: ZdProductPairRef; role: ZdProductPairRole }
  >,
  packagingUnits: number | null | undefined
): number | null {
  const hit = pairIndex.get(twId);
  if (hit?.role === "pack") return hit.pair.unitsPerPack;
  if (hit?.role === "piece") return null; // nie zamawiaj / nie mnoż piece
  const n = Math.trunc(Number(packagingUnits));
  return Number.isFinite(n) && n > 1 ? n : null;
}
