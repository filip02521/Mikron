"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdEstimatePackaging,
  actionDeleteZdEstimatePackagingBulk,
  actionExcludeZdEstimateProduct,
  actionExcludeZdEstimateProducts,
  actionFindRecentZdAfterCreateAttempt,
  actionListZdEstimateExclusions,
  actionListZdEstimateTeethTwIds,
  actionListZdEstimatePackaging,
  actionListZdProductPairs,
  actionListZdProductBoms,
  actionRestoreZdEstimateProduct,
  actionRestoreZdEstimateProducts,
  actionRunZdEstimateManual,
  actionFetchZdEstimatePendingIndividuals,
  actionSearchZdEstimateCechy,
  actionSearchZdEstimateGroups,
  actionUpsertZdEstimatePackaging,
  actionUpsertZdEstimatePackagingBulk,
  actionUpsertZdEstimateSupplierScope,
  type ZdEstimateCechaOption,
  type ZdEstimateGroupOption,
  type ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import { bomRowsToRefs } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import {
  ZD_ESTIMATE_UNITS_LEGEND,
  ZD_ESTIMATE_UI,
  zdEstimateBlockedDailyCtaMessage,
  zdEstimateBlockedOrdersAlertBody,
  zdEstimateEmptyListDescription,
  zdEstimateHostBadgeLabel,
  zdEstimateHostStripDetail,
  zdEstimatePrepCardHint,
  zdEstimateReadyFollowUp,
} from "@/lib/orders/zd-estimate-ui-copy";
import { applyGroupStockWindow } from "@/lib/orders/zd-estimate-group-stock";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  DEFAULT_DNI_ZAPASU,
  formatQty,
  salesWindowFromDniZapasu,
} from "@/lib/orders/zd-estimate-manual";
import {
  nextDataOdAfterDataDoChange,
  resolveLaunchDniZapasu,
  shouldApplyStockSalesWindow,
  type ZdEstimateSalesWindowSource,
} from "@/lib/orders/zd-estimate-sales-window";
import { formatSalesTrackHint } from "@/lib/orders/zd-estimate-sales-track";
import {
  formatZdNameAutoExcludeBadge,
  mapZdNameAutoExcludedByTwId,
  mergeZdEstimateExcludedTwIds,
} from "@/lib/orders/zd-estimate-name-exclude";
import {
  ZD_ESTIMATE_BULK_MAX,
} from "@/lib/orders/zd-estimate-bulk";
import {
  filterOrderableLinesWithPackaging,
  individualExtraPiecesForTw,
  orderableLinesToTsv,
  packagingByTwId,
  resolveOrderQtyForLine,
  summarizePackOrderQty,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";
import {
  buildIndividualEstimateExtras,
  buildMikranByTwFromEstimateLines,
  collectIndividualOrderIdsForZdCreate,
  composeZdCreateUwagiWithServices,
  countExcludedWithIndividualRequests,
  individualExtraPiecesMap,
  reclassifyExcludedTwExtrasToServices,
  reclassifyMissingTwExtrasToServices,
  zdCreateUwagiBaseBudgetForServices,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import {
  applyCreatedZdUnitsToOtwarteZd,
  buildZdCreatePreviewFromOrderable,
  canCreateZdFromEstimateState,
  defaultZdCreateUwagi,
  resolveZdCreateKhId,
  ZD_CREATE_MAX_UWAGI_LEN,
} from "@/lib/orders/zd-estimate-create-zd";
import { refreshZdEstimateLinesWithPairs } from "@/lib/orders/zd-estimate-live-refresh";
import type { ZdProductPairRef } from "@/lib/orders/zd-product-pair-units";
import {
  defaultDirForZdEstimateSortKey,
  sortZdEstimateLines,
  type ZdEstimateListSortDir,
  type ZdEstimateListSortKey,
} from "@/lib/orders/zd-estimate-sort";
import {
  claimZdEstimateLaunchAutorun,
  isZdEstimateLaunchAutorunDone,
  isZdEstimateLaunchTimeoutFeedback,
  markZdEstimateLaunchAutorunDone,
  releaseZdEstimateLaunchAutorunPending,
  ZD_ESTIMATE_LAUNCH_TIMEOUT_FEEDBACK,
} from "@/lib/orders/zd-estimate-launch-session";
import { ZdEstimateBulkBar } from "@/components/zakupy/ZdEstimateBulkBar";
import {
  ZdEstimatePairMetaBadge,
  ZdEstimatePairPackStockCell,
  ZdEstimatePairPiecesCell,
  ZdEstimatePairSalesCell,
} from "@/components/zakupy/ZdEstimatePairMetaBadge";
import { ZdEstimateBomMetaBadge } from "@/components/zakupy/ZdEstimateBomMetaBadge";
import { ZdEstimateDoZdCell } from "@/components/zakupy/ZdEstimateDoZdCell";
import { ZdEstimateIndividualMetaBadge } from "@/components/zakupy/ZdEstimateIndividualMetaBadge";
import { ZdEstimateIndividualServicesSection } from "@/components/zakupy/ZdEstimateIndividualServicesSection";
import { ZdEstimateBulkExcludeDialog } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";
import { ZdEstimateBulkPackagingDialog } from "@/components/zakupy/ZdEstimateBulkPackagingDialog";
import { ZdEstimateExcludeDialog } from "@/components/zakupy/ZdEstimateExcludeDialog";
import { ZdEstimateExclusionsModal } from "@/components/zakupy/ZdEstimateExclusionsModal";
import { ZdEstimateLinkZdDialog } from "@/components/zakupy/ZdEstimateLinkZdDialog";
import { ZdEstimateCreateZdDialog } from "@/components/zakupy/ZdEstimateCreateZdDialog";
import { ZdEstimatePackagingDialog } from "@/components/zakupy/ZdEstimatePackagingDialog";
import { ZdEstimatePackagingModal } from "@/components/zakupy/ZdEstimatePackagingModal";
import {
  ZdEstimatePairsModal,
  type ZdPairSeedProduct,
} from "@/components/zakupy/ZdEstimatePairsModal";
import {
  ZdEstimateBomsModal,
  type ZdBomSeedProduct,
} from "@/components/zakupy/ZdEstimateBomsModal";
import { ZdEstimateRowActions } from "@/components/zakupy/ZdEstimateRowActions";
import {
  ZdEstimateLaunchProgressPanel,
} from "@/components/zakupy/ZdEstimateLaunchProgress";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { Alert } from "@/components/ui/Alert";
import {
  launchProgressMinRevealWaitMs,
} from "@/lib/orders/zd-estimate-launch-progress";
import {
  scrollZdEstimateIntoView,
  scrollZdEstimateWhenReady,
  ZD_ESTIMATE_ASSIGN_FOCUS_ID,
  ZD_ESTIMATE_ERROR_FOCUS_ID,
  ZD_ESTIMATE_LAUNCH_FOCUS_ID,
  ZD_ESTIMATE_LIST_FOCUS_ID,
  ZD_ESTIMATE_READY_FOCUS_ID,
  ZD_ESTIMATE_SERVICES_FOCUS_ID,
} from "@/lib/orders/zd-estimate-launch-scroll";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconChevronDown,
  IconClipboardList,
  IconPackage,
  IconSearch,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  checkboxBrandClass,
  panelTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";

/** Luźniejszy inset niż standard panelu dziennego — tabela potrzebuje powietrza. */
const estimateSectionInsetClass =
  "px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6";

const estimateMetaPillClass =
  "min-w-0 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 px-4 py-3 shadow-sm shadow-slate-900/[0.02]";

export type ZdEstimateLaunchProps = {
  fromDaily: boolean;
  supplierId: string | null;
  supplierName: string | null;
  autorun: boolean;
  needsAssign: boolean;
  mode: ZdEstimateRunMode | null;
  grupaId: number | null;
  cechaId: number | null;
  label: string | null;
  resolveMessage: string | null;
  /** Jednorazowy token SSR — chroni przed podwójnym autorun (Strict Mode). */
  launchKey: string | null;
};

function launchHasRunnableScope(launch: ZdEstimateLaunchProps | null | undefined) {
  if (!launch?.mode) return false;
  if (launch.mode === "grupa") {
    return launch.grupaId != null && launch.grupaId > 0;
  }
  return launch.cechaId != null && launch.cechaId > 0;
}

function settingsTrustFailMessage(input: {
  exclusionsError: string | null;
  packagingError: string | null;
  productPairsError: string | null;
  productBomsError: string | null;
  teethProductsError: string | null;
}): string {
  const parts = [
    input.exclusionsError ? `wykluczenia (${input.exclusionsError})` : null,
    input.packagingError ? `opakowania (${input.packagingError})` : null,
    input.productPairsError ? `pary (${input.productPairsError})` : null,
    input.productBomsError
      ? ZD_BOM_UI.settingsPart(input.productBomsError)
      : null,
    input.teethProductsError ? `zęby (${input.teethProductsError})` : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return ZD_BOM_UI.settingsNeedAll;
  }
  return ZD_BOM_UI.settingsFail(parts.join("; "));
}
type Bootstrap = {
  configured: boolean;
  liveBaseUrl: string | null;
  ordersBaseUrl: string | null;
  ordersBlockedReason: string | null;
  ordersMessage: string | null;
  ordersPort: number | null;
  ordersHostKind: "live" | "orders_test" | null;
  ordersIsLive: boolean;
  ordersHostLabel: string | null;
  testPort: number;
  todayKey: string;
  salesEndKey: string;
  salesEndFromFs: boolean;
  defaultWindow: { dataOd: string; dataDo: string };
  suppliers: ZdEstimateSupplierOption[];
  quickGroups: ZdEstimateGroupOption[];
  exclusions: ZdEstimateExclusionRow[];
  exclusionsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
  productPairs: ZdProductPairRow[];
  productPairsError: string | null;
  productBoms: ZdProductBomRow[];
  productBomsError: string | null;
  teethTwIds: number[];
  teethProductsError: string | null;
};

type RunMeta = {
  pagesFetched: number;
  totalCountApi: number;
  truncated: boolean;
  ordersBaseUrl: string;
  durationMs: number;
  totalFromSubiekt: number;
};

type ListFilter = "order" | "all" | "excluded";

function resolveWindowForGroup(
  group: ZdEstimateGroupOption,
  suppliers: ZdEstimateSupplierOption[],
  salesEndKey: string
) {
  if (group.dniZapasu != null && group.dniZapasu > 0) {
    const window = salesWindowFromDniZapasu(group.dniZapasu, salesEndKey);
    return {
      dniZapasu: group.dniZapasu,
      dataOd: window.dataOd,
      dataDo: window.dataDo,
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      stockLabel: group.stockLabel,
      matched: true as const,
    };
  }
  return applyGroupStockWindow({
    groupName: group.grt_Nazwa,
    suppliers,
    salesEndKey,
    fallbackDniZapasu: DEFAULT_DNI_ZAPASU,
    salesWindowFromDniZapasu,
  });
}

function resolveWindowForCecha(
  cecha: ZdEstimateCechaOption,
  suppliers: ZdEstimateSupplierOption[],
  salesEndKey: string
) {
  if (cecha.dniZapasu != null && cecha.dniZapasu > 0) {
    const window = salesWindowFromDniZapasu(cecha.dniZapasu, salesEndKey);
    return {
      dniZapasu: cecha.dniZapasu,
      dataOd: window.dataOd,
      dataDo: window.dataDo,
      supplierId: cecha.supplierId,
      supplierName: cecha.supplierName,
      stockLabel: cecha.stockLabel,
      matched: true as const,
    };
  }
  return applyGroupStockWindow({
    groupName: cecha.ctw_Nazwa,
    suppliers,
    salesEndKey,
    fallbackDniZapasu: DEFAULT_DNI_ZAPASU,
    salesWindowFromDniZapasu,
  });
}

function MetaPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={estimateMetaPillClass}>
      <p className={panelTypography.caption}>{label}</p>
      <p
        className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 sm:text-[0.9375rem]"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function ZdEstimateWorkbench({
  bootstrap,
  launch = null,
}: {
  bootstrap: Bootstrap;
  launch?: ZdEstimateLaunchProps | null;
}) {
  const [estimating, startEstimate] = useTransition();
  const [searching, startSearch] = useTransition();
  const [mutating, startMutate] = useTransition();
  const exclusionsGenRef = useRef(0);
  const packagingGenRef = useRef(0);
  const pairsGenRef = useRef(0);
  /** Unieważnia wynik „Policz”, gdy zakres zmieni się w trakcie requestu. */
  const estimateGenRef = useRef(0);
  /** Unieważnia spóźnione odpowiedzi fetch próśb (mount vs Policz). */
  const pendingFetchGenRef = useRef(0);
  /** Lokalny guard w ramach jednego mountu (sessionStorage chroni remount). */
  const launchedRef = useRef(false);
  /** Opóźniony reveal sukcesu — min. czas widoczności checklisty. */
  const launchRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const runEstimateRef = useRef<(opts?: { fromLaunch?: boolean }) => void>(
    () => {}
  );

  const [scopeMode, setScopeMode] = useState<ZdEstimateRunMode>(
    () => launch?.mode ?? "grupa"
  );
  const [groupQuery, setGroupQuery] = useState(() =>
    launch?.mode === "grupa" ? launch.label?.trim() ?? "" : ""
  );
  const [groupHits, setGroupHits] = useState<ZdEstimateGroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ZdEstimateGroupOption | null>(
    () => {
      if (launch?.mode !== "grupa" || !launch.grupaId) return null;
      const s = bootstrap.suppliers.find((x) => x.id === launch.supplierId);
      return {
        grt_Id: launch.grupaId,
        grt_Nazwa: launch.label?.trim() || `Grupa ${launch.grupaId}`,
        supplierId: launch.supplierId,
        supplierName: launch.supplierName ?? s?.name ?? null,
        dniZapasu: s?.dniZapasu ?? null,
        stockLabel: s?.stockLabel ?? null,
        subiektKhId: s?.subiektKhId ?? null,
        additionalSubiektKhIds: s?.additionalSubiektKhIds ?? [],
      };
    }
  );
  const [cechaQuery, setCechaQuery] = useState(() =>
    launch?.mode === "cecha" ? launch.label?.trim() ?? "" : ""
  );
  const [cechaHits, setCechaHits] = useState<ZdEstimateCechaOption[]>([]);
  const [selectedCecha, setSelectedCecha] = useState<ZdEstimateCechaOption | null>(
    () => {
      if (launch?.mode !== "cecha" || !launch.cechaId) return null;
      const s = bootstrap.suppliers.find((x) => x.id === launch.supplierId);
      return {
        ctw_Id: launch.cechaId,
        ctw_Nazwa: launch.label?.trim() || `Cecha ${launch.cechaId}`,
        supplierId: launch.supplierId,
        supplierName: launch.supplierName ?? s?.name ?? null,
        dniZapasu: s?.dniZapasu ?? null,
        stockLabel: s?.stockLabel ?? null,
        subiektKhId: s?.subiektKhId ?? null,
        additionalSubiektKhIds: s?.additionalSubiektKhIds ?? [],
      };
    }
  );
  const [supplierId, setSupplierId] = useState<string | null>(
    launch?.supplierId ?? null
  );
  const [dniZapasu, setDniZapasu] = useState(() => {
    const fromSupplier = bootstrap.suppliers.find(
      (s) => s.id === launch?.supplierId
    )?.dniZapasu;
    const fromGroup =
      launch?.mode === "grupa"
        ? bootstrap.quickGroups.find((g) => g.grt_Id === launch.grupaId)
            ?.dniZapasu
        : null;
    return String(
      resolveLaunchDniZapasu({
        supplierDniZapasu: fromSupplier,
        groupDniZapasu: fromGroup,
        quickGroupDniZapasu: bootstrap.quickGroups.find((g) => g.dniZapasu)
          ?.dniZapasu,
        defaultDni: DEFAULT_DNI_ZAPASU,
      })
    );
  });
  const [dataOd, setDataOd] = useState(() => {
    const fromSupplier = bootstrap.suppliers.find(
      (s) => s.id === launch?.supplierId
    )?.dniZapasu;
    const fromGroup =
      launch?.mode === "grupa"
        ? bootstrap.quickGroups.find((g) => g.grt_Id === launch.grupaId)
            ?.dniZapasu
        : null;
    const n = resolveLaunchDniZapasu({
      supplierDniZapasu: fromSupplier,
      groupDniZapasu: fromGroup,
      quickGroupDniZapasu: bootstrap.quickGroups.find((g) => g.dniZapasu)
        ?.dniZapasu,
      defaultDni: DEFAULT_DNI_ZAPASU,
    });
    return salesWindowFromDniZapasu(n, bootstrap.salesEndKey).dataOd;
  });
  const [dataDo, setDataDo] = useState(bootstrap.defaultWindow.dataDo);
  /**
   * manual = użytkownik ustawił Data od/do — nie nadpisuj z zapasu dostawcy/grupy.
   * Zmiana „Dni zapasu” wraca do stock (świadome przeliczenie okna).
   */
  const [salesWindowSource, setSalesWindowSource] =
    useState<ZdEstimateSalesWindowSource>("stock");
  const [zapasMin, setZapasMin] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prepCollapsed, setPrepCollapsed] = useState(false);
  const [launchReadyMessage, setLaunchReadyMessage] = useState<string | null>(
    null
  );
  const [launchStartedAtMs, setLaunchStartedAtMs] = useState<number | null>(
    () => {
      if (!launch?.autorun || launch.needsAssign) return null;
      if (!launchHasRunnableScope(launch)) return null;
      const trusted =
        bootstrap.exclusionsError == null &&
        bootstrap.packagingError == null &&
        bootstrap.productPairsError == null &&
        bootstrap.productBomsError == null &&
        bootstrap.teethProductsError == null;
      return trusted ? Date.now() : null;
    }
  );
  /** Pełny panel postępu od hydracji do końca estimate (nie tylko useTransition). */
  const [launchBlocking, setLaunchBlocking] = useState(() => {
    if (!launch?.autorun || launch.needsAssign) return false;
    if (!launchHasRunnableScope(launch)) return false;
    const trusted =
      bootstrap.exclusionsError == null &&
      bootstrap.packagingError == null &&
      bootstrap.productPairsError == null &&
      bootstrap.productBomsError == null &&
      bootstrap.teethProductsError == null;
    return trusted;
  });
  /** Ostatni krok ✓ tuż przed schowaniem panelu. */
  const [launchForceComplete, setLaunchForceComplete] = useState(false);
  const [assignHint, setAssignHint] = useState<string | null>(
    launch?.needsAssign ? launch.resolveMessage : null
  );

  const beginLaunchProgress = useCallback((): number => {
    const started = Date.now();
    setLaunchBlocking(true);
    setLaunchForceComplete(false);
    setLaunchStartedAtMs(started);
    setLaunchReadyMessage(null);
    return started;
  }, []);
  const [showZkColumn, setShowZkColumn] = useState(false);
  /** Stan / rez. — domyślnie ukryte (Dostępne wystarczy). */
  const [showStockDetail, setShowStockDetail] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("order");
  const [sortKey, setSortKey] = useState<ZdEstimateListSortKey>("doZd");
  const [sortDir, setSortDir] = useState<ZdEstimateListSortDir>("desc");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!launch?.autorun || launch.needsAssign) return null;
    if (!bootstrap.configured) return null;
    if (!launchHasRunnableScope(launch)) {
      return "Brak zakresu Subiekta do automatycznego szacunku.";
    }
    const trusted =
      bootstrap.exclusionsError == null &&
      bootstrap.packagingError == null &&
      bootstrap.productPairsError == null &&
      bootstrap.productBomsError == null &&
      bootstrap.teethProductsError == null;
    if (trusted) return null;
    return settingsTrustFailMessage({
      exclusionsError: bootstrap.exclusionsError,
      packagingError: bootstrap.packagingError,
      productPairsError: bootstrap.productPairsError,
      productBomsError: bootstrap.productBomsError,
      teethProductsError: bootstrap.teethProductsError,
    });
  });
  const [lines, setLines] = useState<ManualZdEstimateLine[] | null>(null);
  /** Snapshot przed merge par — do live refresh po zmianie par/opakowań. */
  const [linesBase, setLinesBase] = useState<ManualZdEstimateLine[] | null>(
    null
  );
  /** Historia snapshotów z ostatniego Policz — live refresh musi ją przekazać. */
  const [historyByTwId, setHistoryByTwId] = useState<
    Map<number, { lastOrderedQty: number; linkedAt: string }>
  >(() => new Map());
  const [settingsLiveMessage, setSettingsLiveMessage] = useState<string | null>(
    null
  );
  const [paramInfo, setParamInfo] = useState<Record<string, unknown> | null>(null);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [linkOkMessage, setLinkOkMessage] = useState<string | null>(null);
  const [createZdOpen, setCreateZdOpen] = useState(false);
  const [createZdOkMessage, setCreateZdOkMessage] = useState<string | null>(
    null
  );
  const [createDoneDokId, setCreateDoneDokId] = useState<number | null>(null);
  const [createDoneDokNr, setCreateDoneDokNr] = useState<string | null>(null);
  const [creatingZd, setCreatingZd] = useState(false);
  const [pendingIndividuals, setPendingIndividuals] = useState<
    ZdEstimatePendingIndividualOrder[]
  >([]);
  const [pendingIndividualsError, setPendingIndividualsError] = useState<
    string | null
  >(null);
  const [pendingIndividualsTruncated, setPendingIndividualsTruncated] =
    useState(false);
  const [pendingIndividualsLoading, setPendingIndividualsLoading] =
    useState(false);
  const [linkNrPrefill, setLinkNrPrefill] = useState<string | null>(null);
  const [exclusions, setExclusions] = useState<ZdEstimateExclusionRow[]>(
    bootstrap.exclusions
  );
  const [exclusionsError, setExclusionsError] = useState<string | null>(
    bootstrap.exclusionsError
  );
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [linkZdOpen, setLinkZdOpen] = useState(false);
  const [packaging, setPackaging] = useState<ZdEstimatePackagingRow[]>(
    bootstrap.packaging
  );
  const [packagingError, setPackagingError] = useState<string | null>(
    bootstrap.packagingError
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
  const [pairsOpen, setPairsOpen] = useState(false);
  const [pairSeed, setPairSeed] = useState<
    readonly [ZdPairSeedProduct, ZdPairSeedProduct] | null
  >(null);
  const [pairPartnerMissingCount, setPairPartnerMissingCount] = useState(0);
  const [bomsOpen, setBomsOpen] = useState(false);
  const [bomSeed, setBomSeed] = useState<readonly ZdBomSeedProduct[] | null>(
    null
  );
  const [bomMissingCount, setBomMissingCount] = useState(0);
  const [packagingOpen, setPackagingOpen] = useState(false);
  const [packagingCandidate, setPackagingCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [excludeCandidate, setExcludeCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [mutatingTwId, setMutatingTwId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [bulkExcludeOpen, setBulkExcludeOpen] = useState(false);
  const [bulkPackagingOpen, setBulkPackagingOpen] = useState(false);
  const [bulkPackagingMode, setBulkPackagingMode] = useState<"set" | "clear">(
    "set"
  );
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const busy = estimating || searching || mutating;
  const exclusionsTrusted = exclusionsError == null;
  const packagingTrusted = packagingError == null;
  const pairsTrusted = productPairsError == null;
  const bomsTrusted = productBomsError == null;
  const teethTrusted = teethProductsError == null;
  const settingsTrusted =
    exclusionsTrusted &&
    packagingTrusted &&
    pairsTrusted &&
    bomsTrusted &&
    teethTrusted;

  const clearSelection = useCallback(() => setSelected({}), []);

  const clearSucceededFromSelection = useCallback((ids: number[]) => {
    if (!ids.length) return;
    setSelected((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of ids) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

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

  const reportError = useCallback((message: string) => {
    setFeedback(null);
    setErrorMessage(message);
  }, []);

  const flashSettingsLive = useCallback((message: string) => {
    setSettingsLiveMessage(message);
    window.setTimeout(() => {
      setSettingsLiveMessage((cur) => (cur === message ? null : cur));
    }, 3200);
  }, []);

  const selectedSupplier = useMemo(
    () => bootstrap.suppliers.find((s) => s.id === supplierId) ?? null,
    [bootstrap.suppliers, supplierId]
  );

  const createKhResolution = useMemo(() => {
    if (!selectedSupplier) return null;
    return resolveZdCreateKhId({
      supplierName: selectedSupplier.name,
      primaryKhId: selectedSupplier.subiektKhId,
      additionalKhIds: selectedSupplier.additionalSubiektKhIds,
    });
  }, [selectedSupplier]);

  const dbExcludedIds = useMemo(
    () => new Set(exclusions.map((e) => e.subiektTwId)),
    [exclusions]
  );

  const teethTwIdSet = useMemo(() => new Set(teethTwIds), [teethTwIds]);

  const nameAutoByTwId = useMemo(
    () =>
      lines
        ? mapZdNameAutoExcludedByTwId(lines, {
            teethTwIds: teethTrusted ? teethTwIdSet : null,
          })
        : new Map(),
    [lines, teethTwIdSet, teethTrusted]
  );

  /** DB (gdy zaufane) + auto z nazwy + katalog zębów. */
  const excludedIds = useMemo(() => {
    const db = exclusionsTrusted ? [...dbExcludedIds] : [];
    if (!lines) {
      const base = new Set(db);
      if (teethTrusted) for (const id of teethTwIdSet) base.add(id);
      return base;
    }
    return mergeZdEstimateExcludedTwIds(lines, db, {
      teethTwIds: teethTrusted ? teethTwIdSet : null,
    });
  }, [lines, dbExcludedIds, exclusionsTrusted, teethTwIdSet, teethTrusted]);

  /** Wykluczenia liczone względem linesBase — bezpieczne przy re-merge par. */
  const excludedIdsForRefresh = useMemo(() => {
    const db = exclusionsTrusted ? [...dbExcludedIds] : [];
    if (!linesBase) {
      const base = new Set(db);
      if (teethTrusted) for (const id of teethTwIdSet) base.add(id);
      return base;
    }
    return mergeZdEstimateExcludedTwIds(linesBase, db, {
      teethTwIds: teethTrusted ? teethTwIdSet : null,
    });
  }, [linesBase, dbExcludedIds, exclusionsTrusted, teethTwIdSet, teethTrusted]);

  const packagingByTwIdForRefresh = useMemo(() => {
    const map = new Map<number, { unitsPerPackage: number }>();
    for (const row of packaging) {
      map.set(row.subiektTwId, { unitsPerPackage: row.unitsPerPackage });
    }
    return map;
  }, [packaging]);

  const reapplyPairsToLines = useCallback(
    (
      nextPairs: readonly ZdProductPairRef[],
      nextBoms: readonly ZdProductBomRow[] = productBoms
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
      const dni = Math.round(Number(dniZapasu));
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
            packagingByTwId: packagingByTwIdForRefresh,
            historyByTwId:
              historyByTwId.size > 0 ? historyByTwId : null,
          },
        });
      setLines(nextLines);
      setPairPartnerMissingCount(missingPartnerTwIds.length);
      setBomMissingCount(missingBomTwIds.length);
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
      historyByTwId,
    ]
  );

  const canAutoRecount =
    Boolean(linesBase?.length) &&
    ((scopeMode === "grupa" && selectedGroup?.grt_Id) ||
      (scopeMode === "cecha" && selectedCecha?.ctw_Id));

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
    [linesBase, reapplyPairsToLines, canAutoRecount, flashSettingsLive]
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
    ]
  );

  const applyPackagingLive = useCallback(
    (rows: ZdEstimatePackagingRow[]) => {
      applyPackagingMutation(rows);
      if (linesBase?.length) {
        reapplyPairsToLines(productPairs);
        flashSettingsLive(
          "Opakowania zaktualizowane — Do ZD i oznaczenia na bieżąco."
        );
      } else {
        flashSettingsLive("Opakowania zapisane.");
      }
    },
    [
      applyPackagingMutation,
      linesBase,
      productPairs,
      reapplyPairsToLines,
      flashSettingsLive,
    ]
  );

  const applyExclusionsLive = useCallback(
    (rows: ZdEstimateExclusionRow[]) => {
      applyExclusionsMutation(rows);
      if (linesBase?.length) {
        // excludedIdsForRefresh zaktualizuje się w następnym renderze — przelicz z nowym setem.
        const db = new Set(rows.map((r) => r.subiektTwId));
        const excludedNow = mergeZdEstimateExcludedTwIds(
          linesBase,
          [...db],
          { teethTwIds: teethTrusted ? teethTwIdSet : null }
        );
        const dni = Math.round(Number(dniZapasu));
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
              excludedTwIds: excludedNow,
              packagingByTwId: packagingByTwIdForRefresh,
              historyByTwId:
                historyByTwId.size > 0 ? historyByTwId : null,
            },
          });
        setLines(nextLines);
        setPairPartnerMissingCount(missingPartnerTwIds.length);
        setBomMissingCount(missingBomTwIds.length);
        flashSettingsLive("Wykluczenia zaktualizowane — lista przeliczona.");
      }
    },
    [
      applyExclusionsMutation,
      linesBase,
      productPairs,
      productBoms,
      packagingByTwIdForRefresh,
      historyByTwId,
      teethTrusted,
      teethTwIdSet,
      dniZapasu,
      paramInfo,
      zapasMin,
      flashSettingsLive,
    ]
  );
  const exclusionById = useMemo(() => {
    const map = new Map<number, ZdEstimateExclusionRow>();
    for (const e of exclusions) map.set(e.subiektTwId, e);
    return map;
  }, [exclusions]);

  const packagingMap = useMemo(
    () => packagingByTwId(packaging),
    [packaging]
  );

  const packagingLookup = useMemo(() => {
    const map = new Map<number, PackagingLookup>();
    for (const row of packaging) {
      map.set(row.subiektTwId, {
        unitsPerPackage: row.unitsPerPackage,
        packageLabel: row.packageLabel,
      });
    }
    for (const pair of productPairs) {
      const existing = map.get(pair.packTwId);
      map.set(pair.packTwId, {
        unitsPerPackage: pair.unitsPerPack,
        packageLabel: existing?.packageLabel ?? "op.",
      });
    }
    return map;
  }, [packaging, productPairs]);

  const individualBundle = useMemo(() => {
    const mikranByTw = buildMikranByTwFromEstimateLines(lines ?? []);
    const presentTwIds = new Set((lines ?? []).map((l) => l.tw_Id));
    if (!pendingIndividuals.length) {
      return reclassifyExcludedTwExtrasToServices(
        reclassifyMissingTwExtrasToServices(
          buildIndividualEstimateExtras({
            orders: [],
            lines: lines ?? [],
            pairs: productPairs,
            boms: bomRowsToRefs(productBoms),
            teethTwIds,
            mikranByTw,
          }),
          presentTwIds
        ),
        excludedIds
      );
    }
    const raw = buildIndividualEstimateExtras({
      orders: pendingIndividuals,
      lines: lines ?? [],
      pairs: productPairs,
      boms: bomRowsToRefs(productBoms),
      teethTwIds,
      mikranByTw,
    });
    return reclassifyExcludedTwExtrasToServices(
      reclassifyMissingTwExtrasToServices(raw, presentTwIds),
      excludedIds
    );
  }, [
    pendingIndividuals,
    lines,
    productPairs,
    productBoms,
    teethTwIds,
    excludedIds,
  ]);

  /** Ile próśb było na wykluczonych tw przed reclassify → usługi. */
  const excludedRoutedToServicesCount = useMemo(
    () =>
      individualBundle.serviceLines.filter((l) => l.reason === "excluded")
        .length,
    [individualBundle.serviceLines]
  );

  const individualExtraByTwId = useMemo(
    () => individualExtraPiecesMap(individualBundle),
    [individualBundle]
  );

  const excludedWithIndividualCount = useMemo(
    () =>
      // Po reclassify powinno być 0; zostawione jako safety net.
      countExcludedWithIndividualRequests(
        individualBundle.byTwId,
        excludedIds
      ),
    [individualBundle.byTwId, excludedIds]
  );

  const orderSummary = useMemo(() => {
    if (!lines || !settingsTrusted) {
      return {
        doZamowieniaCount: 0,
        piecesNeededSuma: 0,
        zdUnitsSuma: 0,
        piecesArrivingSuma: 0,
      };
    }
    return summarizePackOrderQty(
      lines,
      packagingLookup,
      excludedIds,
      individualExtraByTwId
    );
  }, [
    lines,
    packagingLookup,
    excludedIds,
    settingsTrusted,
    individualExtraByTwId,
  ]);

  const orderableLines = useMemo(() => {
    if (!lines || !settingsTrusted) return [];
    return filterOrderableLinesWithPackaging(
      lines,
      packagingLookup,
      excludedIds,
      individualExtraByTwId
    );
  }, [
    lines,
    packagingLookup,
    excludedIds,
    settingsTrusted,
    individualExtraByTwId,
  ]);

  const createZdGate = useMemo(
    () =>
      canCreateZdFromEstimateState({
        configured: bootstrap.configured,
        settingsTrusted,
        orderableCount: orderableLines.length,
        supplierId,
        khResolution: createKhResolution,
        estimating,
        mutating,
        creating: creatingZd,
        createDoneDokId,
      }),
    [
      bootstrap.configured,
      settingsTrusted,
      orderableLines.length,
      supplierId,
      createKhResolution,
      estimating,
      mutating,
      creatingZd,
      createDoneDokId,
    ]
  );

  const createZdPreview = useMemo(
    () =>
      buildZdCreatePreviewFromOrderable(
        orderableLines,
        packagingLookup,
        individualExtraByTwId
      ),
    [orderableLines, packagingLookup, individualExtraByTwId]
  );

  const createBaseUwagi = useMemo(() => {
    const label =
      scopeMode === "grupa"
        ? selectedGroup?.grt_Nazwa ?? null
        : selectedCecha?.ctw_Nazwa ?? null;
    return defaultZdCreateUwagi({
      supplierName:
        createKhResolution && createKhResolution.ok
          ? createKhResolution.supplierName
          : selectedSupplier?.name || "Dostawca",
      scopeLabel: label,
      dateKey: bootstrap.todayKey,
    });
  }, [
    createKhResolution,
    selectedSupplier?.name,
    scopeMode,
    selectedGroup?.grt_Nazwa,
    selectedCecha?.ctw_Nazwa,
    bootstrap.todayKey,
  ]);

  const createUwagiWithServices = useMemo(
    () =>
      composeZdCreateUwagiWithServices({
        baseUwagi: createBaseUwagi,
        serviceLines: individualBundle.serviceLines,
        maxLen: ZD_CREATE_MAX_UWAGI_LEN,
        prioritizeServices: true,
      }),
    [createBaseUwagi, individualBundle.serviceLines]
  );

  const createUwagiBaseMaxLen = useMemo(
    () =>
      zdCreateUwagiBaseBudgetForServices({
        serviceLines: individualBundle.serviceLines,
        maxLen: ZD_CREATE_MAX_UWAGI_LEN,
      }),
    [individualBundle.serviceLines]
  );

  const createCatalogOrderIds = useMemo(
    () =>
      collectIndividualOrderIdsForZdCreate({
        byTwId: individualBundle.byTwId,
        createdTwIds: createZdPreview.lines.map((l) => l.twId),
        serviceOrderIds: [],
      }),
    [individualBundle.byTwId, createZdPreview.lines]
  );

  const createServiceOrderIds = useMemo(
    () => [
      ...new Set(
        individualBundle.serviceLines.flatMap((l) =>
          l.requests.map((r) => r.orderId)
        )
      ),
    ],
    [individualBundle.serviceLines]
  );

  const createServiceOrderIdsMarkPreview = useMemo(
    () => createUwagiWithServices.includedServiceOrderIds,
    [createUwagiWithServices.includedServiceOrderIds]
  );

  const excludedInGroupCount = useMemo(() => {
    if (!lines) return 0;
    // Auto z nazwy zawsze; ręczne tylko gdy lista DB zaufana.
    return lines.filter((l) => excludedIds.has(l.tw_Id)).length;
  }, [lines, excludedIds]);

  const packagingInGroupCount = useMemo(() => {
    if (!lines || !packagingTrusted) return 0;
    return lines.filter((l) => packagingMap.has(l.tw_Id)).length;
  }, [lines, packagingMap, packagingTrusted]);

  const scopeSelected =
    scopeMode === "grupa" ? selectedGroup != null : selectedCecha != null;
  const scopeLabel =
    scopeMode === "grupa"
      ? selectedGroup?.grt_Nazwa ?? null
      : selectedCecha?.ctw_Nazwa ?? null;
  const stockLabel =
    selectedSupplier?.stockLabel ??
    (scopeMode === "cecha"
      ? selectedCecha?.stockLabel
      : selectedGroup?.stockLabel) ??
    null;
  const supplierLabel =
    selectedSupplier?.name ??
    (scopeMode === "cecha"
      ? selectedCecha?.supplierName
      : selectedGroup?.supplierName) ??
    null;

  const clearEstimateResult = () => {
    estimateGenRef.current += 1;
    setLines(null);
    setLinesBase(null);
    setHistoryByTwId(new Map());
    setParamInfo(null);
    setMeta(null);
    setSelected({});
    setPairPartnerMissingCount(0);
    setCopyOk(false);
    setLinkOkMessage(null);
    setCreateDoneDokId(null);
    setCreateDoneDokNr(null);
    setCreateZdOkMessage(null);
    setCreateZdOpen(false);
    setCreatingZd(false);
    setLinkNrPrefill(null);
  };

  const changeScopeMode = (mode: ZdEstimateRunMode) => {
    if (mode === scopeMode) return;
    setScopeMode(mode);
    setFeedback(null);
    setErrorMessage(null);
    clearEstimateResult();
    if (mode === "grupa") {
      setSelectedCecha(null);
      setCechaHits([]);
      setCechaQuery("");
    } else {
      setSelectedGroup(null);
      setGroupHits([]);
      setGroupQuery("");
    }
  };

  const selectGroup = (group: ZdEstimateGroupOption) => {
    const scopeChanged =
      scopeMode !== "grupa" || selectedGroup?.grt_Id !== group.grt_Id;
    setScopeMode("grupa");
    setSelectedGroup(group);
    setSelectedCecha(null);
    setCechaHits([]);
    setGroupQuery(group.grt_Nazwa);
    setGroupHits([]);
    setFeedback(null);
    setErrorMessage(null);

    const applied = resolveWindowForGroup(
      group,
      bootstrap.suppliers,
      bootstrap.salesEndKey
    );
    const supplierChanged = applied.supplierId !== supplierId;
    if (scopeChanged || supplierChanged) clearEstimateResult();
    else setCopyOk(false);

    setSupplierId(applied.supplierId);
    setDniZapasu(String(applied.dniZapasu));
    if (shouldApplyStockSalesWindow(salesWindowSource)) {
      setDataOd(applied.dataOd);
      setDataDo(applied.dataDo);
    }
  };

  const selectCecha = (cecha: ZdEstimateCechaOption) => {
    const scopeChanged =
      scopeMode !== "cecha" || selectedCecha?.ctw_Id !== cecha.ctw_Id;
    setScopeMode("cecha");
    setSelectedCecha(cecha);
    setSelectedGroup(null);
    setGroupHits([]);
    setCechaQuery(cecha.ctw_Nazwa);
    setCechaHits([]);
    setFeedback(null);
    setErrorMessage(null);

    const applied = resolveWindowForCecha(
      cecha,
      bootstrap.suppliers,
      bootstrap.salesEndKey
    );
    const supplierChanged = applied.supplierId !== supplierId;
    if (scopeChanged || supplierChanged) clearEstimateResult();
    else setCopyOk(false);

    setSupplierId(applied.supplierId);
    setDniZapasu(String(applied.dniZapasu));
    if (shouldApplyStockSalesWindow(salesWindowSource)) {
      setDataOd(applied.dataOd);
      setDataDo(applied.dataDo);
    }
  };

  const onDniZapasuChange = (raw: string) => {
    setDniZapasu(raw);
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 1) return;
    // Świadoma zmiana zapasu → wróć do okna ze stocku (nadpisuje ręczne daty).
    setSalesWindowSource("stock");
    const end = dataDo || bootstrap.salesEndKey;
    setDataOd(salesWindowFromDniZapasu(n, end).dataOd);
  };

  const onSupplierOverride = (id: string) => {
    if (!id) {
      setSupplierId(null);
      clearEstimateResult();
      return;
    }
    const prev = supplierId;
    const s = bootstrap.suppliers.find((x) => x.id === id);
    setSupplierId(id);
    if (prev !== id) {
      // Inna historia kh — nie trzymaj cut poprzedniego dostawcy na liście.
      clearEstimateResult();
    }
    if (!s?.dniZapasu) return;
    setDniZapasu(String(s.dniZapasu));
    if (shouldApplyStockSalesWindow(salesWindowSource)) {
      setDataOd(
        salesWindowFromDniZapasu(
          s.dniZapasu,
          dataDo || bootstrap.salesEndKey
        ).dataOd
      );
    }
  };

  const restoreSalesWindowFromStock = () => {
    const n = Math.round(Number(dniZapasu));
    const days =
      Number.isFinite(n) && n >= 1 ? n : DEFAULT_DNI_ZAPASU;
    const end = bootstrap.salesEndKey;
    const window = salesWindowFromDniZapasu(days, end);
    setSalesWindowSource("stock");
    setDataOd(window.dataOd);
    setDataDo(window.dataDo);
  };

  const searchGroups = () => {
    setFeedback(null);
    setErrorMessage(null);
    startSearch(async () => {
      const res = await actionSearchZdEstimateGroups(groupQuery);
      if (!res.ok) {
        setGroupHits([]);
        setFeedback(res.feedback ?? null);
        setErrorMessage(res.message);
        return;
      }
      setGroupHits(res.groups);
      if (res.groups.length === 1) {
        selectGroup(res.groups[0]!);
        return;
      }
      if (res.groups.length === 0) {
        setErrorMessage("Brak grup dla tej frazy.");
      }
    });
  };

  const searchCechy = () => {
    setFeedback(null);
    setErrorMessage(null);
    startSearch(async () => {
      const res = await actionSearchZdEstimateCechy(cechaQuery);
      if (!res.ok) {
        setCechaHits([]);
        setFeedback(res.feedback ?? null);
        setErrorMessage(res.message);
        return;
      }
      setCechaHits(res.cechy);
      if (res.cechy.length === 1) {
        selectCecha(res.cechy[0]!);
        return;
      }
      if (res.cechy.length === 0) {
        setErrorMessage("Brak cech dla tej frazy.");
      }
    });
  };

  const runEstimate = (opts?: {
    fromLaunch?: boolean;
    mode?: ZdEstimateRunMode;
    grupaId?: number;
    cechaId?: number;
  }) => {
    setFeedback(null);
    setErrorMessage(null);
    setCopyOk(false);
    setLaunchReadyMessage(null);
    const mode = opts?.mode ?? scopeMode;
    const grupaId =
      opts?.grupaId ??
      (mode === "grupa" ? selectedGroup?.grt_Id : undefined);
    const cechaId =
      opts?.cechaId ??
      (mode === "cecha" ? selectedCecha?.ctw_Id : undefined);
    if (mode === "grupa" && !grupaId) {
      setErrorMessage("Wybierz grupę (np. Falcon).");
      if (opts?.fromLaunch) setLaunchBlocking(false);
      return;
    }
    if (mode === "cecha" && !cechaId) {
      setErrorMessage("Wybierz cechę (np. Ivoclar).");
      if (opts?.fromLaunch) setLaunchBlocking(false);
      return;
    }
    if (!settingsTrusted) {
      const msg = settingsTrustFailMessage({
        exclusionsError,
        packagingError,
        productPairsError,
        productBomsError,
        teethProductsError,
      });
      setErrorMessage(msg);
      if (opts?.fromLaunch) setLaunchBlocking(false);
      return;
    }
    const launchStartedCapture = opts?.fromLaunch
      ? launchBlocking && launchStartedAtMs != null
        ? launchStartedAtMs
        : beginLaunchProgress()
      : null;
    if (opts?.fromLaunch) {
      setLaunchForceComplete(false);
    }
    const estimateGen = ++estimateGenRef.current;
    startEstimate(async () => {
      const res = await actionRunZdEstimateManual({
        mode,
        ...(mode === "grupa" ? { grupaId } : { cechaId }),
        supplierId: supplierId ?? null,
        dniZapasu: Number(dniZapasu),
        dataOd,
        dataDo,
        zapasMin: Number(zapasMin) || 0,
      });
      if (estimateGen !== estimateGenRef.current) return;
      if (!res.ok) {
        setLines(null);
        setLinesBase(null);
        setHistoryByTwId(new Map());
        setParamInfo(null);
        setMeta(null);
        setSelected({});
        setPairPartnerMissingCount(0);
        setPrepCollapsed(false);
        setLaunchForceComplete(false);
        if (opts?.fromLaunch) setLaunchBlocking(false);
        if (
          opts?.fromLaunch &&
          isZdEstimateLaunchTimeoutFeedback({
            code: res.feedback?.code,
            message: res.message,
            title: res.feedback?.title,
          })
        ) {
          setFeedback({
            code: "timeout",
            title: ZD_ESTIMATE_LAUNCH_TIMEOUT_FEEDBACK.title,
            message: ZD_ESTIMATE_LAUNCH_TIMEOUT_FEEDBACK.message,
            hint: ZD_ESTIMATE_LAUNCH_TIMEOUT_FEEDBACK.hint,
            tone: "warning",
          });
          setErrorMessage(ZD_ESTIMATE_LAUNCH_TIMEOUT_FEEDBACK.message);
        } else {
          setFeedback(res.feedback ?? null);
          setErrorMessage(res.message);
        }
        return;
      }

      const applySuccessUi = () => {
        setLinesBase(res.result.pozycjeBase ?? res.result.pozycje);
        setLines(res.result.pozycje);
        const histMap = new Map<
          number,
          { lastOrderedQty: number; linkedAt: string }
        >();
        for (const e of res.historyByTwId ?? []) {
          if (e.twId > 0) {
            histMap.set(e.twId, {
              lastOrderedQty: e.lastOrderedQty,
              linkedAt: e.linkedAt,
            });
          }
        }
        setHistoryByTwId(histMap);
        if (res.pendingIndividuals != null) {
          pendingFetchGenRef.current += 1;
          setPendingIndividuals(res.pendingIndividuals);
          setPendingIndividualsError(null);
          setPendingIndividualsTruncated(
            Boolean(res.pendingIndividualsTruncated)
          );
        } else {
          setPendingIndividualsError(
            res.pendingIndividualsError?.trim() ||
              "Nie odświeżono próśb przy Policz — zostawiam poprzednią listę."
          );
        }
        setCreateDoneDokId(null);
        setCreateDoneDokNr(null);
        setCreateZdOkMessage(null);
        setSelected({});
        setParamInfo(res.result.parametry as Record<string, unknown>);
        setMeta({
          pagesFetched: res.meta.pagesFetched,
          totalCountApi: res.meta.totalCountApi,
          truncated: res.meta.truncated,
          ordersBaseUrl: res.meta.ordersBaseUrl,
          durationMs: res.meta.durationMs,
          totalFromSubiekt: res.meta.totalFromSubiekt,
        });
        setListFilter("order");
        setProductPairs(res.productPairs ?? []);
        setProductPairsError(null);
        setProductBoms(res.productBoms ?? []);
        setProductBomsError(null);
        setTeethTwIds(res.teethTwIds ?? []);
        setTeethProductsError(null);
        setPairPartnerMissingCount(res.meta.pairPartnerMissingCount ?? 0);
        setBomMissingCount(res.meta.bomMissingCount ?? 0);
        setFeedback(null);
        setErrorMessage(null);
        setLinkOkMessage(null);
        if (opts?.fromLaunch) {
          setPrepCollapsed(true);
          const readyBits = [
            `${res.meta.doZamowieniaCount} pozycji do ZD`,
            res.pendingIndividuals != null && res.pendingIndividuals.length > 0
              ? `${res.pendingIndividuals.length} próśb`
              : null,
          ].filter(Boolean);
          setLaunchReadyMessage(`Gotowe — ${readyBits.join(" · ")}`);
          setLaunchForceComplete(false);
          setLaunchBlocking(false);
        }
      };

      if (opts?.fromLaunch) {
        setLaunchForceComplete(true);
        const waitMs = launchProgressMinRevealWaitMs(
          launchStartedCapture ?? launchStartedAtMs
        );
        if (launchRevealTimerRef.current) {
          clearTimeout(launchRevealTimerRef.current);
        }
        launchRevealTimerRef.current = setTimeout(() => {
          launchRevealTimerRef.current = null;
          if (estimateGen !== estimateGenRef.current) return;
          applySuccessUi();
        }, waitMs);
      } else {
        applySuccessUi();
      }

      const genExBefore = exclusionsGenRef.current;
      const genPackBefore = packagingGenRef.current;
      const genPairsBefore = pairsGenRef.current;
      const [freshEx, freshPack, freshPairs, freshBoms] = await Promise.all([
        actionListZdEstimateExclusions(),
        actionListZdEstimatePackaging(),
        actionListZdProductPairs(),
        actionListZdProductBoms(),
      ]);
      if (estimateGen !== estimateGenRef.current) return;
      if (genExBefore === exclusionsGenRef.current) {
        if (freshEx.ok) {
          setExclusions(freshEx.exclusions);
          setExclusionsError(null);
        } else {
          setExclusions(res.exclusions);
          setExclusionsError(null);
          reportError(
            `Odświeżenie wykluczeń nie powiodło się (${freshEx.message}). Użyto listy z momentu szacunku.`
          );
        }
      }
      if (genPackBefore === packagingGenRef.current) {
        if (freshPack.ok) {
          setPackaging(freshPack.packaging);
          setPackagingError(null);
        } else {
          setPackaging(res.packaging);
          setPackagingError(null);
          reportError(
            `Odświeżenie opakowań nie powiodło się (${freshPack.message}). Użyto listy z momentu szacunku.`
          );
        }
      }
      if (genPairsBefore === pairsGenRef.current) {
        if (freshPairs.ok) {
          setProductPairs(freshPairs.pairs);
          setProductPairsError(null);
        } else {
          setProductPairs(res.productPairs ?? []);
          setProductPairsError(null);
          reportError(
            `Odświeżenie par nie powiodło się (${freshPairs.message}). Użyto listy z momentu szacunku.`
          );
        }
      }
      if (freshBoms.ok) {
        setProductBoms(freshBoms.boms);
        setProductBomsError(null);
      } else {
        setProductBoms(res.productBoms ?? []);
        setProductBomsError(null);
        reportError(ZD_BOM_UI.refreshFailed(freshBoms.message));
      }
    });
  };

  useEffect(() => {
    runEstimateRef.current = runEstimate;
  });

  // Prośby przy supplierId (także needsAssign — bez czekania na Policz).
  useEffect(() => {
    const id = supplierId?.trim();
    if (!id) {
      queueMicrotask(() => {
        setPendingIndividuals([]);
        setPendingIndividualsError(null);
        setPendingIndividualsTruncated(false);
        setPendingIndividualsLoading(false);
      });
      return;
    }
    // Natychmiast czyść listę przy zmianie dostawcy — unikaj merge z poprzednim.
    const gen = ++pendingFetchGenRef.current;
    queueMicrotask(() => {
      if (gen !== pendingFetchGenRef.current) return;
      setPendingIndividuals([]);
      setPendingIndividualsTruncated(false);
      setPendingIndividualsError(null);
      setPendingIndividualsLoading(true);
    });
    void (async () => {
      const res = await actionFetchZdEstimatePendingIndividuals(id);
      if (gen !== pendingFetchGenRef.current) return;
      setPendingIndividualsLoading(false);
      if (res.ok) {
        setPendingIndividuals(res.orders);
        setPendingIndividualsError(null);
        setPendingIndividualsTruncated(res.truncated);
      } else {
        // Nie trzymaj próśb poprzedniego dostawcy przy błędzie fetchu.
        setPendingIndividuals([]);
        setPendingIndividualsTruncated(false);
        setPendingIndividualsError(res.message);
      }
    })();
  }, [supplierId]);

  // Prefill z launch jest w initial state — tu tylko autorun.
  // settingsTrusted: przy launch false = twardy fail (bootstrap errors nie „naprawią się” same).
  useEffect(() => {
    if (!launch?.autorun || launch.needsAssign) return;
    if (launchedRef.current) return;
    // Page wyłącza autorun gdy !configured — nic do zrobienia.
    if (!bootstrap.configured) return;

    const failLaunch = (message: string) => {
      launchedRef.current = true;
      markZdEstimateLaunchAutorunDone(launch.launchKey);
      queueMicrotask(() => {
        setLaunchBlocking(false);
        setErrorMessage(message);
      });
    };

    if (!launchHasRunnableScope(launch)) {
      failLaunch("Brak zakresu Subiekta do automatycznego szacunku.");
      return;
    }

    const prior = claimZdEstimateLaunchAutorun(launch.launchKey);
    if (prior === "already_done") {
      launchedRef.current = true;
      queueMicrotask(() => setLaunchBlocking(false));
      return;
    }

    if (!settingsTrusted) {
      failLaunch(
        settingsTrustFailMessage({
          exclusionsError,
          packagingError,
          productPairsError,
          productBomsError,
          teethProductsError,
        })
      );
      return;
    }

    launchedRef.current = true;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("autorun")) {
        url.searchParams.delete("autorun");
        const qs = url.searchParams.toString();
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`
        );
      }
    }

    const mode = launch.mode!;
    const grupaId = launch.grupaId ?? undefined;
    const cechaId = launch.cechaId ?? undefined;
    const launchKey = launch.launchKey;
    let cancelled = false;

    // Odłóż poza sync effect — unikamy cascaded setState w body effect.
    queueMicrotask(() => {
      if (cancelled) return;
      markZdEstimateLaunchAutorunDone(launchKey);
      runEstimate({
        fromLaunch: true,
        mode,
        grupaId,
        cechaId,
      });
    });

    return () => {
      cancelled = true;
      // Strict Mode: zwolnij tylko „pending”, żeby remount mógł odpalić raz.
      releaseZdEstimateLaunchAutorunPending(launchKey);
      if (!isZdEstimateLaunchAutorunDone(launchKey)) {
        launchedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch, bootstrap.configured, settingsTrusted]);

  useEffect(() => {
    return () => {
      if (launchRevealTimerRef.current) {
        clearTimeout(launchRevealTimerRef.current);
        launchRevealTimerRef.current = null;
      }
    };
  }, []);

  /** Jeden spokojny panel — bez overlay na całym formularzu. */
  const showLaunchProgress = Boolean(
    launchBlocking ||
      (estimating &&
        (launch?.autorun || launch?.fromDaily) &&
        !lines &&
        !launchReadyMessage)
  );

  const showLaunchStickyActions = Boolean(
    lines &&
      launchReadyMessage &&
      (launch?.fromDaily || orderableLines.length > 0 || individualBundle.serviceLines.length > 0)
  );

  const createZdGateCaption = !createZdGate.ok
    ? individualBundle.serviceLines.length > 0 &&
      orderableLines.length === 0
      ? `${createZdGate.reason} Masz ${individualBundle.serviceLines.length} usług z próśb — potrzebna ≥1 pozycja katalogowa.`
      : createZdGate.reason
    : null;

  const reloadPendingIndividuals = () => {
    const id = supplierId?.trim();
    if (!id) return;
    const gen = ++pendingFetchGenRef.current;
    setPendingIndividualsLoading(true);
    setPendingIndividualsError(null);
    void (async () => {
      const res = await actionFetchZdEstimatePendingIndividuals(id);
      if (gen !== pendingFetchGenRef.current) return;
      setPendingIndividualsLoading(false);
      if (res.ok) {
        setPendingIndividuals(res.orders);
        setPendingIndividualsError(null);
        setPendingIndividualsTruncated(res.truncated);
      } else {
        setPendingIndividuals([]);
        setPendingIndividualsTruncated(false);
        setPendingIndividualsError(res.message);
      }
    })();
  };

  const launchScopeLabel =
    launch?.label?.trim() ||
    (scopeMode === "cecha"
      ? selectedCecha?.ctw_Nazwa
      : selectedGroup?.grt_Nazwa) ||
    null;
  const launchScopeMode: "grupa" | "cecha" | null =
    launch?.mode ??
    (selectedCecha ? "cecha" : selectedGroup ? "grupa" : scopeMode);

  // Scroll: start progress / assign — celuj w scroll parent (appMain), nie window.
  useEffect(() => {
    if (showLaunchProgress) {
      return scrollZdEstimateWhenReady(ZD_ESTIMATE_LAUNCH_FOCUS_ID, {
        initialDelayMs: 80,
        block: "start",
        offsetPx: 16,
        maxAttempts: 16,
      });
    }
    if (assignHint && launch?.fromDaily) {
      return scrollZdEstimateWhenReady(ZD_ESTIMATE_ASSIGN_FOCUS_ID, {
        initialDelayMs: 80,
        block: "start",
        offsetPx: 16,
        maxAttempts: 16,
      });
    }
    return;
  }, [showLaunchProgress, assignHint, launch?.fromDaily]);

  // Scroll: sukces → alert
  useEffect(() => {
    if (!launchReadyMessage) return;
    return scrollZdEstimateWhenReady(ZD_ESTIMATE_READY_FOCUS_ID, {
      initialDelayMs: 100,
      block: "start",
      offsetPx: 16,
      maxAttempts: 16,
    });
  }, [launchReadyMessage]);

  // Scroll: błąd po launch (nie podczas postępu)
  useEffect(() => {
    if (!errorMessage || showLaunchProgress) return;
    if (!(launch?.fromDaily || launch?.autorun)) return;
    return scrollZdEstimateWhenReady(ZD_ESTIMATE_ERROR_FOCUS_ID, {
      initialDelayMs: 80,
      block: "center",
      maxAttempts: 16,
    });
  }, [errorMessage, showLaunchProgress, launch?.fromDaily, launch?.autorun]);

  const confirmAssignAndRun = () => {
    if (!launch?.supplierId) {
      setErrorMessage("Brak dostawcy z panelu — wybierz zakres i kliknij Policz.");
      return;
    }
    if (scopeMode === "grupa" && !selectedGroup?.grt_Id) {
      setErrorMessage("Wybierz grupę, żeby zapisać mapowanie.");
      return;
    }
    if (scopeMode === "cecha" && !selectedCecha?.ctw_Id) {
      setErrorMessage("Wybierz cechę, żeby zapisać mapowanie.");
      return;
    }
    startMutate(async () => {
      const res = await actionUpsertZdEstimateSupplierScope({
        supplierId: launch.supplierId!,
        mode: scopeMode,
        ...(scopeMode === "grupa"
          ? {
              grupaId: selectedGroup!.grt_Id,
              label: selectedGroup!.grt_Nazwa,
            }
          : {
              cechaId: selectedCecha!.ctw_Id,
              label: selectedCecha!.ctw_Nazwa,
            }),
      });
      if (!res.ok) {
        setErrorMessage(res.message);
        return;
      }
      setAssignHint(null);
      runEstimate({ fromLaunch: true });
    });
  };

  const visibleLines = useMemo(() => {
    if (!lines) return [];
    let filtered: ManualZdEstimateLine[];
    if (!settingsTrusted) {
      // „Do ZD” wymaga DB + opakowań. Auto z nazwy można pokazać od razu.
      if (listFilter === "order") return [];
      if (listFilter === "excluded") {
        filtered = lines.filter((l) => nameAutoByTwId.has(l.tw_Id));
      } else {
        filtered = lines;
      }
    } else if (listFilter === "excluded") {
      filtered = lines.filter((l) => excludedIds.has(l.tw_Id));
    } else if (listFilter === "all") {
      filtered = lines;
    } else {
      filtered = filterOrderableLinesWithPackaging(
        lines,
        packagingLookup,
        excludedIds,
        individualExtraByTwId
      );
    }
    return sortZdEstimateLines(
      filtered,
      sortKey,
      sortDir,
      packagingLookup,
      individualExtraByTwId
    );
  }, [
    lines,
    listFilter,
    excludedIds,
    packagingLookup,
    settingsTrusted,
    nameAutoByTwId,
    sortKey,
    sortDir,
    individualExtraByTwId,
  ]);

  const handleSort = useCallback(
    (field: ZdEstimateListSortKey) => {
      if (field === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(field);
        setSortDir(defaultDirForZdEstimateSortKey(field));
      }
    },
    [sortKey]
  );

  const selectedLines = useMemo(() => {
    if (!lines) return [];
    return lines.filter((l) => selected[l.tw_Id]);
  }, [lines, selected]);

  const selectedCount = selectedLines.length;

  const visibleSelectedCount = useMemo(
    () => visibleLines.filter((l) => selected[l.tw_Id]).length,
    [visibleLines, selected]
  );
  const allVisibleSelected =
    visibleLines.length > 0 && visibleSelectedCount === visibleLines.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected;

  const excludeEligibleLines = useMemo(
    () =>
      selectedLines.filter((l) => {
        if (nameAutoByTwId.has(l.tw_Id)) return false;
        if (exclusionsTrusted && dbExcludedIds.has(l.tw_Id)) return false;
        return true;
      }),
    [selectedLines, exclusionsTrusted, dbExcludedIds, nameAutoByTwId]
  );
  const restoreEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => exclusionsTrusted && dbExcludedIds.has(l.tw_Id)
      ),
    [selectedLines, exclusionsTrusted, dbExcludedIds]
  );
  const packagingClearEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => packagingTrusted && packagingMap.has(l.tw_Id)
      ),
    [selectedLines, packagingTrusted, packagingMap]
  );

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const toggleRowSelected = (twId: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[twId]) delete next[twId];
      else next[twId] = true;
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of visibleLines) next[row.tw_Id] = true;
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = { ...prev };
        for (const row of visibleLines) delete next[row.tw_Id];
        return next;
      });
      return;
    }
    selectAllVisible();
  };

  const toBulkProducts = (rows: ManualZdEstimateLine[]) =>
    rows.map((l) => ({
      subiektTwId: l.tw_Id,
      twSymbol: l.tw_Symbol,
      twNazwa: l.tw_Nazwa,
      grtId: selectedGroup?.grt_Id ?? l.tw_IdGrupa,
      grtNazwa: selectedGroup?.grt_Nazwa ?? l.grt_Nazwa,
    }));

  const reportBulkPartial = (
    succeeded: number,
    failed: Array<{ twSymbol?: string | null; error: string }>,
    truncated: boolean,
    noun: string
  ) => {
    const parts: string[] = [];
    if (succeeded > 0) parts.push(`Zapisano ${succeeded} ${noun}.`);
    if (failed.length) {
      const sample = failed
        .slice(0, 3)
        .map((f) => f.twSymbol ?? f.error)
        .join(", ");
      parts.push(
        `Nie udało się: ${failed.length}${sample ? ` (${sample})` : ""}.`
      );
    }
    if (truncated) {
      parts.push(
        `Limit ${ZD_ESTIMATE_BULK_MAX} na jedną akcję — pozostałe zaznaczenie zostawione; uruchom ponownie dla reszty.`
      );
    }
    if (failed.length || truncated) {
      reportError(parts.join(" "));
    }
  };

  const confirmBulkExclude = (note: string) => {
    const products = toBulkProducts(excludeEligibleLines);
    if (!products.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionExcludeZdEstimateProducts({
        products,
        note: note || undefined,
      });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyExclusionsLive(res.exclusions);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "wykluczeń"
      );
      setBulkExcludeOpen(false);
    });
  };

  const confirmBulkRestore = () => {
    const ids = restoreEligibleLines.map((l) => l.tw_Id);
    if (!ids.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionRestoreZdEstimateProducts(ids);
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyExclusionsLive(res.exclusions);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "przywróceń"
      );
      setBulkRestoreOpen(false);
    });
  };

  const confirmBulkPackaging = (input: {
    unitsPerPackage: number;
    packageLabel: string;
    note: string;
  }) => {
    const products = toBulkProducts(selectedLines);
    if (!products.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionUpsertZdEstimatePackagingBulk({
        products,
        unitsPerPackage: input.unitsPerPackage,
        packageLabel: input.packageLabel,
        note: input.note.trim() || undefined,
      });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyPackagingLive(res.packaging);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "opakowań"
      );
      setBulkPackagingOpen(false);
    });
  };

  const confirmBulkClearPackaging = () => {
    const ids = packagingClearEligibleLines.map((l) => l.tw_Id);
    if (!ids.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionDeleteZdEstimatePackagingBulk(ids);
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyPackagingLive(res.packaging);
      clearSucceededFromSelection(res.succeededTwIds);
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "usunięć opakowań"
      );
      setBulkPackagingOpen(false);
    });
  };

  const confirmExclude = (note: string) => {
    const line = excludeCandidate;
    if (!line) return;
    setErrorMessage(null);
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionExcludeZdEstimateProduct({
          subiektTwId: line.tw_Id,
          twSymbol: line.tw_Symbol,
          twNazwa: line.tw_Nazwa,
          grtId: selectedGroup?.grt_Id ?? line.tw_IdGrupa,
          grtNazwa: selectedGroup?.grt_Nazwa ?? line.grt_Nazwa,
          note: note || undefined,
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyExclusionsLive(res.exclusions);
        setExcludeCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const restoreLine = (twId: number) => {
    setErrorMessage(null);
    setMutatingTwId(twId);
    startMutate(async () => {
      try {
        const res = await actionRestoreZdEstimateProduct(twId);
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyExclusionsLive(res.exclusions);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const retryLoadExclusions = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimateExclusions();
      if (!res.ok) {
        setExclusionsError(res.message);
        reportError(res.message);
        return;
      }
      applyExclusionsLive(res.exclusions);
    });
  };

  const retryLoadPackaging = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimatePackaging();
      if (!res.ok) {
        setPackagingError(res.message);
        reportError(res.message);
        return;
      }
      applyPackagingLive(res.packaging);
    });
  };

  const retryLoadPairs = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdProductPairs();
      if (!res.ok) {
        setProductPairsError(res.message);
        reportError(res.message);
        return;
      }
      pairsGenRef.current += 1;
      setProductPairs(res.pairs);
      setProductPairsError(null);
      if (linesBase?.length) {
        reapplyPairsToLines(res.pairs);
      }
    });
  };

  const retryLoadBoms = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdProductBoms();
      if (!res.ok) {
        setProductBomsError(res.message);
        reportError(res.message);
        return;
      }
      setProductBoms(res.boms);
      setProductBomsError(null);
      if (linesBase?.length) {
        reapplyPairsToLines(productPairs, res.boms);
      }
    });
  };

  const retryLoadTeeth = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimateTeethTwIds();
      if (!res.ok) {
        setTeethProductsError(res.message);
        reportError(res.message);
        return;
      }
      setTeethTwIds(res.teethTwIds);
      setTeethProductsError(null);
    });
  };

  const openExclusionsPanel = () => {
    setExclusionsOpen(true);
    retryLoadExclusions();
  };

  const openPackagingPanel = () => {
    setPackagingOpen(true);
    retryLoadPackaging();
  };

  const openPairsPanel = () => {
    setPairSeed(null);
    setPairsOpen(true);
    retryLoadPairs();
  };

  const openBomsPanel = () => {
    setBomSeed(null);
    setBomsOpen(true);
    retryLoadBoms();
  };

  const openPairFromSelection = () => {
    if (selectedLines.length !== 2) {
      reportError("Zaznacz dokładnie 2 towary, żeby utworzyć parę.");
      return;
    }
    const [a, b] = selectedLines;
    setPairSeed([
      { twId: a.tw_Id, symbol: a.tw_Symbol, nazwa: a.tw_Nazwa },
      { twId: b.tw_Id, symbol: b.tw_Symbol, nazwa: b.tw_Nazwa },
    ]);
    setPairsOpen(true);
    retryLoadPairs();
  };

  const openBomFromSelection = () => {
    if (selectedLines.length < 2) {
      reportError(ZD_BOM_UI.selectNeedTwo);
      return;
    }
    setBomSeed(
      selectedLines.map((l) => ({
        twId: l.tw_Id,
        symbol: l.tw_Symbol,
        nazwa: l.tw_Nazwa,
      }))
    );
    setBomsOpen(true);
    retryLoadBoms();
  };

  const savePackaging = (input: {
    unitsPerPackage: number;
    packageLabel: string;
    note: string;
  }) => {
    const line = packagingCandidate;
    if (!line) return;
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionUpsertZdEstimatePackaging({
          subiektTwId: line.tw_Id,
          twSymbol: line.tw_Symbol,
          twNazwa: line.tw_Nazwa,
          grtId: selectedGroup?.grt_Id ?? line.tw_IdGrupa,
          grtNazwa: selectedGroup?.grt_Nazwa ?? line.grt_Nazwa,
          unitsPerPackage: input.unitsPerPackage,
          packageLabel: input.packageLabel,
          note: input.note,
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyPackagingLive(res.packaging);
        setPackagingCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const clearPackaging = () => {
    const line = packagingCandidate;
    if (!line) return;
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionDeleteZdEstimatePackaging(line.tw_Id);
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyPackagingLive(res.packaging);
        setPackagingCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const copyTsv = async () => {
    if (!settingsTrusted) {
      reportError(
        "Nie można kopiować TSV bez wczytanych wykluczeń i opakowań."
      );
      return;
    }
    if (!orderableLines.length) return;
    try {
      await navigator.clipboard.writeText(
        orderableLinesToTsv(orderableLines, packagingLookup, individualExtraByTwId)
      );
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      reportError("Nie udało się skopiować do schowka.");
    }
  };

  return (
    <div className="relative space-y-5 sm:space-y-6">
      {showLaunchProgress && launchStartedAtMs != null ? (
        <ZdEstimateLaunchProgressPanel
          key={launchStartedAtMs}
          supplierName={launch?.supplierName ?? selectedSupplier?.name}
          scopeLabel={launchScopeLabel}
          scopeMode={launchScopeMode}
          startedAtMs={launchStartedAtMs}
          scopeAlreadyResolved={launchHasRunnableScope(launch)}
          forceComplete={launchForceComplete}
          ordersIsLive={bootstrap.ordersIsLive}
        />
      ) : null}

      {/* Podczas przygotowania z panelu — tylko checklista, bez szumu formularza. */}
      {!showLaunchProgress ? (
        <>
      {/* Status środowiska — kompaktowy, bez hałasu */}
      {/* Jedyna belka środowiska — bez powtórzeń w hintach kart / page header. */}
      {bootstrap.configured ? (
        <div
          className={
            bootstrap.ordersIsLive
              ? "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
              : "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950"
          }
        >
          <Badge variant={bootstrap.ordersIsLive ? "warning" : "success"}>
            {zdEstimateHostBadgeLabel({
              isLive: bootstrap.ordersIsLive,
              port: bootstrap.ordersPort ?? bootstrap.testPort,
            })}
          </Badge>
          <span
            className={
              bootstrap.ordersIsLive
                ? "min-w-0 text-amber-950/90"
                : "min-w-0 text-emerald-900/85"
            }
          >
            {zdEstimateHostStripDetail({
              isLive: bootstrap.ordersIsLive,
              salesEndFromFs: bootstrap.salesEndFromFs,
              salesEndKeyFormatted: bootstrap.salesEndFromFs
                ? formatPlDate(bootstrap.salesEndKey)
                : null,
            })}
          </span>
        </div>
      ) : (
        <Alert tone="error" title="Szacunek zablokowany">
          {zdEstimateBlockedOrdersAlertBody(bootstrap.ordersMessage)}
        </Alert>
      )}

      {launchReadyMessage ? (
        <div id={ZD_ESTIMATE_READY_FOCUS_ID} className="scroll-mt-4">
          <Alert tone="success" title="Zamówienie gotowe">
            {launchReadyMessage}.{" "}
            {zdEstimateReadyFollowUp(bootstrap.ordersIsLive)}
          </Alert>
        </div>
      ) : null}

      {createZdOkMessage ? (
        <Alert tone="success" title="ZD utworzone">
          {createZdOkMessage}
        </Alert>
      ) : null}

      {pendingIndividualsError ? (
        <Alert tone="error" title="Nie wczytano próśb">
          <span className="block">{pendingIndividualsError}</span>
          <span className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!supplierId || pendingIndividualsLoading}
              onClick={reloadPendingIndividuals}
            >
              {pendingIndividualsLoading ? "Wczytuję…" : "Wczytaj ponownie"}
            </Button>
          </span>
        </Alert>
      ) : null}

      {pendingIndividualsTruncated ? (
        <Alert tone="warning" title="Limit 500 próśb">
          Wczytano pierwsze 500 próśb Nowe — możliwe, że część nie weszła do
          szacunku. Odznacz zbędne w panelu Dziś.
        </Alert>
      ) : null}

      {createDoneDokNr && lines && lines.length > 0 ? (
        <Alert tone="warning" title="Create zablokowany">
          Z tej listy utworzono już {createDoneDokNr}. Przelicz szacunek albo
          użyj „Powiąż ZD” dla innego dokumentu.
        </Alert>
      ) : null}

      {assignHint ? (
        <div id={ZD_ESTIMATE_ASSIGN_FOCUS_ID} className="scroll-mt-4">
          <Alert tone="warning" title="Przypisz zakres Subiekta">
            {assignHint}
            {launch?.supplierName ? (
              <span className="mt-1 block text-sm">
                Dostawca: <strong>{launch.supplierName}</strong>
              </span>
            ) : null}
            {pendingIndividualsLoading ? (
              <span className="mt-1 block text-sm text-slate-600">
                Wczytuję prośby handlowców…
              </span>
            ) : pendingIndividuals.length > 0 ? (
              <span className="mt-1 block text-sm">
                Wczytano {pendingIndividuals.length}{" "}
                {pendingIndividuals.length === 1 ? "prośbę" : "próśb"} — wejdą
                do szacunku po Policz.
              </span>
            ) : pendingIndividualsError ? (
              <span className="mt-1 block text-sm text-amber-900">
                Prośby nie wczytane — użyj „Wczytaj ponownie” powyżej.
              </span>
            ) : null}
            <span className="mt-2 block text-sm">
              Wybierz grupę lub cechę poniżej, potem „Zapisz zakres i policz”.
            </span>
          </Alert>
        </div>
      ) : null}

      {launch?.fromDaily &&
      !bootstrap.configured &&
      !assignHint &&
      !launchReadyMessage ? (
        <Alert tone="error" title="Nie przygotuję ZD">
          {zdEstimateBlockedDailyCtaMessage()}
        </Alert>
      ) : null}
        </>
      ) : null}

      {!showLaunchProgress ? (
      <Card padding={false} className="relative overflow-visible">
        <CardHeader
          inset
          density="default"
          title="Przygotowanie listy"
          description={
            prepCollapsed
              ? "Zakres ustawiony — lista poniżej. Rozwiń, żeby zmienić grupę/cechę."
              : "Wybierz grupę lub cechę Subiekta. Zapas i okno sprzedaży ustawią się same. Potem „Policz listę” i ewentualnie „Utwórz ZD”."
          }
          hint={zdEstimatePrepCardHint()}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconPackage size={18} strokeWidth={1.75} />
            </SectionHeadingIcon>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {prepCollapsed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setPrepCollapsed(false)}
                >
                  Zmień zakres
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openExclusionsPanel}
              >
                Wykluczenia
                {exclusions.length > 0 ? ` (${exclusions.length})` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openPackagingPanel}
              >
                Opakowania
                {packaging.length > 0 ? ` (${packaging.length})` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openPairsPanel}
              >
                Pary
                {productPairs.length > 0 ? ` (${productPairs.length})` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openBomsPanel}
              >
                {ZD_BOM_UI.panelTitle}
                {productBoms.length > 0 ? ` (${productBoms.length})` : ""}
              </Button>
            </div>
          }
        />

        <div
          className={cn(
            estimateSectionInsetClass,
            "space-y-6",
            prepCollapsed && "hidden"
          )}
        >          <section className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={panelTypography.sectionLabel}>Zakres szacunku</p>
              <SegmentedControl
                ariaLabel="Tryb zakresu szacunku"
                value={scopeMode}
                onChange={changeScopeMode}
                options={[
                  { value: "grupa", label: "Grupa" },
                  { value: "cecha", label: "Cecha" },
                ]}
              />
            </div>

            {scopeMode === "grupa" ? (
              <>
                <div className="flex flex-wrap gap-2.5">
                  {bootstrap.quickGroups.map((g) => {
                    const active = selectedGroup?.grt_Id === g.grt_Id;
                    return (
                      <button
                        key={g.grt_Id}
                        type="button"
                        disabled={!bootstrap.configured}
                        onClick={() => selectGroup(g)}
                        title={
                          g.dniZapasu != null
                            ? `${g.supplierName ?? "dostawca"} · zapas ${g.stockLabel} (${g.dniZapasu} d)`
                            : "Brak zapasu na karcie — 30 dni"
                        }
                        className={cn(
                          "inline-flex min-h-11 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left text-sm transition",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5"
                            : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className="font-medium">{g.grt_Nazwa}</span>
                        {g.dniZapasu != null ? (
                          <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                            {g.dniZapasu}d
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch
                      size={16}
                      strokeWidth={1.75}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      value={groupQuery}
                      onChange={(e) => setGroupQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchGroups();
                        }
                      }}
                      placeholder="Szukaj innej grupy…"
                      disabled={!bootstrap.configured}
                      className="h-11 pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={searchGroups}
                    disabled={busy || !bootstrap.configured || !groupQuery.trim()}
                    className="h-11 shrink-0 sm:min-w-[7.5rem]"
                  >
                    {searching ? "Szukam…" : "Szukaj"}
                  </Button>
                </div>

                {groupHits.length > 1 ? (
                  <ul className="max-h-52 overflow-y-auto rounded-lg border border-slate-200/90 bg-white divide-y divide-slate-100 shadow-sm shadow-slate-900/[0.02]">
                    {groupHits.map((g) => (
                      <li key={g.grt_Id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-slate-50",
                            selectedGroup?.grt_Id === g.grt_Id && "bg-indigo-50/70"
                          )}
                          onClick={() => selectGroup(g)}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-900">
                              {g.grt_Nazwa}
                            </span>
                            {g.supplierName ? (
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {g.supplierName}
                                {g.stockLabel ? ` · ${g.stockLabel}` : ""}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">
                            #{g.grt_Id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-slate-600">
                  Cecha może obejmować towary z wielu grup Subiekta. Zapas
                  dopasujemy z nazwy cechy (np. Ivoclar); inaczej wybierz dostawcę
                  w zaawansowanych.
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch
                      size={16}
                      strokeWidth={1.75}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      value={cechaQuery}
                      onChange={(e) => setCechaQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchCechy();
                        }
                      }}
                      placeholder="Szukaj cechy (np. Ivoclar)…"
                      disabled={!bootstrap.configured}
                      className="h-11 pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={searchCechy}
                    disabled={busy || !bootstrap.configured || !cechaQuery.trim()}
                    className="h-11 shrink-0 sm:min-w-[7.5rem]"
                  >
                    {searching ? "Szukam…" : "Szukaj"}
                  </Button>
                </div>

                {cechaHits.length > 1 ? (
                  <ul className="max-h-52 overflow-y-auto rounded-lg border border-slate-200/90 bg-white divide-y divide-slate-100 shadow-sm shadow-slate-900/[0.02]">
                    {cechaHits.map((c) => (
                      <li key={c.ctw_Id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-slate-50",
                            selectedCecha?.ctw_Id === c.ctw_Id && "bg-indigo-50/70"
                          )}
                          onClick={() => selectCecha(c)}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-900">
                              {c.ctw_Nazwa}
                            </span>
                            {c.supplierName ? (
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {c.supplierName}
                                {c.stockLabel ? ` · ${c.stockLabel}` : ""}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">
                            #{c.ctw_Id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </section>

          {scopeMode === "grupa" && selectedGroup ? (
            <section className="space-y-3.5">
              <p className={panelTypography.sectionLabel}>Parametry z wyboru</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetaPill label="Grupa" value={selectedGroup.grt_Nazwa} />
                <MetaPill
                  label="Zapas"
                  value={
                    stockLabel
                      ? `${stockLabel} · ${dniZapasu} dni`
                      : `${dniZapasu} dni`
                  }
                />
                <MetaPill
                  label="Dostawca"
                  value={supplierLabel ?? "Brak karty OnTime"}
                />
                <MetaPill
                  label="Okno sprzedaży"
                  value={`${formatPlDate(dataOd)} – ${formatPlDate(dataDo)}${
                    salesWindowSource === "manual" ? " · ręczne" : ""
                  }`}
                />
              </div>
            </section>
          ) : scopeMode === "cecha" && selectedCecha ? (
            <section className="space-y-3.5">
              <p className={panelTypography.sectionLabel}>Parametry z wyboru</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetaPill label="Cecha" value={selectedCecha.ctw_Nazwa} />
                <MetaPill
                  label="Zapas"
                  value={
                    stockLabel
                      ? `${stockLabel} · ${dniZapasu} dni`
                      : `${dniZapasu} dni`
                  }
                />
                <MetaPill
                  label="Dostawca"
                  value={supplierLabel ?? "Brak karty OnTime"}
                />
                <MetaPill
                  label="Okno sprzedaży"
                  value={`${formatPlDate(dataOd)} – ${formatPlDate(dataDo)}${
                    salesWindowSource === "manual" ? " · ręczne" : ""
                  }`}
                />
              </div>
            </section>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 py-5 text-sm leading-relaxed text-slate-600">
              {scopeMode === "grupa"
                ? "Wybierz grupę (Falcon, Ivoclar…) — zapas i daty ustawią się automatycznie."
                : "Wyszukaj i wybierz cechę — zapas i daty ustawią się z nazwy cechy, jeśli jest karta dostawcy."}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-slate-600 transition hover:text-slate-900"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <IconChevronDown
                size={16}
                strokeWidth={1.75}
                className={cn(
                  "transition-transform",
                  showAdvanced && "rotate-180"
                )}
              />
              {showAdvanced ? "Ukryj zaawansowane" : "Zaawansowane"}
            </button>
            <Button
              type="button"
              onClick={() => runEstimate()}
              disabled={
                estimating ||
                !bootstrap.configured ||
                !scopeSelected ||
                !settingsTrusted
              }
              title={
                !settingsTrusted
                  ? ZD_ESTIMATE_UI.policzNeedsSettingsTitle
                  : !bootstrap.configured
                    ? "Brak połączenia z Subiektem"
                    : !scopeSelected
                      ? "Wybierz grupę lub cechę"
                      : estimating
                        ? "Trwa przeliczanie"
                        : "Policz listę do ZD z Subiekta"
              }
              className="h-11 w-full sm:w-auto sm:min-w-[12.5rem]"
            >
              {estimating ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" /> Liczę…
                </span>
              ) : (
                "Policz listę"
              )}
            </Button>
            {assignHint && launch?.supplierId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={confirmAssignAndRun}
                disabled={
                  mutating ||
                  estimating ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                className="h-11 w-full sm:w-auto"
              >
                {mutating ? "Zapisuję…" : "Zapisz zakres i policz"}
              </Button>
            ) : null}
          </div>

          {showAdvanced ? (
            <div className="space-y-4 rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Dostawca (override)">
                  <Select
                    value={supplierId ?? ""}
                    onChange={(e) => onSupplierOverride(e.target.value)}
                  >
                    <option value="">
                      {scopeMode === "cecha" ? "— z cechy —" : "— z grupy —"}
                    </option>
                    {bootstrap.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.dniZapasu != null
                          ? ` · ${s.stockLabel} (${s.dniZapasu} d)`
                          : s.stockLabel !== "—"
                            ? ` · ${s.stockLabel}`
                            : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dni zapasu">
                  <Input
                    type="number"
                    min={1}
                    max={730}
                    value={dniZapasu}
                    onChange={(e) => onDniZapasuChange(e.target.value)}
                  />
                </Field>
                <Field label="Data od">
                  <Input
                    type="date"
                    value={dataOd}
                    onChange={(e) => {
                      setSalesWindowSource("manual");
                      setDataOd(e.target.value);
                    }}
                  />
                </Field>
                <Field label="Data do">
                  <Input
                    type="date"
                    value={dataDo}
                    onChange={(e) => {
                      const nextDo = e.target.value;
                      setSalesWindowSource("manual");
                      setDataDo(nextDo);
                      setDataOd(
                        nextDataOdAfterDataDoChange({
                          source: "manual",
                          dataDo: nextDo,
                          dataOd,
                          dniZapasu: Number(dniZapasu),
                        })
                      );
                    }}
                  />
                </Field>
              </div>
              {salesWindowSource === "manual" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
                  <span className="font-medium">
                    Okno sprzedaży ręczne — nie nadpisujemy dat z zapasu
                    dostawcy/grupy.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={restoreSalesWindowFromStock}
                  >
                    Przywróć z zapasu
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={ZD_ESTIMATE_UI.advancedZapasMinLabel}>
                  <Input
                    type="number"
                    min={0}
                    value={zapasMin}
                    onChange={(e) => setZapasMin(e.target.value)}
                    title={ZD_ESTIMATE_UI.advancedZapasMinHint}
                  />
                </Field>
              </div>
              {selectedSupplier && selectedSupplier.dniZapasu == null ? (
                <Alert tone="warning" title="Dostawca bez liczbowego zapasu">
                  „{selectedSupplier.name}”: {selectedSupplier.stockLabel}. Ustaw
                  dni zapasu ręcznie.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
      ) : null}

      {!showLaunchProgress ? (
        <>
      {feedback ? <SubiektFeedbackAlert feedback={feedback} /> : null}
      {exclusionsError ? (
        <Alert tone="error" title="Wykluczenia niedostępne">
          {exclusionsError}
          <span className="mt-2 block">
            Bez wczytanej listy nie liczymy bezpiecznej listy do zamówienia ani
            nie kopiujemy TSV.
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadExclusions}
          >
            {mutating ? "Wczytuję…" : "Wczytaj wykluczenia ponownie"}
          </Button>
        </Alert>
      ) : null}
      {packagingError ? (
        <Alert tone="error" title="Opakowania niedostępne">
          {packagingError}
          <span className="mt-2 block">
            Bez opakowań qty w ZD może być w sztukach zamiast paczek (np. Falcon
            10 szt).
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadPackaging}
          >
            {mutating ? "Wczytuję…" : "Wczytaj opakowania ponownie"}
          </Button>
        </Alert>
      ) : null}
      {productPairsError ? (
        <Alert tone="error" title="Pary kompletów niedostępne">
          {productPairsError}
          <span className="mt-2 block">
            Bez mapy par pack i piece mogłyby dostać niezależne qty (podwójne
            zamówienie). Odśwież mapę przed szacunkiem.
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadPairs}
          >
            {mutating ? "Wczytuję…" : "Wczytaj pary ponownie"}
          </Button>
        </Alert>
      ) : null}
      {productBomsError ? (
        <Alert tone="error" title={ZD_BOM_UI.alertUnavailableTitle}>
          {productBomsError}
          <span className="mt-2 block">{ZD_BOM_UI.alertUnavailableBody}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadBoms}
          >
            {mutating ? "Wczytuję…" : ZD_BOM_UI.alertReload}
          </Button>
        </Alert>
      ) : null}
      {teethProductsError ? (
        <Alert tone="error" title="Produkty zębowe niedostępne">
          {teethProductsError}
          <span className="mt-2 block">
            Bez katalogu zębów towary zębowe mogłyby trafić na listę do ZD.
            Wczytaj katalog przed szacunkiem.
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={mutating}
            onClick={retryLoadTeeth}
          >
            {mutating ? "Wczytuję…" : "Wczytaj katalog zębów ponownie"}
          </Button>
        </Alert>
      ) : null}
      {pairPartnerMissingCount > 0 ? (
        <Alert tone="warning" title="Brak partnera pary w szacunku">
          Nie udało się dociągnąć {pairPartnerMissingCount}{" "}
          {pairPartnerMissingCount === 1 ? "towaru" : "towarów"} z pary — linie
          tych paczek mają ilość 0 (bez domyślnego scalenia połowy pary).
        </Alert>
      ) : null}
      {bomMissingCount > 0 ? (
        <Alert tone="warning" title={ZD_BOM_UI.alertMissingTitle}>
          {ZD_BOM_UI.alertMissingBody(bomMissingCount)}
        </Alert>
      ) : null}
      {errorMessage ? (
        <div id={ZD_ESTIMATE_ERROR_FOCUS_ID} className="scroll-mt-4">
          <Alert tone="error" title="Błąd">
            {errorMessage}
          </Alert>
        </div>
      ) : null}
      {linkOkMessage ? (
        <Alert tone="success" title="ZD powiązane">
          {linkOkMessage}
        </Alert>
      ) : null}
      {settingsLiveMessage ? (
        <Alert tone="success" title="Lista na bieżąco">
          {settingsLiveMessage}
        </Alert>
      ) : null}

      {!lines && !estimating && !launchBlocking ? (
        <Card padding={false}>
          <EmptyState
            brandAccent
            icon={<IconClipboardList size={28} strokeWidth={1.75} />}
            title="Brak listy"
            description={zdEstimateEmptyListDescription(bootstrap.ordersIsLive)}
          />
        </Card>
      ) : null}

      {estimating && !lines && !showLaunchProgress ? (
        <Card padding={false}>
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center sm:flex-row sm:items-start sm:text-left">
            <Spinner className="size-6 shrink-0 text-indigo-600" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                Policz listę w toku
              </p>
              <p className="text-sm leading-snug text-slate-600">
                Pobieram pełny zakres z Subiekta
                {bootstrap.ordersIsLive
                  ? " (aktualna baza)"
                  : " (środowisko testowe)"}
                , dociągam partnerów par i składów oraz prośby handlowców. Duża
                cecha może potrwać do kilku minut.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {lines ? (
        <div id={ZD_ESTIMATE_LIST_FOCUS_ID} className="scroll-mt-4">
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="default"
            title="Lista produktów"
            description={
              scopeLabel
                ? `${scopeLabel} · ${bootstrap.ordersHostLabel ?? `Subiekt :${bootstrap.ordersPort ?? bootstrap.testPort}`}`
                : bootstrap.ordersHostLabel ??
                  `Dane z Subiekta :${bootstrap.ordersPort ?? bootstrap.testPort}`
            }
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconClipboardList size={18} strokeWidth={1.75} />
              </SectionHeadingIcon>
            }
          />

          <div className={cn(estimateSectionInsetClass, "space-y-5")}>
            <div className="flex flex-col gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <SegmentedControl
                ariaLabel="Filtr listy"
                value={listFilter}
                onChange={setListFilter}
                className="w-full justify-stretch sm:w-auto"
                touchFriendly
                options={[
                  {
                    value: "order",
                    label: "Do ZD",
                    title: "Qty > 0, bez wykluczonych",
                  },
                  {
                    value: "all",
                    label: "Wszystkie",
                    title: "Pełny zakres — wykluczone oznaczone",
                  },
                  {
                    value: "excluded",
                    label: `Wykluczone${
                      excludedInGroupCount > 0
                        ? ` (${excludedInGroupCount})`
                        : ""
                    }`,
                    title: "Ręczne + auto (outlet / wycofane / zęby)",
                  },
                ]}
              />
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600"
                    title="Pokazuje kolumny Stan i Rezerwacje (obok Dostępne)"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-slate-300"
                      checked={showStockDetail}
                      onChange={(e) => setShowStockDetail(e.target.checked)}
                    />
                    Stan / rez.
                  </label>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600"
                    title="Kolumny diagnostyczne ZK i qty z API Subiekta"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-slate-300"
                      checked={showZkColumn}
                      onChange={(e) => setShowZkColumn(e.target.checked)}
                    />
                    ZK / API
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openExclusionsPanel}
                  >
                    Wykluczenia
                    {exclusions.length > 0 ? ` (${exclusions.length})` : ""}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openPackagingPanel}
                  >
                    Opakowania
                    {packaging.length > 0 ? ` (${packaging.length})` : ""}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openPairsPanel}
                  >
                    Pary
                    {productPairs.length > 0 ? ` (${productPairs.length})` : ""}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openBomsPanel}
                  >
                    {ZD_BOM_UI.panelTitle}
                    {productBoms.length > 0 ? ` (${productBoms.length})` : ""}
                  </Button>
                  {!showLaunchStickyActions ? (
                    <div className="flex max-w-full flex-col items-stretch gap-1 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={launch?.fromDaily ? "primary" : "secondary"}
                        onClick={() => {
                          if (!createZdGate.ok) {
                            reportError(
                              createZdGateCaption ?? createZdGate.reason
                            );
                            return;
                          }
                          setCreateZdOpen(true);
                        }}
                        disabled={!createZdGate.ok}
                        title={
                          createZdGate.ok
                            ? bootstrap.ordersIsLive
                              ? "Tworzy ZD w aktualnej bazie Subiekta z pozycji „Do ZD”"
                              : "Tworzy ZD w testowym Subiekcie z pozycji „Do ZD”"
                            : createZdGate.reason
                        }
                      >
                        Utwórz ZD
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={copyTsv}
                        disabled={!orderableLines.length || !settingsTrusted}
                        title={
                          settingsTrusted
                            ? "Kopiuje kolumnę Do ZD (jednostki dokumentu) z uwzględnieniem opakowań"
                            : ZD_BOM_UI.copyNeedsSettings
                        }
                      >
                        {copyOk
                          ? "Skopiowano"
                          : "Kopiuj TSV"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setLinkZdOpen(true)}
                        disabled={
                          !lines?.length ||
                          !bootstrap.configured ||
                          !supplierId
                        }
                        title={
                          !supplierId
                            ? "Wybierz dostawcę — historia jest per kh / aliasy"
                            : "Gdy ZD powstało poza OnTime — zapisz snapshot historii"
                        }
                      >
                        Powiąż ZD
                      </Button>
                      </div>
                      {createZdGateCaption ? (
                        <p className="max-w-sm text-right text-[11px] leading-snug text-amber-800">
                          {createZdGateCaption}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {selectedCount === 0 && visibleLines.length > 0 ? (
                  <p className="text-[11px] leading-snug text-slate-500">
                    Zaznacz checkboxy w tabeli, żeby wykluczyć lub ustawić
                    opakowanie grupowo.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <PanelSummaryMetric
                label="W zakresie"
                value={String(meta?.totalFromSubiekt ?? lines.length)}
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Do ZD"
                value={String(orderSummary.doZamowieniaCount)}
                tone="success"
                className="px-3.5 py-3.5"
              />
              {individualBundle.meta.orderCount > 0 ||
              individualBundle.serviceLines.length > 0 ||
              pendingIndividualsLoading ? (
                <PanelSummaryMetric
                  label="Prośby"
                  value={
                    pendingIndividualsLoading &&
                    individualBundle.meta.orderCount === 0 &&
                    individualBundle.serviceLines.length === 0
                      ? "…"
                      : String(
                          individualBundle.byTwId.size +
                            individualBundle.serviceLines.length
                        )
                  }
                  tone={
                    pendingIndividualsTruncated || pendingIndividualsError
                      ? "warning"
                      : "default"
                  }
                  hint={
                    pendingIndividualsLoading &&
                    !individualBundle.meta.orderCount
                      ? "Wczytuję…"
                      : [
                          individualBundle.byTwId.size > 0
                            ? `${individualBundle.byTwId.size} na pozycjach`
                            : null,
                          individualBundle.serviceLines.length > 0
                            ? `${individualBundle.serviceLines.length} usług`
                            : null,
                          individualBundle.meta.extraPiecesSum > 0
                            ? `+${formatQty(individualBundle.meta.extraPiecesSum)} szt`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                  }
                  title={
                    individualBundle.serviceLines.length > 0
                      ? "Przejdź do sekcji usług"
                      : "Prośby wliczone w Do ZD"
                  }
                  onClick={
                    individualBundle.serviceLines.length > 0
                      ? () => {
                          scrollZdEstimateIntoView(
                            ZD_ESTIMATE_SERVICES_FOCUS_ID,
                            { block: "start", offsetPx: 16 }
                          );
                        }
                      : undefined
                  }
                  className="px-3.5 py-3.5"
                />
              ) : null}
              <PanelSummaryMetric
                label="Suma do ZD"
                value={formatQty(orderSummary.zdUnitsSuma)}
                hint="Jednostki do wpisania w Subiekcie"
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Szt. przyjdzie"
                value={formatQty(orderSummary.piecesArrivingSuma)}
                hint={
                  orderSummary.piecesArrivingSuma >
                  orderSummary.piecesNeededSuma
                    ? `potrzeba ${formatQty(orderSummary.piecesNeededSuma)} szt`
                    : undefined
                }
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Wykluczone"
                value={String(excludedInGroupCount)}
                hint={
                  exclusions.length > 0
                    ? `łącznie ${exclusions.length} w bazie`
                    : undefined
                }
                className="px-3.5 py-3.5"
              />
              <PanelSummaryMetric
                label="Z opakowaniem"
                value={String(packagingInGroupCount)}
                hint={
                  packaging.length > 0
                    ? `łącznie ${packaging.length} w bazie`
                    : undefined
                }
                className="px-3.5 py-3.5"
              />
            </div>

            {individualBundle.serviceLines.length > 0 ? (
              <ZdEstimateIndividualServicesSection
                serviceLines={individualBundle.serviceLines}
                catalogOrderableCount={orderableLines.length}
                excludedRoutedCount={excludedRoutedToServicesCount}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {meta?.truncated ? (
                <Badge variant="warning">
                  Lista niepełna — limit stron Subiekta (przewiń / zawęź zakres)
                </Badge>
              ) : (
                <span />
              )}
              <p className="text-xs text-slate-500">
                Widoczne {visibleLines.length} z {lines.length}
                {paramInfo
                  ? ZD_ESTIMATE_UI.footerWindow(
                      String(paramInfo.dataOd ?? dataOd),
                      String(paramInfo.dataDo ?? dataDo),
                      String(paramInfo.dniOkresu ?? "—"),
                      String(paramInfo.dniZapasu ?? "—")
                    )
                  : ""}
              </p>
            </div>

            <p className="text-[11px] leading-snug text-slate-500">
              {ZD_ESTIMATE_UNITS_LEGEND}
            </p>

            {visibleLines.length === 0 ? (
              <EmptyState
                title={
                  !settingsTrusted && listFilter === "order"
                    ? "Ustawienia niewczytane"
                    : listFilter === "order"
                      ? ZD_ESTIMATE_UI.emptyOrderTitle
                      : listFilter === "excluded"
                        ? "Brak wykluczeń w tym zakresie"
                        : "Brak pozycji"
                }
                description={
                  !settingsTrusted && listFilter === "order"
                    ? ZD_BOM_UI.settingsEmptyHint
                    : !settingsTrusted && listFilter === "excluded"
                      ? "Tu widać tylko auto-wykluczenia (outlet / wycofane / zęby). Wczytaj listę wykluczeń, żeby dołączyć pozycje z bazy."
                      : listFilter === "order" &&
                          individualBundle.serviceLines.length > 0
                        ? "Powyżej są usługi z próśb (uwagi ZD). Do utworzenia ZD potrzebna jest ≥1 pozycja katalogowa — albo obsłuż prośby w panelu Dziś."
                        : listFilter === "order"
                          ? "Przy tych parametrach ilość = 0 albo wszystkie braki są na liście wykluczeń. Przełącz filtr, żeby zobaczyć pełny zakres."
                          : listFilter === "excluded"
                            ? "Żaden produkt nie jest wykluczony ręcznie ani automatycznie (outlet / wycofane w nazwie, katalog zębów)."
                            : "Subiekt nie zwrócił pozycji dla tego zakresu."
                }
                action={
                  !settingsTrusted && listFilter === "order" ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {!exclusionsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadExclusions}
                        >
                          Wczytaj wykluczenia
                        </Button>
                      ) : null}
                      {!packagingTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadPackaging}
                        >
                          Wczytaj opakowania
                        </Button>
                      ) : null}
                      {!pairsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadPairs}
                        >
                          Wczytaj pary
                        </Button>
                      ) : null}
                      {!bomsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadBoms}
                        >
                          {ZD_BOM_UI.alertReloadShort}
                        </Button>
                      ) : null}
                      {!teethTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadTeeth}
                        >
                          Wczytaj zęby
                        </Button>
                      ) : null}
                    </div>
                  ) : listFilter === "order" &&
                    individualBundle.serviceLines.length > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        scrollZdEstimateIntoView(ZD_ESTIMATE_SERVICES_FOCUS_ID, {
                          block: "start",
                          offsetPx: 16,
                        })
                      }
                    >
                      Pokaż usługi
                    </Button>
                  ) : listFilter === "order" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setListFilter("all")}
                    >
                      Pokaż wszystkie
                    </Button>
                  ) : listFilter === "excluded" &&
                    (exclusions.length > 0 || !exclusionsTrusted) ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {!exclusionsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutating}
                          onClick={retryLoadExclusions}
                        >
                          Wczytaj wykluczenia
                        </Button>
                      ) : null}
                      {exclusions.length > 0 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={openExclusionsPanel}
                        >
                          Otwórz listę wykluczeń
                        </Button>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            ) : (
              <div className="space-y-3">
                <ZdEstimateBulkBar
                  selectedCount={selectedCount}
                  visibleCount={visibleLines.length}
                  allVisibleSelected={allVisibleSelected}
                  excludeEligibleCount={excludeEligibleLines.length}
                  restoreEligibleCount={restoreEligibleLines.length}
                  packagingClearEligibleCount={
                    packagingClearEligibleLines.length
                  }
                  truncatedHint={selectedCount > ZD_ESTIMATE_BULK_MAX}
                  disabled={mutating || estimating}
                  onSelectAllVisible={selectAllVisible}
                  onClearSelection={clearSelection}
                  onBulkExclude={() => {
                    const withProsba = excludeEligibleLines.filter((l) =>
                      individualBundle.byTwId.has(l.tw_Id)
                    );
                    if (withProsba.length) {
                      const ok = window.confirm(
                        `${withProsba.length} z zaznaczonych pozycji ma prośbę handlowca.\n\nPo wykluczeniu prośba trafi do sekcji „Usługi” i do uwag ZD (bez qty towaru) — nie zniknie z panelu Dziś do momentu create.\n\nKontynuować?`
                      );
                      if (!ok) return;
                    }
                    setBulkExcludeOpen(true);
                  }}
                  onBulkRestore={() => setBulkRestoreOpen(true)}
                  onBulkPackaging={() => {
                    setBulkPackagingMode("set");
                    setBulkPackagingOpen(true);
                  }}
                  onBulkClearPackaging={() => {
                    setBulkPackagingMode("clear");
                    setBulkPackagingOpen(true);
                  }}
                  onCreatePair={openPairFromSelection}
                  onCreateBom={openBomFromSelection}
                />

                <TableScroll className="max-h-[min(72vh,48rem)] overflow-auto rounded-xl border border-slate-200/90 bg-white px-0 pb-0 shadow-sm shadow-slate-900/[0.02] sm:px-0 sm:pb-0">
                <DataTable
                  className={cn(
                    "zd-estimate-table",
                    showStockDetail && "zd-estimate-table--detail",
                    showZkColumn && "zd-estimate-table--zk"
                  )}
                >
                  <thead>
                    <tr>
                      <th className="zd-estimate-check-col" scope="col">
                        <span className="sr-only">Zaznacz</span>
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          className={cn("size-4", checkboxBrandClass)}
                          checked={allVisibleSelected}
                          disabled={
                            visibleLines.length === 0 || mutating || estimating
                          }
                          onChange={toggleSelectAllVisible}
                          aria-label={
                            allVisibleSelected
                              ? "Odznacz widoczne"
                              : "Zaznacz widoczne"
                          }
                        />
                      </th>
                      <ZdEstimateSortableTh
                        label="Symbol"
                        field="symbol"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="zd-estimate-symbol-col"
                      />
                      <ZdEstimateSortableTh
                        label="Do ZD"
                        field="doZd"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="zd-estimate-dozd-col text-left"
                        align="left"
                        hint="Ilość na dokumencie ZD (jednostki dokumentu)"
                      />
                      <ZdEstimateSortableTh
                        label="Nazwa"
                        field="name"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="zd-estimate-name-col"
                      />
                      <th
                        className="zd-estimate-pack-col text-right"
                        title="Ile sztuk w 1 jednostce na dokumencie ZD"
                      >
                        Opak.
                      </th>
                      {showStockDetail ? (
                        <>
                          <th className="zd-estimate-num-col text-right">Stan</th>
                          <th
                            className="zd-estimate-num-col text-right"
                            title="Rezerwacje"
                          >
                            Rez.
                          </th>
                        </>
                      ) : null}
                      <th
                        className="zd-estimate-num-col text-right"
                        title="Dostępne (stan − rezerwacje)"
                      >
                        Dost.
                      </th>
                      <th
                        className="zd-estimate-num-col text-right"
                        title="Sprzedaż w oknie (sztuki)"
                      >
                        Sprzed.
                      </th>
                      <th
                        className="zd-estimate-num-col text-right"
                        title="Cel zapasu w sztukach (po śledzeniu sprzedaży)"
                      >
                        Cel
                      </th>
                      <th
                        className="zd-estimate-num-col text-right"
                        title="Otwarte ZD — jednostki dokumentu (przy opakowaniu także sztuki)"
                      >
                        Otwarte
                      </th>
                      {showZkColumn ? (
                        <>
                          <th
                            className="zd-estimate-num-col text-right"
                            title="Otwarte ZK bez rezerwacji"
                          >
                            ZK
                          </th>
                          <th
                            className="zd-estimate-num-col text-right"
                            title="Surowe do zamówienia z API"
                          >
                            API
                          </th>
                        </>
                      ) : null}
                      <th className="text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.map((l) => {
                      const nameHit = nameAutoByTwId.get(l.tw_Id);
                      const dbExcluded =
                        exclusionsTrusted && dbExcludedIds.has(l.tw_Id);
                      const excluded = Boolean(nameHit) || Boolean(dbExcluded);
                      const packRow = packagingMap.get(l.tw_Id) ?? null;
                      const pairMeta = l.pair ?? null;
                      const bomMeta = l.bom ?? null;
                      const packLookup = packagingLookup.get(l.tw_Id) ?? null;
                      const qty = resolveOrderQtyForLine(
                        l,
                        packLookup ??
                          (packRow
                            ? {
                                unitsPerPackage: packRow.unitsPerPackage,
                                packageLabel: packRow.packageLabel,
                              }
                            : null),
                        individualExtraPiecesForTw(
                          l.tw_Id,
                          individualExtraByTwId
                        )
                      );
                      const individualExtra =
                        individualBundle.byTwId.get(l.tw_Id) ?? null;
                      const packagingConflict =
                        pairMeta?.role === "pack" &&
                        packRow != null &&
                        packRow.unitsPerPackage > 1 &&
                        packRow.unitsPerPackage !== pairMeta.unitsPerPack;
                      const note = exclusionById.get(l.tw_Id)?.note;
                      const isSelected = Boolean(selected[l.tw_Id]);
                      const excludeTitle = nameHit
                        ? `${l.tw_Nazwa} — auto: ${nameHit.reason} („${nameHit.matched}”)`
                        : note
                          ? `${l.tw_Nazwa} — ${note}`
                          : l.tw_Nazwa;
                      return (
                        <tr
                          key={l.tw_Id}
                          className={cn(
                            excluded && "bg-slate-50/80",
                            isSelected && !excluded && "bg-indigo-50/40"
                          )}
                        >
                          <td className="zd-estimate-check-col">
                            <input
                              type="checkbox"
                              className={cn("size-4", checkboxBrandClass)}
                              checked={isSelected}
                              disabled={mutating || estimating}
                              onChange={() => toggleRowSelected(l.tw_Id)}
                              aria-label={`Zaznacz ${l.tw_Symbol}`}
                            />
                          </td>
                          <td
                            className={cn(
                              "zd-estimate-symbol-col whitespace-nowrap font-semibold tabular-nums",
                              excluded
                                ? "text-slate-400 line-through"
                                : "text-slate-900"
                            )}
                            title={l.tw_Symbol}
                          >
                            {l.tw_Symbol}
                          </td>
                          <td className="zd-estimate-dozd-col whitespace-nowrap text-left">
                            <ZdEstimateDoZdCell
                              qty={qty}
                              excluded={excluded}
                              individualExtraPieces={
                                individualExtra?.extraPieces ?? 0
                              }
                            />
                          </td>
                          <td
                            className={cn(
                              "zd-estimate-name-col",
                              excluded ? "text-slate-400" : "text-slate-700"
                            )}
                            title={excludeTitle}
                          >
                            <div className="flex flex-col gap-1">
                              <span className="line-clamp-2 text-[13px] leading-snug">
                                {l.tw_Nazwa}
                              </span>
                              {pairMeta ? (
                                <ZdEstimatePairMetaBadge
                                  pair={pairMeta}
                                  packagingConflict={packagingConflict}
                                />
                              ) : null}
                              {bomMeta ? (
                                <ZdEstimateBomMetaBadge bom={bomMeta} />
                              ) : null}
                              {individualExtra ? (
                                <ZdEstimateIndividualMetaBadge
                                  extra={individualExtra}
                                />
                              ) : null}
                              {nameHit ? (
                                <span className="inline-block w-fit rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                                  {formatZdNameAutoExcludeBadge(nameHit.reason)}
                                </span>
                              ) : excluded ? (
                                <span className="inline-block w-fit rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                                  wykluczone
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="zd-estimate-pack-col whitespace-nowrap text-right tabular-nums text-slate-600">
                            {qty.hasPackaging ? (
                              <span className="inline-flex flex-col items-end gap-0.5">
                                <span className="font-semibold tabular-nums text-indigo-900">
                                  {qty.unitsPerPackage}
                                </span>
                                <span className="text-[10px] leading-tight text-slate-400">
                                  szt / {qty.packageLabel}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-300">
                                1:1
                              </span>
                            )}
                          </td>
                          {showStockDetail ? (
                            <>
                              <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-700">
                                {pairMeta?.role === "pack" ? (
                                  <ZdEstimatePairPackStockCell
                                    value={l.tw_Stan}
                                  />
                                ) : (
                                  formatQty(l.tw_Stan)
                                )}
                              </td>
                              <td
                                className={cn(
                                  "zd-estimate-num-col whitespace-nowrap text-right tabular-nums",
                                  l.tw_StanRez > 0
                                    ? "font-medium text-amber-800"
                                    : "text-slate-400"
                                )}
                              >
                                {pairMeta?.role === "pack" ? (
                                  <ZdEstimatePairPackStockCell
                                    value={l.tw_StanRez}
                                    tone={l.tw_StanRez > 0 ? "warn" : "muted"}
                                  />
                                ) : (
                                  formatQty(l.tw_StanRez)
                                )}
                              </td>
                            </>
                          ) : null}
                          <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-700">
                            {pairMeta?.role === "pack" ? (
                              <ZdEstimatePairPackStockCell value={l.dostepne} />
                            ) : (
                              formatQty(l.dostepne)
                            )}
                          </td>
                          <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-700">
                            {pairMeta && !pairMeta.partnerMissing ? (
                              <ZdEstimatePairSalesCell pair={pairMeta} />
                            ) : (
                              formatQty(l.sprzedazOkres)
                            )}
                          </td>
                          <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-600">
                            <span
                              className="inline-flex flex-col items-end gap-0.5"
                              title={
                                formatSalesTrackHint({
                                  applied: Math.abs(l.salesTrackDelta) > 1e-9,
                                  deltaPieces: l.salesTrackDelta,
                                  reasons: l.salesTrackReasons,
                                }) ?? undefined
                              }
                            >
                              {pairMeta && !pairMeta.partnerMissing ? (
                                <ZdEstimatePairPiecesCell
                                  pieces={
                                    Math.abs(l.salesTrackDelta) > 1e-9
                                      ? l.celZapasuTracked
                                      : l.celZapasu
                                  }
                                  unitsPerPack={pairMeta.unitsPerPack}
                                  emphasize
                                  subline={
                                    l.salesTrackDelta > 1e-9 ? (
                                      <span className="text-[10px] font-medium text-emerald-700/90">
                                        +{formatQty(l.salesTrackDelta)}
                                      </span>
                                    ) : l.salesTrackDelta < -1e-9 ? (
                                      <span className="text-[10px] font-medium text-amber-700/90">
                                        −
                                        {formatQty(Math.abs(l.salesTrackDelta))}
                                      </span>
                                    ) : null
                                  }
                                />
                              ) : (
                                <>
                                  <span>
                                    {Math.abs(l.salesTrackDelta) > 1e-9
                                      ? formatQty(l.celZapasuTracked)
                                      : formatQty(l.celZapasu)}
                                  </span>
                                  {l.salesTrackDelta > 1e-9 ? (
                                    <span className="text-[10px] font-medium text-emerald-700/90">
                                      +{formatQty(l.salesTrackDelta)}
                                    </span>
                                  ) : l.salesTrackDelta < -1e-9 ? (
                                    <span className="text-[10px] font-medium text-amber-700/90">
                                      −
                                      {formatQty(Math.abs(l.salesTrackDelta))}
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </span>
                          </td>
                          <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-700">
                            <span
                              className="inline-flex flex-col items-end gap-0.5"
                              title={
                                qty.hasPackaging && l.otwarteZd > 0
                                  ? `${formatQty(l.otwarteZd)} j.dok. = ${formatQty(l.otwarteZd * qty.unitsPerPackage)} szt`
                                  : `${formatQty(l.otwarteZd)} j.dok. (otwarte ZD)`
                              }
                            >
                              <span>
                                {formatQty(l.otwarteZd)}
                                <span className="ml-0.5 text-[10px] font-medium text-slate-400">
                                  j.dok.
                                </span>
                              </span>
                              {qty.hasPackaging && l.otwarteZd > 0 ? (
                                <span className="text-[10px] text-slate-400">
                                  {formatQty(
                                    l.otwarteZd * qty.unitsPerPackage
                                  )}{" "}
                                  szt
                                </span>
                              ) : null}
                            </span>
                          </td>
                          {showZkColumn ? (
                            <>
                              <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-400">
                                {formatQty(l.otwarteZkBezRez)}
                              </td>
                              <td className="zd-estimate-num-col whitespace-nowrap text-right tabular-nums text-slate-400">
                                {formatQty(l.doZamowieniaApi)}
                              </td>
                            </>
                          ) : null}
                          <td className="text-right">
                            <div className="inline-flex justify-end py-0.5 pl-1">
                              <ZdEstimateRowActions
                                symbol={l.tw_Symbol}
                                nameAutoExcluded={Boolean(nameHit)}
                                dbExcluded={Boolean(dbExcluded)}
                                packagingHint={
                                  qty.hasPackaging
                                    ? `${qty.unitsPerPackage} szt / 1 ${qty.packageLabel}`
                                    : null
                                }
                                disabled={mutating || estimating}
                                pending={mutatingTwId === l.tw_Id}
                                onPackaging={() => setPackagingCandidate(l)}
                                onExclude={() => {
                                  if (individualExtra) {
                                    const ok = window.confirm(
                                      "Ta pozycja ma prośbę handlowca.\n\nPo wykluczeniu prośba trafi do sekcji „Usługi” i do uwag ZD (bez qty towaru) — nie zniknie z panelu Dziś do create.\n\nKontynuować?"
                                    );
                                    if (!ok) return;
                                  }
                                  setExcludeCandidate(l);
                                }}
                                onRestore={() => restoreLine(l.tw_Id)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableScroll>
              </div>
            )}
          </div>
        </Card>
        </div>
      ) : null}

      {lines && excludedWithIndividualCount > 0 ? (
        <Alert
          tone="warning"
          title="Prośby na wykluczonych pozycjach"
          className="mt-4"
        >
          {excludedWithIndividualCount}{" "}
          {excludedWithIndividualCount === 1
            ? "prośba nadal na wykluczonej pozycji"
            : "próśb nadal na wykluczonych pozycjach"}{" "}
          — sprawdź listę.
        </Alert>
      ) : null}
        </>
      ) : null}

      {showLaunchStickyActions ? (
        <div
          className={cn(
            "sticky z-20 flex flex-col gap-2 border border-slate-200/90 bg-white/95 px-3 py-3 shadow-[0_-4px_16px_-8px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:px-4",
            "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] rounded-xl md:bottom-2"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => {
              if (!createZdGate.ok) {
                reportError(createZdGateCaption ?? createZdGate.reason);
                return;
              }
              setCreateZdOpen(true);
            }}
            disabled={!createZdGate.ok}
            title={
              createZdGate.ok
                ? bootstrap.ordersIsLive
                  ? "Tworzy ZD w aktualnej bazie Subiekta z pozycji „Do ZD”"
                  : "Tworzy ZD w testowym Subiekcie z pozycji „Do ZD”"
                : createZdGate.reason
            }
          >
            Utwórz ZD
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={copyTsv}
            disabled={!orderableLines.length || !settingsTrusted}
            title={
              settingsTrusted
                ? "Kopiuje kolumnę Do ZD (jednostki dokumentu) z uwzględnieniem opakowań"
                : ZD_BOM_UI.copyNeedsSettings
            }
          >
            {copyOk ? "Skopiowano" : "Kopiuj TSV"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setLinkZdOpen(true)}
            disabled={
              !lines?.length || !bootstrap.configured || !supplierId
            }
            title={
              !bootstrap.configured
                ? "Wymaga połączenia z Subiektem"
                : !supplierId
                  ? "Wybierz dostawcę — historia jest per kontrahent"
                  : "Gdy ZD powstało poza OnTime — zapisz snapshot historii"
            }
          >
            Powiąż ZD
          </Button>
          {individualBundle.serviceLines.length > 0 ? (
            <span className="text-xs text-amber-900">
              · {individualBundle.serviceLines.length}{" "}
              {individualBundle.serviceLines.length === 1
                ? "usługa"
                : "usług"}{" "}
              w uwagach
            </span>
          ) : null}
          <span className="ml-auto text-xs font-medium text-emerald-800">
            {orderableLines.length} do zamówienia
          </span>
          </div>
          {createZdGateCaption ? (
            <p className="text-[11px] leading-snug text-amber-800">
              {createZdGateCaption}
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkRestoreOpen && restoreEligibleLines.length > 0}
        title={`Przywróć ${Math.min(restoreEligibleLines.length, ZD_ESTIMATE_BULK_MAX)}${restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX ? ` z ${restoreEligibleLines.length}` : ""}?`}
        message={
          restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX
            ? `Zaznaczone wrócą na listę „Do ZD”. Limit ${ZD_ESTIMATE_BULK_MAX} na akcję — pierwsze ${ZD_ESTIMATE_BULK_MAX} zostaną przywrócone, reszta zostanie zaznaczona.`
            : `Przywrócić ${restoreEligibleLines.length} ${restoreEligibleLines.length === 1 ? "produkt" : "produktów"} na listę „Do ZD”?`
        }
        confirmLabel={
          restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX
            ? `Przywróć ${ZD_ESTIMATE_BULK_MAX}`
            : `Przywróć ${restoreEligibleLines.length}`
        }
        cancelLabel="Anuluj"
        pending={mutating && bulkRestoreOpen}
        onCancel={() => {
          if (!mutating) setBulkRestoreOpen(false);
        }}
        onConfirm={confirmBulkRestore}
      />

      <ZdEstimateBulkExcludeDialog
        key={
          bulkExcludeOpen
            ? `ex-${excludeEligibleLines.map((l) => l.tw_Id).join("-")}`
            : "ex-closed"
        }
        open={bulkExcludeOpen && excludeEligibleLines.length > 0}
        lines={excludeEligibleLines}
        pending={mutating && bulkExcludeOpen}
        onCancel={() => {
          if (!mutating) setBulkExcludeOpen(false);
        }}
        onConfirm={confirmBulkExclude}
      />

      <ZdEstimateBulkPackagingDialog
        key={
          bulkPackagingOpen
            ? `pk-${bulkPackagingMode}-${(bulkPackagingMode === "clear"
                ? packagingClearEligibleLines
                : selectedLines
              )
                .map((l) => l.tw_Id)
                .join("-")}`
            : "pk-closed"
        }
        open={
          bulkPackagingOpen &&
          (bulkPackagingMode === "clear"
            ? packagingClearEligibleLines.length > 0
            : selectedLines.length > 0)
        }
        lines={
          bulkPackagingMode === "clear"
            ? packagingClearEligibleLines
            : selectedLines
        }
        mode={bulkPackagingMode}
        pending={mutating && bulkPackagingOpen}
        onCancel={() => {
          if (!mutating) setBulkPackagingOpen(false);
        }}
        onSave={confirmBulkPackaging}
        onClear={confirmBulkClearPackaging}
      />

      <ZdEstimatePackagingDialog
        open={packagingCandidate != null}
        line={packagingCandidate}
        existing={
          packagingCandidate
            ? packagingMap.get(packagingCandidate.tw_Id) ?? null
            : null
        }
        individualExtraPieces={
          packagingCandidate
            ? individualExtraPiecesForTw(
                packagingCandidate.tw_Id,
                individualExtraByTwId
              )
            : 0
        }
        pending={mutating && packagingCandidate != null}
        onCancel={() => {
          if (!mutating) setPackagingCandidate(null);
        }}
        onSave={savePackaging}
        onClear={clearPackaging}
      />

      <ZdEstimatePackagingModal
        open={packagingOpen}
        onClose={() => setPackagingOpen(false)}
        packaging={packaging}
        onPackagingChange={applyPackagingLive}
        onError={reportError}
      />

      <ZdEstimatePairsModal
        open={pairsOpen}
        onClose={() => {
          setPairsOpen(false);
          setPairSeed(null);
        }}
        pairs={productPairs}
        seed={pairSeed}
        onSeedConsumed={() => {
          setPairSeed(null);
          clearSelection();
        }}
        onPairsChange={applyPairsMutation}
        onError={reportError}
      />

      <ZdEstimateBomsModal
        open={bomsOpen}
        onClose={() => {
          setBomsOpen(false);
          setBomSeed(null);
        }}
        boms={productBoms}
        pairs={productPairs}
        seed={bomSeed}
        onSeedConsumed={() => {
          setBomSeed(null);
          clearSelection();
        }}
        onBomsChange={applyBomsMutation}
        onError={reportError}
      />

      <ZdEstimateExcludeDialog
        open={excludeCandidate != null}
        line={excludeCandidate}
        pending={mutating && excludeCandidate != null}
        onCancel={() => {
          if (!mutating) setExcludeCandidate(null);
        }}
        onConfirm={confirmExclude}
      />

      <ZdEstimateExclusionsModal
        open={exclusionsOpen}
        onClose={() => setExclusionsOpen(false)}
        exclusions={exclusions}
        onExclusionsChange={applyExclusionsLive}
        onError={reportError}
      />

      <ZdEstimateLinkZdDialog
        open={linkZdOpen}
        supplierId={supplierId}
        scopeMode={scopeMode}
        grtId={selectedGroup?.grt_Id ?? null}
        cechaId={selectedCecha?.ctw_Id ?? null}
        initialNr={linkNrPrefill}
        lineMeta={
          lines?.map((l) => ({
            twId: l.tw_Id,
            celAtLink: l.celZapasuTracked,
            deltaAtLink: l.salesTrackDelta,
          })) ?? null
        }
        onClose={() => {
          setLinkZdOpen(false);
          setLinkNrPrefill(null);
        }}
        onLinked={({ dokNrPelny, lineCount }) => {
          setFeedback(null);
          setErrorMessage(null);
          setLinkNrPrefill(null);
          setLinkOkMessage(
            `Zapisano snapshot ${dokNrPelny} (${lineCount} poz.) — kolejne szacunki tego dostawcy i zakresu uwzględnią historię.`
          );
          window.setTimeout(() => setLinkOkMessage(null), 5000);
        }}
        onError={reportError}
      />

      {supplierId &&
      createKhResolution?.ok &&
      createZdPreview.lineCount > 0 ? (
        <ZdEstimateCreateZdDialog
          open={createZdOpen}
          supplierId={supplierId}
          supplierName={
            createKhResolution.supplierName ||
            selectedSupplier?.name ||
            "Dostawca"
          }
          khId={createKhResolution.khId}
          usedAlias={createKhResolution.usedAlias}
          scopeLabel={scopeLabel}
          dateKey={bootstrap.todayKey}
          preview={createZdPreview}
          scopeMode={scopeMode}
          grtId={selectedGroup?.grt_Id ?? null}
          cechaId={selectedCecha?.ctw_Id ?? null}
          lineMeta={
            lines?.map((l) => ({
              twId: l.tw_Id,
              celAtLink: l.celZapasuTracked,
              deltaAtLink: l.salesTrackDelta,
            })) ?? null
          }
          initialUwagi={createBaseUwagi.slice(0, Math.max(1, createUwagiBaseMaxLen))}
          uwagiBaseMaxLen={createUwagiBaseMaxLen}
          individualCatalogOrderIds={createCatalogOrderIds}
          individualServiceOrderIds={createServiceOrderIds}
          serviceMarkPreviewCount={createServiceOrderIdsMarkPreview.length}
          serviceUwagiPreview={
            (() => {
              const idx = createUwagiWithServices.uwagi.search(/Usługi:\s*/i);
              return idx >= 0
                ? createUwagiWithServices.uwagi.slice(idx)
                : null;
            })()
          }
          excludedWithIndividualCount={excludedRoutedToServicesCount}
          omittedServiceCount={createUwagiWithServices.omittedServiceCount}
          ordersIsLive={bootstrap.ordersIsLive}
          ordersPort={bootstrap.ordersPort ?? bootstrap.testPort}
          ordersHostLabel={bootstrap.ordersHostLabel}
          onClose={() => {
            setCreateZdOpen(false);
            setCreatingZd(false);
          }}
          onSubmitStart={() => setCreatingZd(true)}
          onCreated={({
            dokId,
            dokNrPelny,
            lineCount,
            snapshotOk,
            snapshotMessage,
            createdUnitsByTwId,
            markedIndividualOrderIds,
            markIndividualsMessage,
          }) => {
            setCreatingZd(false);
            setCreateZdOpen(false);
            setFeedback(null);
            setErrorMessage(null);
            setCreateDoneDokId(dokId);
            setCreateDoneDokNr(dokNrPelny);
            if (markedIndividualOrderIds?.length) {
              const marked = new Set(markedIndividualOrderIds);
              setPendingIndividuals((prev) =>
                prev.filter((o) => !marked.has(o.id))
              );
            }
            const snapNote = snapshotOk
              ? "zapisano historię"
              : snapshotMessage ?? "historia nie zapisana — użyj „Powiąż ZD”";
            const markNote = markIndividualsMessage
              ? ` · ${markIndividualsMessage}`
              : markedIndividualOrderIds?.length
                ? ` · odznaczono ${markedIndividualOrderIds.length} próśb (Główne)`
                : "";
            setCreateZdOkMessage(
              `Utworzono ${dokNrPelny} · ${lineCount} poz. · ${snapNote}${markNote}`
            );
            window.setTimeout(() => setCreateZdOkMessage(null), 10000);

            if (!snapshotOk) {
              setLinkNrPrefill(dokNrPelny);
              setLinkZdOpen(true);
            }

            if (linesBase?.length) {
              const bumped = applyCreatedZdUnitsToOtwarteZd(
                linesBase,
                createdUnitsByTwId,
                packagingLookup
              );
              setLinesBase(bumped);
              const dni = Math.round(Number(dniZapasu));
              const dniOkresuRaw = paramInfo?.dniOkresu;
              const dniOkresu =
                dniOkresuRaw != null && Number.isFinite(Number(dniOkresuRaw))
                  ? Number(dniOkresuRaw)
                  : null;
              const { lines: nextLines, missingPartnerTwIds, missingBomTwIds } =
                refreshZdEstimateLinesWithPairs({
                  linesBase: bumped,
                  pairs: productPairs,
                  boms: bomRowsToRefs(productBoms),
                  options: {
                    dniZapasu:
                      Number.isFinite(dni) && dni >= 1
                        ? dni
                        : DEFAULT_DNI_ZAPASU,
                    dniOkresu,
                    zapasMin: Number(zapasMin) || 0,
                    excludedTwIds: excludedIdsForRefresh,
                    packagingByTwId: packagingByTwIdForRefresh,
                    historyByTwId:
                      historyByTwId.size > 0 ? historyByTwId : null,
                  },
                });
              setLines(nextLines);
              setPairPartnerMissingCount(missingPartnerTwIds.length);
              setBomMissingCount(missingBomTwIds.length);
            }
          }}
          onError={(message, opts) => {
            setCreatingZd(false);
            reportError(message);
            const timeoutKh = opts?.timeoutKhId;
            if (timeoutKh != null && timeoutKh > 0) {
              void (async () => {
                const found = await actionFindRecentZdAfterCreateAttempt({
                  supplierKhId: timeoutKh,
                });
                if (!found.ok || found.documents.length === 0) return;
                const first = found.documents[0];
                if (!first) return;
                setLinkNrPrefill(first.dokNrPelny);
                setLinkZdOpen(true);
                setLinkOkMessage(
                  `Timeout create — znaleziono świeże ZD (${first.dokNrPelny}). Sprawdź i zapisz snapshot, jeśli to ten dokument.`
                );
                window.setTimeout(() => setLinkOkMessage(null), 8000);
              })();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ZdEstimateSortableTh({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
  className,
  align = "left",
  hint,
}: {
  label: string;
  field: ZdEstimateListSortKey;
  sortKey: ZdEstimateListSortKey;
  sortDir: ZdEstimateListSortDir;
  onSort: (field: ZdEstimateListSortKey) => void;
  className?: string;
  align?: "left" | "right";
  /** Opis kolumny (tooltip), niezależny od sortowania */
  hint?: string;
}) {
  const isActive = sortKey === field;
  const ariaSort =
    isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className={className} aria-sort={ariaSort} scope="col" title={hint}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 font-semibold transition-colors hover:text-slate-900",
          align === "right" ? "w-full justify-end text-right" : "text-left",
          isActive ? "text-slate-900" : "text-slate-600"
        )}
        title={
          isActive
            ? `Sortowanie: ${sortDir === "asc" ? "rosnąco" : "malejąco"} — kliknij, aby odwrócić`
            : hint
              ? `${hint} — sortuj`
              : `Sortuj po: ${label}`
        }
      >
        {label}
        {isActive ? (
          <span className="text-[10px] leading-none" aria-hidden>
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        ) : (
          <span className="text-[10px] leading-none text-slate-300" aria-hidden>
            ↕
          </span>
        )}
      </button>
    </th>
  );
}
