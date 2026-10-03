"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type TransitionStartFunction,
} from "react";
import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdEstimateMinStockRow } from "@/lib/data/zd-estimate-min-stock";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { DEFAULT_DNI_ZAPASU } from "@/lib/orders/zd-estimate-manual";
import { minStockRowsToMap } from "@/lib/orders/zd-estimate-min-stock-lookup";
import {
  buildBakeExcludedTwIds,
  filterSessionIncludeRespectingOnRequest,
  onRequestTwIdSet,
} from "@/lib/orders/zd-estimate-on-request";
import { mergeZdEstimateExcludedTwIds } from "@/lib/orders/zd-estimate-name-exclude";
import { bomRowsToRefs } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import {
  packagingByTwId,
  packagingRowsToRefreshLookup,
  type PackagingLookup,
  type ZdEstimatePackagingRefreshEntry,
} from "@/lib/orders/zd-estimate-packaging";
import { refreshZdEstimateLinesWithPairs } from "@/lib/orders/zd-estimate-live-refresh";
import type { ZdProductPairRef } from "@/lib/orders/zd-product-pair-units";
import type { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";

/** Reguły działu z bootstrapu strony (SSR) — stan początkowy. */
export type ZdEstimateRulesBootstrap = {
  exclusions: ZdEstimateExclusionRow[];
  exclusionsError: string | null;
  onRequests?: ZdEstimateOnRequestRow[];
  onRequestsError?: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
  minStock?: ZdEstimateMinStockRow[];
  minStockError?: string | null;
  productPairs: ZdProductPairRow[];
  productPairsError: string | null;
  productBoms?: ZdProductBomRow[];
  productBomsError?: string | null;
  teethTwIds?: number[];
  teethProductsError?: string | null;
};

/**
 * Reguły kreatora ZD: wykluczenia, „tylko na prośbę”, opakowania, minimum stanów,
 * pary, składy (BOM) i zęby — stan, błędy wczytania, zaufanie i mapy pochodne.
 */
export function useZdEstimateRulesData(
  bootstrap: ZdEstimateRulesBootstrap
) {
  const exclusionsGenRef = useRef(0);
  const packagingGenRef = useRef(0);
  const pairsGenRef = useRef(0);

  const [exclusions, setExclusions] = useState<ZdEstimateExclusionRow[]>(
    bootstrap.exclusions
  );
  const [exclusionsError, setExclusionsError] = useState<string | null>(
    bootstrap.exclusionsError
  );
  const [onRequests, setOnRequests] = useState<ZdEstimateOnRequestRow[]>(
    bootstrap.onRequests ?? []
  );
  const [onRequestsError, setOnRequestsError] = useState<string | null>(
    bootstrap.onRequestsError ?? null
  );
  const [packaging, setPackaging] = useState<ZdEstimatePackagingRow[]>(
    bootstrap.packaging
  );
  const [packagingError, setPackagingError] = useState<string | null>(
    bootstrap.packagingError
  );
  const [minStock, setMinStock] = useState<ZdEstimateMinStockRow[]>(
    bootstrap.minStock ?? []
  );
  const [minStockError, setMinStockError] = useState<string | null>(
    bootstrap.minStockError ?? null
  );
  const [productPairs, setProductPairs] = useState<ZdProductPairRow[]>(
    bootstrap.productPairs
  );
  const [productPairsError, setProductPairsError] = useState<string | null>(
    bootstrap.productPairsError
  );
  const [productBoms, setProductBoms] = useState<ZdProductBomRow[]>(
    bootstrap.productBoms ?? []
  );
  const [productBomsError, setProductBomsError] = useState<string | null>(
    bootstrap.productBomsError ?? null
  );
  const [teethTwIds, setTeethTwIds] = useState<number[]>(
    bootstrap.teethTwIds ?? []
  );
  const [teethProductsError, setTeethProductsError] = useState<string | null>(
    bootstrap.teethProductsError ?? null
  );
  const exclusionsTrusted = exclusionsError == null;
  const onRequestTrusted = onRequestsError == null;
  const packagingTrusted = packagingError == null;
  const minStockTrusted = minStockError == null;
  const pairsTrusted = productPairsError == null;
  const bomsTrusted = productBomsError == null;
  const teethTrusted = teethProductsError == null;
  // minStock jest soft-fail: brak tabeli/tymczasowy błąd nie blokuje kreatora.
  // Retry jest dostępny w banerze, ale Policz działa z pustą listą minimum.
  const settingsTrusted =
    exclusionsTrusted &&
    onRequestTrusted &&
    packagingTrusted &&
    pairsTrusted &&
    bomsTrusted &&
    teethTrusted;

  const applyExclusionsMutation = useCallback(
    (rows: ZdEstimateExclusionRow[]) => {
      exclusionsGenRef.current += 1;
      setExclusions(rows);
      setExclusionsError(null);
    },
    []
  );

  const applyPackagingMutation = useCallback(
    (rows: ZdEstimatePackagingRow[]) => {
      packagingGenRef.current += 1;
      setPackaging(rows);
      setPackagingError(null);
    },
    []
  );

  const dbExcludedIds = useMemo(
    () => new Set(exclusions.map((e) => e.subiektTwId)),
    [exclusions]
  );

  const onRequestTwIds = useMemo(
    () =>
      onRequestTrusted
        ? onRequestTwIdSet(onRequests, productPairs)
        : new Set<number>(),
    [onRequests, onRequestTrusted, productPairs]
  );

  const teethTwIdSet = useMemo(() => new Set(teethTwIds), [teethTwIds]);

  const packagingByTwIdForRefresh = useMemo(
    () => packagingRowsToRefreshLookup(packaging),
    [packaging]
  );
  const minStockByTwIdForRefresh = useMemo(
    () => minStockRowsToMap(minStock),
    [minStock]
  );

  const packagingMap = useMemo(
    () => packagingByTwId(packaging),
    [packaging]
  );

  const packPairTwIds = useMemo(
    () => new Set(productPairs.map((p) => p.packTwId)),
    [productPairs]
  );

  const packagingLookup = useMemo(() => {
    const map = new Map<number, PackagingLookup>();
    for (const row of packaging) {
      map.set(row.subiektTwId, {
        unitsPerPackage: row.unitsPerPackage,
        packageLabel: row.packageLabel,
        documentUnitMode: row.documentUnitMode,
        orderMultiple: row.orderMultiple,
      });
    }
    for (const pair of productPairs) {
      const existing = map.get(pair.packTwId);
      map.set(pair.packTwId, {
        unitsPerPackage: pair.unitsPerPack,
        packageLabel: existing?.packageLabel ?? "op.",
        documentUnitMode: "packages",
        orderMultiple: existing?.orderMultiple ?? null,
      });
    }
    return map;
  }, [packaging, productPairs]);

  return {
    exclusions,
    setExclusions,
    exclusionsError,
    setExclusionsError,
    onRequests,
    setOnRequests,
    onRequestsError,
    setOnRequestsError,
    packaging,
    setPackaging,
    packagingError,
    setPackagingError,
    minStock,
    setMinStock,
    minStockError,
    setMinStockError,
    productPairs,
    setProductPairs,
    productPairsError,
    setProductPairsError,
    productBoms,
    setProductBoms,
    productBomsError,
    setProductBomsError,
    teethTwIds,
    setTeethTwIds,
    teethProductsError,
    setTeethProductsError,
    pairsGenRef,
    exclusionsTrusted,
    onRequestTrusted,
    packagingTrusted,
    minStockTrusted,
    pairsTrusted,
    bomsTrusted,
    teethTrusted,
    settingsTrusted,
    applyExclusionsMutation,
    applyPackagingMutation,
    dbExcludedIds,
    onRequestTwIds,
    teethTwIdSet,
    packagingByTwIdForRefresh,
    minStockByTwIdForRefresh,
    packagingMap,
    packPairTwIds,
    packagingLookup,
  };
}

export type ZdEstimateRulesData = ReturnType<typeof useZdEstimateRulesData>;

/**
 * Przeliczenie listy po zmianie reguł (bez ponownego Policz) + handlery `apply*Live`
 * dla okien ustawień i akcji wierszy.
 */
export function useZdEstimateRulesLiveApply({
  rules,
  linesBase,
  sessionIncludeTwIds,
  dniZapasu,
  paramInfo,
  zapasMin,
  historyByTwId,
  appliedBoostPolicy,
  canAutoRecount,
  startRemat,
  setLines,
  setMissingPartnerTwIds,
  setMissingBomTwIds,
  flashSettingsLive,
  runEstimateRef,
}: {
  rules: ZdEstimateRulesData;
  linesBase: ManualZdEstimateLine[] | null;
  sessionIncludeTwIds: Record<number, true>;
  dniZapasu: string;
  paramInfo: Record<string, unknown> | null;
  zapasMin: string;
  historyByTwId: Map<number, { lastOrderedQty: number; linkedAt: string }>;
  appliedBoostPolicy: ReturnType<typeof policyForBoostPreset>;
  canAutoRecount: boolean;
  startRemat: TransitionStartFunction;
  setLines: (lines: ManualZdEstimateLine[]) => void;
  setMissingPartnerTwIds: (ids: number[]) => void;
  setMissingBomTwIds: (ids: number[]) => void;
  flashSettingsLive: (message: string) => void;
  runEstimateRef: RefObject<() => void>;
}) {
  const {
    exclusionsTrusted,
    dbExcludedIds,
    teethTrusted,
    teethTwIdSet,
    onRequestTwIds,
    productPairs,
    productBoms,
    packagingByTwIdForRefresh,
    minStockByTwIdForRefresh,
    pairsGenRef,
    setProductPairs,
    setProductPairsError,
    setProductBoms,
    setProductBomsError,
    applyPackagingMutation,
    setMinStock,
    applyExclusionsMutation,
    setOnRequests,
    setOnRequestsError,
  } = rules;

  /** Bake exclude względem linesBase + session — do re-merge par (pełne onRequest). */
  const bakeExcludedTwIds = useMemo(() => {
    const db = exclusionsTrusted ? [...dbExcludedIds] : [];
    let base: Set<number>;
    if (!linesBase) {
      base = new Set(db);
      if (teethTrusted) for (const id of teethTwIdSet) base.add(id);
    } else {
      base = mergeZdEstimateExcludedTwIds(linesBase, db, {
        teethTwIds: teethTrusted ? teethTwIdSet : null,
      });
    }
    const sessionOk = filterSessionIncludeRespectingOnRequest(
      sessionIncludeTwIds,
      onRequestTwIds
    );
    for (const id of sessionOk) base.delete(id);
    return buildBakeExcludedTwIds(base, onRequestTwIds);
  }, [
    linesBase,
    dbExcludedIds,
    exclusionsTrusted,
    teethTwIdSet,
    teethTrusted,
    sessionIncludeTwIds,
    onRequestTwIds,
  ]);

  const excludedIdsForRefresh = bakeExcludedTwIds;

  const reapplyPairsToLines = useCallback(
    (
      nextPairs: readonly ZdProductPairRef[],
      nextBoms: readonly ZdProductBomRow[] = productBoms,
      packagingLookup:
        | ReadonlyMap<number, ZdEstimatePackagingRefreshEntry>
        | null
        | undefined = packagingByTwIdForRefresh,
      minStockLookup:
        | ReadonlyMap<number, number>
        | null
        | undefined = minStockByTwIdForRefresh
    ): {
      missingPartnerTwIds: number[];
      missingBomTwIds: number[];
      applied: boolean;
    } => {
      if (!linesBase || linesBase.length === 0) {
        return {
          missingPartnerTwIds: [],
          missingBomTwIds: [],
          applied: false,
        };
      }
      // Dni zapasu, z którymi liczył serwer (opcja czasu dostawy może je wydłużyć) —
      // inaczej przeliczenie po zmianie reguły wróciłoby do wartości z formularza.
      const serverDni = Number(paramInfo?.dniZapasu);
      const dni = Math.round(
        Number.isFinite(serverDni) && serverDni >= 1 ? serverDni : Number(dniZapasu)
      );
      const dniOkresuRaw = paramInfo?.dniOkresu;
      const dniOkresu =
        dniOkresuRaw != null && Number.isFinite(Number(dniOkresuRaw))
          ? Number(dniOkresuRaw)
          : null;
      const { lines: nextLines, missingPartnerTwIds, missingBomTwIds } =
        refreshZdEstimateLinesWithPairs({
          linesBase,
          pairs: nextPairs,
          boms: bomRowsToRefs(nextBoms),
          options: {
            dniZapasu:
              Number.isFinite(dni) && dni >= 1 ? dni : DEFAULT_DNI_ZAPASU,
            dniOkresu,
            zapasMin: Number(zapasMin) || 0,
            excludedTwIds: excludedIdsForRefresh,
            packagingByTwId: packagingLookup ?? packagingByTwIdForRefresh,
            historyByTwId:
              historyByTwId.size > 0 ? historyByTwId : null,
            salesTrackPolicy: appliedBoostPolicy,
            minStockByTwId: minStockLookup ?? minStockByTwIdForRefresh,
          },
        });
      startRemat(() => {
        setLines(nextLines);
        setMissingPartnerTwIds(missingPartnerTwIds);
        setMissingBomTwIds(missingBomTwIds);
      });
      return { missingPartnerTwIds, missingBomTwIds, applied: true };
    },
    [
      linesBase,
      dniZapasu,
      paramInfo,
      zapasMin,
      excludedIdsForRefresh,
      productBoms,
      packagingByTwIdForRefresh,
      minStockByTwIdForRefresh,
      historyByTwId,
      appliedBoostPolicy,
      startRemat,
      setLines,
      setMissingPartnerTwIds,
      setMissingBomTwIds,
    ]
  );

  const recountEstimateLinesWithExcluded = useCallback(
    (excludedTwIds: ReadonlySet<number>) => {
      if (!linesBase?.length) return;
      // Dni zapasu, z którymi liczył serwer (opcja czasu dostawy może je wydłużyć) —
      // inaczej przeliczenie po zmianie reguły wróciłoby do wartości z formularza.
      const serverDni = Number(paramInfo?.dniZapasu);
      const dni = Math.round(
        Number.isFinite(serverDni) && serverDni >= 1 ? serverDni : Number(dniZapasu)
      );
      const dniOkresuRaw = paramInfo?.dniOkresu;
      const dniOkresu =
        dniOkresuRaw != null && Number.isFinite(Number(dniOkresuRaw))
          ? Number(dniOkresuRaw)
          : null;
      const { lines: nextLines, missingPartnerTwIds, missingBomTwIds } =
        refreshZdEstimateLinesWithPairs({
          linesBase,
          pairs: productPairs,
          boms: bomRowsToRefs(productBoms),
          options: {
            dniZapasu:
              Number.isFinite(dni) && dni >= 1 ? dni : DEFAULT_DNI_ZAPASU,
            dniOkresu,
            zapasMin: Number(zapasMin) || 0,
            excludedTwIds,
            packagingByTwId: packagingByTwIdForRefresh,
            historyByTwId: historyByTwId.size > 0 ? historyByTwId : null,
            salesTrackPolicy: appliedBoostPolicy,
            minStockByTwId: minStockByTwIdForRefresh,
          },
        });
      startRemat(() => {
        setLines(nextLines);
        setMissingPartnerTwIds(missingPartnerTwIds);
        setMissingBomTwIds(missingBomTwIds);
      });
    },
    [
      linesBase,
      productPairs,
      productBoms,
      dniZapasu,
      paramInfo,
      zapasMin,
      packagingByTwIdForRefresh,
      minStockByTwIdForRefresh,
      historyByTwId,
      appliedBoostPolicy,
      startRemat,
      setLines,
      setMissingPartnerTwIds,
      setMissingBomTwIds,
    ]
  );

  const buildExcludedIdsForSessionIncludes = useCallback(
    (
      sessionIncludes: Record<number, true>,
      dbExcluded: Iterable<number> = exclusionsTrusted ? dbExcludedIds : [],
      onRequestIds: ReadonlySet<number> = onRequestTwIds
    ) => {
      const db = [...dbExcluded];
      let base: Set<number>;
      if (!linesBase) {
        base = new Set(db);
        if (teethTrusted) for (const id of teethTwIdSet) base.add(id);
      } else {
        base = mergeZdEstimateExcludedTwIds(linesBase, db, {
          teethTwIds: teethTrusted ? teethTwIdSet : null,
        });
      }
      const sessionOk = filterSessionIncludeRespectingOnRequest(
        sessionIncludes,
        onRequestIds
      );
      for (const id of sessionOk) base.delete(id);
      return buildBakeExcludedTwIds(base, onRequestIds);
    },
    [
      linesBase,
      exclusionsTrusted,
      dbExcludedIds,
      teethTrusted,
      teethTwIdSet,
      onRequestTwIds,
    ]
  );

  const applyPairsMutation = useCallback(
    (rows: ZdProductPairRow[]) => {
      pairsGenRef.current += 1;
      setProductPairs(rows);
      setProductPairsError(null);
      if (!linesBase?.length) {
        flashSettingsLive(
          "Zapisano pary. Policz listę, żeby zobaczyć scalenie na towarach."
        );
        return;
      }
      const { missingPartnerTwIds, missingBomTwIds, applied } =
        reapplyPairsToLines(rows);
      if (!applied) return;
      const missing = missingPartnerTwIds.length + missingBomTwIds.length;
      if (missing > 0 && canAutoRecount) {
        flashSettingsLive(
          "Para zapisana — dociągam brakujących towarów z Subiekta…"
        );
        queueMicrotask(() => runEstimateRef.current());
        return;
      }
      if (missing > 0) {
        flashSettingsLive(
          "Para zapisana, ale towar spoza listy — kliknij „Policz listę”, żeby dociągnąć."
        );
        return;
      }
      flashSettingsLive("Pary zaktualizowane — oznaczenia i Do ZD przeliczone.");
    },
    [
      linesBase,
      reapplyPairsToLines,
      canAutoRecount,
      flashSettingsLive,
      pairsGenRef,
      runEstimateRef,
      setProductPairs,
      setProductPairsError,
    ]
  );

  const applyBomsMutation = useCallback(
    (rows: ZdProductBomRow[]) => {
      setProductBoms(rows);
      setProductBomsError(null);
      if (!linesBase?.length) {
        flashSettingsLive(ZD_BOM_UI.flashSavedNoList);
        return;
      }
      const { missingPartnerTwIds, missingBomTwIds, applied } =
        reapplyPairsToLines(productPairs, rows);
      if (!applied) return;
      const missing = missingPartnerTwIds.length + missingBomTwIds.length;
      if (missing > 0 && canAutoRecount) {
        flashSettingsLive(ZD_BOM_UI.flashFetching);
        queueMicrotask(() => runEstimateRef.current());
        return;
      }
      if (missing > 0) {
        flashSettingsLive(ZD_BOM_UI.flashOutsideList);
        return;
      }
      flashSettingsLive(ZD_BOM_UI.flashUpdated);
    },
    [
      linesBase,
      reapplyPairsToLines,
      productPairs,
      canAutoRecount,
      flashSettingsLive,
      runEstimateRef,
      setProductBoms,
      setProductBomsError,
    ]
  );

  const applyPackagingLive = useCallback(
    (rows: ZdEstimatePackagingRow[]) => {
      applyPackagingMutation(rows);
      if (linesBase?.length) {
        // setState opakowań jest asynchroniczny — przekaż świeżą mapę, nie closure.
        reapplyPairsToLines(
          productPairs,
          productBoms,
          packagingRowsToRefreshLookup(rows)
        );
        flashSettingsLive(ZD_ESTIMATE_UI.packagingLiveFlash);
      } else {
        flashSettingsLive("Opakowania zapisane.");
      }
    },
    [
      applyPackagingMutation,
      linesBase,
      productPairs,
      productBoms,
      reapplyPairsToLines,
      flashSettingsLive,
    ]
  );

  const applyMinStockLive = useCallback(
    (rows: ZdEstimateMinStockRow[]) => {
      setMinStock(rows);
      if (linesBase?.length) {
        // setState minStock jest asynchroniczny — przekaż świeżą mapę, nie closure.
        reapplyPairsToLines(
          productPairs,
          productBoms,
          undefined,
          minStockRowsToMap(rows)
        );
        flashSettingsLive(ZD_ESTIMATE_UI.minStockLiveFlash);
      } else {
        flashSettingsLive("Minimum stanów zapisane.");
      }
    },
    [
      linesBase,
      productPairs,
      productBoms,
      reapplyPairsToLines,
      flashSettingsLive,
      setMinStock,
    ]
  );

  const applyExclusionsLive = useCallback(
    (rows: ZdEstimateExclusionRow[]) => {
      applyExclusionsMutation(rows);
      if (linesBase?.length) {
        // bakeExcluded zaktualizuje się w następnym renderze — przelicz z nowym setem.
        const excludedNow = buildExcludedIdsForSessionIncludes(
          sessionIncludeTwIds,
          rows.map((r) => r.subiektTwId)
        );
        recountEstimateLinesWithExcluded(excludedNow);
        flashSettingsLive("Wykluczenia zaktualizowane — lista przeliczona.");
      }
    },
    [
      applyExclusionsMutation,
      linesBase,
      sessionIncludeTwIds,
      buildExcludedIdsForSessionIncludes,
      recountEstimateLinesWithExcluded,
      flashSettingsLive,
    ]
  );

  const applyOnRequestsLive = useCallback(
    (
      nextRows: ZdEstimateOnRequestRow[],
      /** Świeże hard exclusions — unikaj stale dbExcludedIds przy łańcuchu exclude→onRequest. */
      dbExcluded?: Iterable<number>
    ) => {
      setOnRequests(nextRows);
      setOnRequestsError(null);
      if (linesBase?.length) {
        const excludedNow = buildExcludedIdsForSessionIncludes(
          sessionIncludeTwIds,
          dbExcluded ?? (exclusionsTrusted ? dbExcludedIds : []),
          onRequestTwIdSet(nextRows, productPairs)
        );
        recountEstimateLinesWithExcluded(excludedNow);
        flashSettingsLive(
          "„Tylko na prośbę” zaktualizowane — lista przeliczona."
        );
      } else {
        flashSettingsLive("Zapisano „tylko na prośbę”.");
      }
    },
    [
      linesBase,
      sessionIncludeTwIds,
      exclusionsTrusted,
      dbExcludedIds,
      productPairs,
      buildExcludedIdsForSessionIncludes,
      recountEstimateLinesWithExcluded,
      flashSettingsLive,
      setOnRequests,
      setOnRequestsError,
    ]
  );

  return {
    excludedIdsForRefresh,
    reapplyPairsToLines,
    recountEstimateLinesWithExcluded,
    buildExcludedIdsForSessionIncludes,
    applyPairsMutation,
    applyBomsMutation,
    applyPackagingLive,
    applyMinStockLive,
    applyExclusionsLive,
    applyOnRequestsLive,
  };
}
