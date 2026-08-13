/**
 * Składy/komplety (BOM) w kreatorze ZD.
 * Presety: assemble (explode+components), buy_separate, kit_only.
 * Expand → rematerialize; finalize purchase gates po pairs (osobna funkcja).
 */

import {
  computeManualOrderQty,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import { applyZdEstimateHistoryCuts } from "@/lib/orders/zd-estimate-history-track";
import {
  isValidBomPolicyPair,
  normalizeDemandAllocation,
  normalizePurchaseTarget,
  resolveBomStockAsCover,
  type BomDemandAllocation,
  type BomPurchaseTarget,
} from "@/lib/orders/zd-estimate-bom-policy";
import {
  computeSalesTrackedCel,
  reconcileSalesTrackQtyMetaAfterHistory,
  resolveSprzedazDziennie,
  type SalesTrackReason,
} from "@/lib/orders/zd-estimate-sales-track";
import { clearSalesTrackQtyReviewMeta } from "@/lib/orders/zd-estimate-post-create";
import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
import {
  indexZdProductPairs,
  type ZdProductPairRef,
} from "@/lib/orders/zd-product-pair-units";

export type ZdProductBomComponentRef = {
  componentTwId: number;
  qtyPerParent: number;
};

export type ZdProductBomRef = {
  parentTwId: number;
  stockAsCover: boolean;
  demandAllocation?: BomDemandAllocation;
  purchaseTarget?: BomPurchaseTarget;
  label?: string;
  components: readonly ZdProductBomComponentRef[];
};

export type ZdEstimateBomRole =
  | "assembled_parent"
  | "purchased_kit"
  | "component";

export type ZdEstimateBomMeta = {
  role: ZdEstimateBomRole;
  /** Parenty, z których doliczono wkład (na komponencie). */
  parentTwIds?: number[];
  contributionSales?: number;
  contributionCover?: number;
  /** Brak komponentu w wyniku — fail-loud (explode). */
  componentMissing?: boolean;
  /** kit_only: składnik poza ZD. */
  purchaseBlocked?: boolean;
  /** Dla purchased_kit — rozróżnienie badge as_sold vs kit_only. */
  purchaseTarget?: BomPurchaseTarget;
};

export type ManualZdEstimateLineWithBom = ManualZdEstimateLine & {
  bom?: ZdEstimateBomMeta | null;
};

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function isAssembledBomParent(
  line: Pick<ManualZdEstimateLineWithBom, "bom"> | { bom?: ZdEstimateBomMeta | null }
): boolean {
  return line.bom?.role === "assembled_parent";
}

export function isPurchasedBomKit(
  line: Pick<ManualZdEstimateLineWithBom, "bom"> | { bom?: ZdEstimateBomMeta | null }
): boolean {
  return line.bom?.role === "purchased_kit";
}

/** purchaseBlocked bez wkładu explode — poza ścieżką zakupu (kit_only). */
export function isBomPurchaseBlockedWithoutExplode(
  line: Pick<ManualZdEstimateLineWithBom, "bom"> | { bom?: ZdEstimateBomMeta | null }
): boolean {
  return (
    line.bom?.purchaseBlocked === true &&
    !(asNum(line.bom.contributionSales) > 0)
  );
}

export function bomBlocksZdOrder(
  line: Pick<ManualZdEstimateLineWithBom, "bom"> | { bom?: ZdEstimateBomMeta | null }
): boolean {
  return isAssembledBomParent(line) || isBomPurchaseBlockedWithoutExplode(line);
}

/** UI: ukryj Wyklucz / Na prośbę (piece pary + assembled). */
export function bomRowHidesHardExclude(line: {
  pair?: { role?: string } | null;
  bom?: ZdEstimateBomMeta | null;
}): boolean {
  return line.pair?.role === "piece" || isAssembledBomParent(line);
}

/** UI: ukryj „Na prośbę” (hard + purchaseBlocked). Clear legacy nadal OK. */
export function bomRowHidesOnRequest(line: {
  pair?: { role?: string } | null;
  bom?: ZdEstimateBomMeta | null;
}): boolean {
  return bomRowHidesHardExclude(line) || isBomPurchaseBlockedWithoutExplode(line);
}

function bomAllocation(bom: ZdProductBomRef): BomDemandAllocation {
  return normalizeDemandAllocation(bom.demandAllocation);
}

function bomTarget(bom: ZdProductBomRef): BomPurchaseTarget {
  return normalizePurchaseTarget(bom.purchaseTarget);
}

/** Tw_Id parentów i komponentów BOM, gdy choć jeden węzeł jest na liście. */
export function collectMissingZdBomTwIds(
  lines: readonly { tw_Id: number }[],
  boms: readonly ZdProductBomRef[]
): number[] {
  const present = new Set(
    lines.map((l) => Math.trunc(Number(l.tw_Id)) || 0).filter((id) => id > 0)
  );
  const missing: number[] = [];
  const seen = new Set<number>();

  for (const bom of boms) {
    const parent = Math.trunc(Number(bom.parentTwId)) || 0;
    if (!(parent > 0) || !bom.components?.length) continue;
    const nodes = [
      parent,
      ...bom.components.map((c) => Math.trunc(Number(c.componentTwId)) || 0),
    ].filter((id) => id > 0);
    const anyPresent = nodes.some((id) => present.has(id));
    if (!anyPresent) continue;
    for (const id of nodes) {
      if (present.has(id) || seen.has(id)) continue;
      seen.add(id);
      missing.push(id);
    }
  }
  return missing;
}

/**
 * Dokłada sprzedaż/cover przy explode; taguje role; przy separate zachowuje doZd K.
 * Wspólny składnik w wielu BOM: wkłady SUMUJĄ się (sprzedaż×qty, cover×qty).
 * Nested (zestaw jako składnik innego zestawu): wkład schodzi rekurencyjnie na liście.
 * Nie przelicza celu — to robi rematerialize / applyPairs / finalize.
 */
export function expandZdEstimateBoms(
  lines: ManualZdEstimateLine[],
  boms: readonly ZdProductBomRef[],
  options?: {
    missingComponentTwIds?: ReadonlySet<number> | null;
    packagingByTwId?: ReadonlyMap<number, { unitsPerPackage: number }> | null;
  }
): ManualZdEstimateLineWithBom[] {
  if (!boms.length) {
    return lines.map((l) => ({ ...l, bom: l.bom ?? null }));
  }

  const byTw = new Map<number, ManualZdEstimateLineWithBom>();
  for (const line of lines) {
    byTw.set(line.tw_Id, { ...line, bom: null });
  }

  const contribSales = new Map<number, number>();
  const contribCover = new Map<number, number>();
  const parentIdsByComp = new Map<number, number[]>();
  const purchaseBlockedComps = new Set<number>();
  const missingFlag = new Set<number>();
  const missingOpt = options?.missingComponentTwIds ?? null;
  const packagingByTwId = options?.packagingByTwId ?? null;
  const explodeBomByParent = new Map<number, ZdProductBomRef>();

  for (const bom of boms) {
    const parentId = Math.trunc(Number(bom.parentTwId)) || 0;
    if (!(parentId > 0) || !bom.components?.length) continue;
    const parent = byTw.get(parentId);
    if (!parent) continue;

    const allocation = bomAllocation(bom);
    const target = bomTarget(bom);
    // Nielegalna para (np. refs poza upsert/DB) — pomiń BOM.
    if (!isValidBomPolicyPair(allocation, target)) continue;
    const explode = allocation === "explode";
    const kitOnly = target === "kit_only";

    const parentSales = Math.max(0, asNum(parent.sprzedazOkres));
    const parentDost = Math.max(0, asNum(parent.dostepne));
    const parentZdRaw = Math.max(0, asNum(parent.otwarteZd));
    const parentPack =
      packagingByTwId?.get(parentId)?.unitsPerPackage ?? null;
    const parentZdPieces = zdDocumentUnitsToPieces(parentZdRaw, parentPack);
    const useCover =
      explode && bom.stockAsCover !== false && allocation === "explode";
    const coverBase = useCover ? parentDost + parentZdPieces : 0;

    if (explode) {
      explodeBomByParent.set(parentId, bom);
      byTw.set(parentId, {
        ...parent,
        doZamowieniaReczne: 0,
        bom: { role: "assembled_parent" },
      });
    } else {
      byTw.set(parentId, {
        ...parent,
        bom: {
          role: "purchased_kit",
          purchaseTarget: target,
        },
      });
    }

    for (const comp of bom.components) {
      const cid = Math.trunc(Number(comp.componentTwId)) || 0;
      const qty = Math.trunc(Number(comp.qtyPerParent)) || 0;
      if (!(cid > 0) || qty < 1) continue;

      const parents = parentIdsByComp.get(cid) ?? [];
      if (!parents.includes(parentId)) parents.push(parentId);
      parentIdsByComp.set(cid, parents);

      if (kitOnly) {
        purchaseBlockedComps.add(cid);
      }

      if (explode) {
        // Wspólny składnik w wielu BOM: wkład się SUMUJE (sprzedaż×qty, cover×qty).
        const salesAdd = parentSales * qty;
        const coverAdd = coverBase * qty;
        contribSales.set(cid, (contribSales.get(cid) ?? 0) + salesAdd);
        contribCover.set(cid, (contribCover.get(cid) ?? 0) + coverAdd);

        if (missingOpt?.has(cid) || !byTw.has(cid)) {
          missingFlag.add(cid);
          for (const sibling of bom.components) {
            const sid = Math.trunc(Number(sibling.componentTwId)) || 0;
            if (sid > 0) missingFlag.add(sid);
          }
        }
      } else if (missingOpt?.has(cid) || !byTw.has(cid)) {
        // Soft: oznacz tylko brakujący węzeł, bez fail-loud sibling.
        missingFlag.add(cid);
      }
    }
  }

  // Nested: wkład wylądował na assembled_parent → zepchnij na jego składniki (×qty).
  for (let guard = 0; guard < 32; guard++) {
    let moved = false;
    for (const cid of [...contribSales.keys()]) {
      const host = byTw.get(cid);
      if (host?.bom?.role !== "assembled_parent") continue;
      const nested = explodeBomByParent.get(cid);
      const salesAdd = contribSales.get(cid) ?? 0;
      const coverAdd = contribCover.get(cid) ?? 0;
      const outerParents = parentIdsByComp.get(cid) ?? [];
      contribSales.delete(cid);
      contribCover.delete(cid);
      parentIdsByComp.delete(cid);
      purchaseBlockedComps.delete(cid);
      moved = true;
      if (!nested?.components?.length) continue;

      for (const comp of nested.components) {
        const nid = Math.trunc(Number(comp.componentTwId)) || 0;
        const qty = Math.trunc(Number(comp.qtyPerParent)) || 0;
        if (!(nid > 0) || qty < 1) continue;
        contribSales.set(nid, (contribSales.get(nid) ?? 0) + salesAdd * qty);
        contribCover.set(nid, (contribCover.get(nid) ?? 0) + coverAdd * qty);
        const parents = parentIdsByComp.get(nid) ?? [];
        if (!parents.includes(cid)) parents.push(cid);
        for (const op of outerParents) {
          if (!parents.includes(op)) parents.push(op);
        }
        parentIdsByComp.set(nid, parents);
        if (missingOpt?.has(nid) || !byTw.has(nid)) {
          missingFlag.add(nid);
          for (const sibling of nested.components) {
            const sid = Math.trunc(Number(sibling.componentTwId)) || 0;
            if (sid > 0) missingFlag.add(sid);
          }
        }
      }
    }
    if (!moved) break;
  }

  // Komponenty z wkładem explode.
  for (const [cid, salesAdd] of contribSales) {
    const existing = byTw.get(cid);
    if (!existing) continue;
    // Nie degraduj zestawu „Składamy” do roli składnika (nested powinien już zepchnąć wkład).
    if (existing.bom?.role === "assembled_parent") continue;
    const coverAdd = contribCover.get(cid) ?? 0;
    const siblingMissing = missingFlag.has(cid);
    const blocked =
      purchaseBlockedComps.has(cid) && !(salesAdd > 0);
    byTw.set(cid, {
      ...existing,
      sprzedazOkres: Math.max(0, asNum(existing.sprzedazOkres)) + salesAdd,
      dostepne: Math.max(0, asNum(existing.dostepne)) + coverAdd,
      bom: {
        role: "component",
        parentTwIds: parentIdsByComp.get(cid) ?? [],
        contributionSales: salesAdd,
        contributionCover: coverAdd,
        componentMissing: siblingMissing || undefined,
        purchaseBlocked: blocked || undefined,
      },
    });
  }

  // Komponenty tylko z kit_only / separate (bez wkładu sales).
  for (const cid of parentIdsByComp.keys()) {
    if (contribSales.has(cid)) continue;
    const existing = byTw.get(cid);
    if (!existing) continue;
    if (existing.bom?.role === "assembled_parent") continue;
    if (existing.bom?.role === "purchased_kit") continue;
    const softMissing = missingFlag.has(cid);
    const blocked = purchaseBlockedComps.has(cid);
    byTw.set(cid, {
      ...existing,
      bom: {
        role: "component",
        parentTwIds: parentIdsByComp.get(cid) ?? [],
        contributionSales: 0,
        contributionCover: 0,
        componentMissing: softMissing || undefined,
        purchaseBlocked: blocked || undefined,
      },
      ...(blocked ? { doZamowieniaReczne: 0 } : {}),
    });
  }

  const out: ManualZdEstimateLineWithBom[] = [];
  const seen = new Set<number>();
  for (const line of lines) {
    const next = byTw.get(line.tw_Id);
    if (next) {
      out.push(next);
      seen.add(line.tw_Id);
    }
  }
  for (const [id, row] of byTw) {
    if (!seen.has(id)) out.push(row);
  }
  return out;
}

export type RematerializeSoloAfterBomOptions = {
  dniZapasu: number;
  dniOkresu?: number | null;
  zapasMin?: number;
  salesTrack?: boolean;
  salesTrackCuts?: boolean;
  historyByTwId?: ReadonlyMap<
    number,
    { lastOrderedQty: number; linkedAt: string }
  > | null;
  packagingByTwId?: ReadonlyMap<number, { unitsPerPackage: number }> | null;
  /** SKU w parze — skip rematerialize (applyPairs nadpisze). */
  productPairs?: readonly ZdProductPairRef[] | null;
};

/**
 * Po expand: przelicza cel/track/doZd dla składników i purchased_kit (P2/P3).
 * assembled_parent → doZd=0; purchaseBlocked bez wkładu explode → doZd=0.
 * purchased_kit rematerializuje jak zwykły SKU (live dniZapasu / track).
 */
export function rematerializeSoloAfterBom(
  lines: ManualZdEstimateLineWithBom[],
  options: RematerializeSoloAfterBomOptions
): ManualZdEstimateLineWithBom[] {
  const dniZapasu = Math.max(1, Math.round(options.dniZapasu));
  const zapasMin = Math.max(0, asNum(options.zapasMin));
  const dniOkresu =
    options.dniOkresu != null && Number.isFinite(options.dniOkresu)
      ? Number(options.dniOkresu)
      : null;
  const salesTrack = options.salesTrack !== false;
  const salesTrackCuts = options.salesTrackCuts !== false;
  const pairIndex = indexZdProductPairs(options.productPairs ?? []);

  function rematerializeNeed(
    line: ManualZdEstimateLineWithBom
  ): ManualZdEstimateLineWithBom {
    const sprzedazOkres = Math.max(0, asNum(line.sprzedazOkres));
    const dostepne = Math.max(0, asNum(line.dostepne));
    const tempo = resolveSprzedazDziennie({
      sprzedazOkres,
      sprzedazDziennie: 0,
      dniOkresu,
      fallbackDniOkresu: dniZapasu,
    });
    const celBase = tempo * dniZapasu + zapasMin;

    let celTracked = celBase;
    let salesTrackDelta = 0;
    let salesTrackReasons: SalesTrackReason[] = [];
    let salesTrackConfidence = 0;
    let salesTrackQtyReview = false;
    let salesTrackHeldExtraQty = 0;
    let salesTrackAllowedExtraQty = 0;

    const packUnits =
      options.packagingByTwId?.get(line.tw_Id)?.unitsPerPackage ?? null;
    const otwarteZdPieces = zdDocumentUnitsToPieces(
      Math.max(0, asNum(line.otwarteZd)),
      packUnits
    );
    const coverForQty = dostepne + otwarteZdPieces;

    if (salesTrack && celBase > 0) {
      const track = computeSalesTrackedCel({
        celZapasu: celBase,
        sprzedazOkres,
        sprzedazDziennie: tempo,
        dostepne,
        otwarteZd: otwarteZdPieces,
        dniZapasu,
        dniOkresu,
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

      const hist = options.historyByTwId?.get(line.tw_Id);
      if (hist && salesTrackCuts) {
        const histAdj = applyZdEstimateHistoryCuts({
          celTracked,
          celBase,
          sprzedazOkres,
          sprzedazDziennie: tempo,
          coverStock: coverForQty,
          dniZapasu,
          dniOkresu,
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
            coverStock: coverForQty,
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

    const doZamowieniaReczne = computeManualOrderQty({
      celZapasu: celTracked,
      dostepne,
      otwarteZd: otwarteZdPieces,
    });

    return {
      ...line,
      sprzedazDziennie: tempo,
      celZapasu: celBase,
      celZapasuTracked: celTracked,
      salesTrackDelta,
      salesTrackReasons,
      salesTrackConfidence,
      salesTrackQtyReview,
      salesTrackHeldExtraQty,
      salesTrackAllowedExtraQty,
      doZamowieniaReczne,
      wkladZk: Math.max(0, asNum(line.doZamowieniaApi) - doZamowieniaReczne),
    };
  }

  return lines.map((line) => {
    if (isAssembledBomParent(line)) {
      return clearSalesTrackQtyReviewMeta({ ...line, doZamowieniaReczne: 0 });
    }

    // purchased_kit: jak zwykły SKU (nie zero z roli).
    if (isPurchasedBomKit(line)) {
      if (pairIndex.has(line.tw_Id)) return line;
      return rematerializeNeed(line);
    }

    if (line.bom?.role !== "component") {
      return line;
    }
    if (pairIndex.has(line.tw_Id)) {
      if (isBomPurchaseBlockedWithoutExplode(line)) {
        return clearSalesTrackQtyReviewMeta({ ...line, doZamowieniaReczne: 0 });
      }
      return line;
    }

    // purchaseBlocked bez wkładu explode — zero bez remat.
    if (isBomPurchaseBlockedWithoutExplode(line)) {
      return clearSalesTrackQtyReviewMeta({ ...line, doZamowieniaReczne: 0 });
    }

    let next = rematerializeNeed(line);

    // Explode wygrywa nad kit_only — zostaw need gdy jest contributionSales.
    if (isBomPurchaseBlockedWithoutExplode(next)) {
      next = clearSalesTrackQtyReviewMeta({ ...next, doZamowieniaReczne: 0 });
    }

    return next;
  });
}

/**
 * Po pairs: wymuś doZd=0 dla assembled_parent i purchaseBlocked
 * (pairs może przywrócić qty na packu).
 */
export function applyBomPurchaseTargetFinalize(
  lines: ManualZdEstimateLineWithBom[]
): ManualZdEstimateLineWithBom[] {
  return lines.map((line) => {
    if (isAssembledBomParent(line)) {
      if (line.doZamowieniaReczne === 0 && !line.salesTrackQtyReview) {
        return line;
      }
      return clearSalesTrackQtyReviewMeta({ ...line, doZamowieniaReczne: 0 });
    }
    if (
      line.bom?.purchaseBlocked &&
      isBomPurchaseBlockedWithoutExplode(line)
    ) {
      if (line.doZamowieniaReczne === 0 && !line.salesTrackQtyReview) {
        return line;
      }
      return clearSalesTrackQtyReviewMeta({ ...line, doZamowieniaReczne: 0 });
    }
    return line;
  });
}

/** Pełny krok BOM: expand → rematerialize solo (finalize wołaj po pairs). */
export function applyZdEstimateBoms(
  lines: ManualZdEstimateLine[],
  boms: readonly ZdProductBomRef[],
  options: RematerializeSoloAfterBomOptions & {
    missingComponentTwIds?: ReadonlySet<number> | null;
  }
): ManualZdEstimateLineWithBom[] {
  const expanded = expandZdEstimateBoms(lines, boms, {
    missingComponentTwIds: options.missingComponentTwIds,
    packagingByTwId: options.packagingByTwId,
  });
  return rematerializeSoloAfterBom(expanded, options);
}

export function bomRowsToRefs(
  rows: readonly {
    parentTwId: number;
    stockAsCover: boolean;
    demandAllocation?: BomDemandAllocation | string | null;
    purchaseTarget?: BomPurchaseTarget | string | null;
    label?: string;
    components: readonly { componentTwId: number; qtyPerParent: number }[];
  }[]
): ZdProductBomRef[] {
  return rows.map((r) => {
    let demandAllocation = normalizeDemandAllocation(r.demandAllocation);
    let purchaseTarget = normalizePurchaseTarget(r.purchaseTarget);
    if (!isValidBomPolicyPair(demandAllocation, purchaseTarget)) {
      // Fail-safe: nielegalna para → Składamy (default Castorit).
      demandAllocation = "explode";
      purchaseTarget = "components";
    }
    const stockAsCover = resolveBomStockAsCover({
      demandAllocation,
      stockAsCover: r.stockAsCover,
    });
    return {
      parentTwId: r.parentTwId,
      stockAsCover,
      demandAllocation,
      purchaseTarget,
      label: r.label,
      components: r.components.map((c) => ({
        componentTwId: c.componentTwId,
        qtyPerParent: c.qtyPerParent,
      })),
    };
  });
}

/** Czy brakujące węzły dotyczą BOM explode (twardy gate Create/TSV). */
export function hasUnresolvedExplodeBomNodes(
  boms: readonly ZdProductBomRef[],
  missingBomTwIds: readonly number[] | ReadonlySet<number> | null | undefined
): boolean {
  const missing =
    missingBomTwIds instanceof Set
      ? missingBomTwIds
      : new Set(
          [...(missingBomTwIds ?? [])]
            .map((id) => Math.trunc(Number(id)) || 0)
            .filter((id) => id > 0)
        );
  if (!missing.size || !boms.length) return false;
  for (const bom of boms) {
    if (normalizeDemandAllocation(bom.demandAllocation) !== "explode") continue;
    const parent = Math.trunc(Number(bom.parentTwId)) || 0;
    if (parent > 0 && missing.has(parent)) return true;
    for (const c of bom.components ?? []) {
      const cid = Math.trunc(Number(c.componentTwId)) || 0;
      if (cid > 0 && missing.has(cid)) return true;
    }
  }
  return false;
}
