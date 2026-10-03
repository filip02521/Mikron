/**
 * Lista „Do ZD” po Policz — czysta funkcja, ta sama ścieżka co tabela Kreatora
 * (ZdEstimateWorkbench: catalogExtrasBundle → extraOnly → orderExcluded →
 * reclassify → dedupe próśb ↔ rez. ZK → filterOrderableLinesWithPackaging).
 *
 * Używa jej nocny przebieg (panel Braki), żeby liczba w panelu = „Do ZD” w Kreatorze.
 * Zmiana tu wymaga tej samej zmiany w Workbench (i odwrotnie).
 */

import type { ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import { hasUnresolvedExplodeBomNodes } from "@/lib/orders/zd-estimate-bom";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import {
  buildIndividualEstimateExtras,
  buildMikranByTwFromEstimateLines,
  expandPresentTwIdsWithPairPartners,
  individualExtraPiecesMap,
  reclassifyExcludedTwExtrasToServices,
  reclassifyMissingTwExtrasToServices,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  buildExtraOnlyTwIds,
  buildOrderExcludedTwIds,
} from "@/lib/orders/zd-estimate-on-request";
import {
  filterOrderableLinesWithPackaging,
  individualExtraPiecesForTw,
  piecesArrivingForZdUnitsFromQty,
  resolveOrderQtyForLine,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";
import {
  resolveProsbaReservationDedupeMaps,
  type ZdEstimateReservedOverlapSlice,
} from "@/lib/orders/zd-estimate-prosba-reservation-overlap";

export type ZdOrderListLine = {
  line: ManualZdEstimateLine;
  /** Ilość na dokumencie ZD (paczki albo sztuki — wg `documentUnitMode`). */
  zdUnits: number;
  /** Sztuki, które przyjadą po dostawie `zdUnits`. */
  piecesArriving: number;
  /** Sztuki potrzebne (przed zaokrągleniem do opakowań). */
  piecesNeeded: number;
  /** Z tego: sztuki z próśb handlowców. */
  individualExtraPieces: number;
  unitsPerPackage: number | null;
  packageLabel: string | null;
  /** true = ZD liczone w opakowaniach (cena ZD też za opakowanie). */
  packagesMode: boolean;
};

export type ZdOrderList = {
  lines: ZdOrderListLine[];
  /** Explode BOM bez kompletu danych — Kreator pokazuje pustą listę. */
  explodeBomIncomplete: boolean;
  orderExcludedTwIds: Set<number>;
  extraOnlyTwIds: Set<number>;
};

export function buildZdOrderList(input: {
  lines: readonly ManualZdEstimateLine[];
  packagingLookup: ReadonlyMap<number, PackagingLookup>;
  /** Wykluczenia twarde: DB ∪ auto z nazwy ∪ zęby. */
  hardExcludedTwIds: ReadonlySet<number>;
  onRequestTwIds: ReadonlySet<number>;
  productPairs: readonly { packTwId: number; pieceTwId: number; unitsPerPack: number }[];
  bomRefs: readonly ZdProductBomRef[];
  missingBomTwIds: ReadonlySet<number> | readonly number[];
  teethTwIds: readonly number[];
  /** null = fetch próśb nieudany (jak `pendingIndividualsError` w Kreatorze). */
  pendingIndividuals: readonly ZdEstimatePendingIndividualOrder[] | null;
  prosbaReservedByTwId: ReadonlyMap<number, readonly ZdEstimateReservedOverlapSlice[]> | null;
  extrasPolicy: ZdEstimateExtrasPolicy;
  minStockByTwId: ReadonlyMap<number, number> | null;
}): ZdOrderList {
  const lines = [...input.lines];
  const pairs = [...input.productPairs];
  const pendingTrusted = input.pendingIndividuals != null;

  const presentTwIds = expandPresentTwIdsWithPairPartners(
    new Set(lines.map((l) => l.tw_Id)),
    pairs
  );
  const catalogExtras = reclassifyMissingTwExtrasToServices(
    buildIndividualEstimateExtras({
      orders: [...(input.pendingIndividuals ?? [])],
      lines,
      pairs,
      boms: [...input.bomRefs],
      teethTwIds: [...input.teethTwIds],
      mikranByTw: buildMikranByTwFromEstimateLines(lines),
    }),
    presentTwIds
  );
  const catalogRawExtraByTwId = individualExtraPiecesMap(catalogExtras);

  const extraOnlyTwIds = pendingTrusted
    ? buildExtraOnlyTwIds(input.onRequestTwIds, catalogRawExtraByTwId, pairs)
    : new Set<number>();
  const orderExcludedTwIds = buildOrderExcludedTwIds(
    input.hardExcludedTwIds,
    input.onRequestTwIds,
    extraOnlyTwIds
  );
  const individualBundle = reclassifyExcludedTwExtrasToServices(
    catalogExtras,
    orderExcludedTwIds
  );
  const dedupe = resolveProsbaReservationDedupeMaps(
    individualBundle.byTwId,
    input.prosbaReservedByTwId
  );

  const explodeBomIncomplete = hasUnresolvedExplodeBomNodes(
    [...input.bomRefs],
    input.missingBomTwIds
  );
  if (explodeBomIncomplete) {
    return { lines: [], explodeBomIncomplete, orderExcludedTwIds, extraOnlyTwIds };
  }

  const orderable = filterOrderableLinesWithPackaging(
    lines,
    input.packagingLookup,
    orderExcludedTwIds,
    dedupe.extraByTwId,
    null,
    extraOnlyTwIds,
    input.extrasPolicy,
    catalogRawExtraByTwId,
    dedupe.stockNeedReliefByTwId,
    dedupe.extraOverlapByTwId,
    input.minStockByTwId
  );

  const out: ZdOrderListLine[] = orderable.map((line) => {
    const pack = input.packagingLookup.get(line.tw_Id);
    const extra = individualExtraPiecesForTw(line.tw_Id, dedupe.extraByTwId);
    const qty = resolveOrderQtyForLine(
      line,
      pack,
      extra,
      extraOnlyTwIds.has(line.tw_Id),
      input.extrasPolicy,
      individualExtraPiecesForTw(line.tw_Id, dedupe.stockNeedReliefByTwId),
      individualExtraPiecesForTw(line.tw_Id, dedupe.extraOverlapByTwId),
      individualExtraPiecesForTw(line.tw_Id, input.minStockByTwId)
    );
    return {
      line,
      zdUnits: qty.zdUnits,
      piecesArriving: piecesArrivingForZdUnitsFromQty(qty.zdUnits, qty),
      piecesNeeded: qty.piecesNeeded,
      individualExtraPieces: extra,
      unitsPerPackage: qty.hasPackaging ? qty.unitsPerPackage : null,
      packageLabel: pack?.packageLabel ?? null,
      packagesMode: qty.hasPackaging && qty.documentUnitMode === "packages",
    };
  });

  return { lines: out, explodeBomIncomplete, orderExcludedTwIds, extraOnlyTwIds };
}
