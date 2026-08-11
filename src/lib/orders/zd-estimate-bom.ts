/**
 * Składy/promocje (BOM) w szacunku ZD.
 * Expand dokłada sprzedaż/cover parenta do komponentów w jednostkach karty.
 * Solo (poza parą) wymaga rematerializacji celu/track/doZd.
 */

import {
  computeManualOrderQty,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import { applyZdEstimateHistoryCuts } from "@/lib/orders/zd-estimate-history-track";
import {
  computeSalesTrackedCel,
  resolveSprzedazDziennie,
  type SalesTrackReason,
} from "@/lib/orders/zd-estimate-sales-track";
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
  label?: string;
  components: readonly ZdProductBomComponentRef[];
};

export type ZdEstimateBomMeta = {
  role: "parent" | "component";
  /** Parenty, z których doliczono wkład (na komponencie). */
  parentTwIds?: number[];
  contributionSales?: number;
  contributionCover?: number;
  /** Brak komponentu w wyniku — fail-loud. */
  componentMissing?: boolean;
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
 * Dokłada sprzedaż (zawsze) i cover (gdy stockAsCover) parenta do komponentów.
 * Parent: role=parent, doZamowieniaReczne=0.
 * Nie przelicza celu — to robi rematerialize / applyPairs.
 */
export function expandZdEstimateBoms(
  lines: ManualZdEstimateLine[],
  boms: readonly ZdProductBomRef[],
  options?: {
    missingComponentTwIds?: ReadonlySet<number> | null;
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
  const missingFlag = new Set<number>();
  const missingOpt = options?.missingComponentTwIds ?? null;

  for (const bom of boms) {
    const parentId = Math.trunc(Number(bom.parentTwId)) || 0;
    if (!(parentId > 0) || !bom.components?.length) continue;
    const parent = byTw.get(parentId);
    if (!parent) continue;

    const parentSales = Math.max(0, asNum(parent.sprzedazOkres));
    const parentDost = Math.max(0, asNum(parent.dostepne));
    const parentZd = Math.max(0, asNum(parent.otwarteZd));
    const coverBase = bom.stockAsCover !== false ? parentDost + parentZd : 0;

    byTw.set(parentId, {
      ...parent,
      doZamowieniaReczne: 0,
      bom: { role: "parent" },
    });

    for (const comp of bom.components) {
      const cid = Math.trunc(Number(comp.componentTwId)) || 0;
      const qty = Math.trunc(Number(comp.qtyPerParent)) || 0;
      if (!(cid > 0) || qty < 1) continue;

      const salesAdd = parentSales * qty;
      const coverAdd = coverBase * qty;
      contribSales.set(cid, (contribSales.get(cid) ?? 0) + salesAdd);
      contribCover.set(cid, (contribCover.get(cid) ?? 0) + coverAdd);
      const parents = parentIdsByComp.get(cid) ?? [];
      if (!parents.includes(parentId)) parents.push(parentId);
      parentIdsByComp.set(cid, parents);

      if (missingOpt?.has(cid) || !byTw.has(cid)) {
        missingFlag.add(cid);
        // Fail-loud na obecnych rodzeństwach tego samego BOM.
        for (const sibling of bom.components) {
          const sid = Math.trunc(Number(sibling.componentTwId)) || 0;
          if (sid > 0) missingFlag.add(sid);
        }
      }
    }
  }

  for (const [cid, salesAdd] of contribSales) {
    const existing = byTw.get(cid);
    if (!existing) continue;
    const coverAdd = contribCover.get(cid) ?? 0;
    const siblingMissing = missingFlag.has(cid);
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
      },
    });
  }

  // Zachowaj kolejność wejścia; parent/komponenty już w mapie.
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
 * Po expand: przelicza cel/track/doZd dla komponentów spoza pary (np. płyn).
 * Parent zostaje z doZd=0. Komponenty w parze — tylko pola sprzedaży/stanu.
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

  return lines.map((line) => {
    if (line.bom?.role === "parent") {
      return { ...line, doZamowieniaReczne: 0 };
    }

    // Tylko komponenty z wkładem BOM (poza parą) wymagają remat.
    if (line.bom?.role !== "component") {
      return line;
    }
    if (pairIndex.has(line.tw_Id)) {
      return line;
    }

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
    const salesTrackReasons: SalesTrackReason[] = [];

    const packUnits =
      options.packagingByTwId?.get(line.tw_Id)?.unitsPerPackage ?? null;
    const otwarteZdPieces = zdDocumentUnitsToPieces(
      Math.max(0, asNum(line.otwarteZd)),
      packUnits
    );

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
      salesTrackReasons.push(...track.reasons);

      const hist = options.historyByTwId?.get(line.tw_Id);
      if (hist && salesTrackCuts) {
        const histAdj = applyZdEstimateHistoryCuts({
          celTracked,
          celBase,
          sprzedazOkres,
          sprzedazDziennie: tempo,
          coverStock: dostepne + otwarteZdPieces,
          dniZapasu,
          dniOkresu,
          lastOrderedQty: hist.lastOrderedQty,
          linkedAt: hist.linkedAt,
        });
        if (histAdj.reasons.length > 0) {
          celTracked = histAdj.celTracked;
          salesTrackDelta = celTracked - celBase;
          salesTrackReasons.push(...histAdj.reasons);
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
      doZamowieniaReczne,
      wkladZk: Math.max(0, asNum(line.doZamowieniaApi) - doZamowieniaReczne),
    };
  });
}

/** Pełny krok BOM: expand → rematerialize solo. */
export function applyZdEstimateBoms(
  lines: ManualZdEstimateLine[],
  boms: readonly ZdProductBomRef[],
  options: RematerializeSoloAfterBomOptions & {
    missingComponentTwIds?: ReadonlySet<number> | null;
  }
): ManualZdEstimateLineWithBom[] {
  const expanded = expandZdEstimateBoms(lines, boms, {
    missingComponentTwIds: options.missingComponentTwIds,
  });
  return rematerializeSoloAfterBom(expanded, options);
}

export function bomRowsToRefs(
  rows: readonly {
    parentTwId: number;
    stockAsCover: boolean;
    label?: string;
    components: readonly { componentTwId: number; qtyPerParent: number }[];
  }[]
): ZdProductBomRef[] {
  return rows.map((r) => ({
    parentTwId: r.parentTwId,
    stockAsCover: r.stockAsCover !== false,
    label: r.label,
    components: r.components.map((c) => ({
      componentTwId: c.componentTwId,
      qtyPerParent: c.qtyPerParent,
    })),
  }));
}
