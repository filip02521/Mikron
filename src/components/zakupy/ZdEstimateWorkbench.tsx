"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import {
  actionDeleteZdEstimatePackaging,
  actionDeleteZdEstimatePackagingBulk,
  actionExcludeZdEstimateProduct,
  actionExcludeZdEstimateProducts,
  actionFindRecentZdAfterCreateAttempt,
  actionListZdEstimateExclusions,
  actionListZdEstimateOnRequests,
  actionListZdEstimateTeethTwIds,
  actionListZdEstimatePackaging,
  actionListZdProductPairs,
  actionListZdProductBoms,
  actionGetZdEstimateUiSession,
  actionMarkZdEstimateOnRequest,
  actionMarkZdEstimateOnRequestProducts,
  actionClearZdEstimateOnRequest,
  actionClearZdEstimateOnRequestProducts,
  actionRestoreZdEstimateProduct,
  actionRestoreZdEstimateProducts,
  actionRunZdEstimateManual,
  actionFetchZdEstimatePendingIndividuals,
  actionGetZdBoostPowerPreset,
  actionSetZdBoostPowerPreset,
  actionSaveZdEstimateUiPrefs,
  actionSetZdEstimateExtrasPolicy,
  actionSearchZdEstimateCechy,
  actionSearchZdEstimateGroups,
  actionUpsertZdEstimatePackaging,
  actionUpsertZdEstimatePackagingBulk,
  actionUpsertZdEstimateSupplierScope,
  actionCreateZdEstimateUiSession,
  actionDeleteZdEstimateUiSession,
  actionUpsertZdEstimateUiSessionSnapshot,
  type ZdEstimateCechaOption,
  type ZdEstimateGroupOption,
  type ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import {
  policyForBoostPreset,
  ZD_BOOST_POWER_DEFAULT,
  ZD_BOOST_PRESET_DEFS,
  type ZdBoostPowerPreset,
} from "@/lib/orders/zd-estimate-boost-presets";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import {
  ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS,
  ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS,
  ZD_ESTIMATE_UI_PREFS_DEFAULTS,
  moveZdEstimateColumnOrder,
  resolveZdEstimateColumnSectionStarts,
  resolveZdEstimateScrollableColumnOrder,
  toggleZdEstimateColumnVisibility,
  zdEstimateColumnOrderEqual,
  zdEstimateColumnVisibilityEqual,
  type ZdEstimateColumnVisibility,
  type ZdEstimateListFilter,
  type ZdEstimateOptionalColumn,
  type ZdEstimateUiPrefs,
} from "@/lib/orders/zd-estimate-prefs";
import {
  collectTodayScheduleSuppliers,
  zdEstimateScopeCoverage,
  type ZdEstimateScopeCoverage,
} from "@/lib/orders/zd-estimate-scope-coverage";
import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import {
  buildBakeExcludedTwIds,
  buildExtraOnlyTwIds,
  buildOrderExcludedTwIds,
  filterSessionIncludeRespectingOnRequest,
  onRequestTwIdSet,
  retargetTwIdToPackIfPiece,
} from "@/lib/orders/zd-estimate-on-request";
import {
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
  cancelPendingZdEstimateExternalSessionAwayStart,
  createZdEstimateExternalSessionToken,
  pauseAwayTimerOnReturnToExternalSession,
  recreateZdEstimateExternalSessionTokenPreservingTimer,
  scheduleZdEstimateExternalSessionAwayStart,
  readZdEstimateExternalSessionToken,
  peekZdEstimateExternalSessionToken,
  clearZdEstimateExternalSessionToken,
  writeZdEstimateExternalSessionToken,
  consumeExpiredOrInvalidZdEstimateExternalSessionToken,
} from "@/lib/orders/zd-estimate-external-session";
import {
  buildZdEstimateUiSessionSnapshot,
  historyEntriesFromMap,
  historyMapFromEntries,
  parseZdEstimateUiSessionSnapshot,
  type ZdEstimateUiSessionSnapshot,
} from "@/lib/orders/zd-estimate-ui-session-snapshot";
import { bomRowsToRefs, bomRowHidesHardExclude, bomRowHidesOnRequest, hasUnresolvedExplodeBomNodes } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import {
  ZD_ESTIMATE_UI,
  zdEstimateBlockedDailyCtaMessage,
  zdEstimateBlockedOrdersAlertBody,
  zdEstimateCountingButtonLabel,
  zdEstimateEmptyListDescription,
  zdEstimateNeedsSettingsHint,
  zdEstimatePageHint,
  zdEstimatePrepCardHint,
  zdEstimatePrepIdleLead,
  zdEstimatePoliciesSectionHint,
  zdEstimateCechaScopeCaption,
  zdEstimateProsbaWord,
  zdEstimateProsbaWordAccusative,
  zdEstimateLaunchReadyToastDescription,
  zdEstimateLaunchReadyToastTitle,
  zdEstimateReadyToCountHint,
  zdEstimateRecountListStatus,
  zdEstimateRecountOverlayHint,
  zdEstimateRecountOverlayMessage,
  zdEstimateScopeChangedHint,
  zdEstimateScopeDashedHint,
  zdEstimateScopeLinkedCaption,
  zdEstimateScopeModeCechaHint,
  zdEstimateScopeModeGrupaHint,
  buildImplicitPieceSnapshotNotice,
  zdEstimateExternalSessionCancelButtonLabel,
  zdEstimateExternalSessionCancelConfirmTitle,
  zdEstimateExternalSessionCancelConfirmMessage,
  zdEstimateExternalSessionCancelConfirmLabel,
  zdEstimateExternalSessionCancelDialogCancelLabel,
  zdEstimateExternalSessionRestoredToastTitle,
  zdEstimateExternalSessionRestoredToastDescription,
  zdEstimateExternalSessionExpiredAlertTitle,
  zdEstimateExternalSessionExpiredAlertBody,
  zdEstimateExternalSessionRestoreFailedAlertTitle,
  zdEstimateExternalSessionRestoreFailedAlertBody,
  zdEstimateExternalSessionPersistFailedAlertTitle,
  zdEstimateExternalSessionPersistFailedAlertBody,
  zdEstimateExternalSessionAutorunConflictTitle,
  zdEstimateExternalSessionAutorunConflictMessage,
  zdEstimateExternalSessionAutorunResumeLabel,
  zdEstimateExternalSessionAutorunDiscardLabel,
  zdEstimateExternalSessionScopeChangeTitle,
  zdEstimateExternalSessionScopeChangeMessage,
  zdEstimateExternalSessionScopeChangeConfirmLabel,
  zdEstimateExternalSessionScopeChangeCancelLabel,
} from "@/lib/orders/zd-estimate-ui-copy";
import { shouldUseZdEstimateProgressShell } from "@/lib/orders/zd-estimate-progress-shell";
import { applyGroupStockWindow } from "@/lib/orders/zd-estimate-group-stock";
import {
  resolveZdEstimateActiveScopeLabel,
  resolveZdEstimateActiveSupplierName,
} from "@/lib/orders/zd-estimate-active-scope";
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
import { isZdEstimatePendingReview } from "@/lib/orders/zd-estimate-confidence-ui";
import {
  mapZdNameAutoExcludedByTwId,
  mergeZdEstimateExcludedTwIds,
} from "@/lib/orders/zd-estimate-name-exclude";
import {
  ZD_ESTIMATE_BULK_MAX,
} from "@/lib/orders/zd-estimate-bulk";
import {
  filterOrderableLinesWithPackaging,
  individualExtraPiecesForTw,
  isPackagingPackagesMode,
  lineAllowsZdDocumentUnitOverride,
  orderableLinesToTsv,
  packagingByTwId,
  packagingDocumentMode,
  packagingRowsToRefreshLookup,
  pruneZdDocumentUnitOverrides,
  resolveOrderQtyForLine,
  type PackagingLookup,
  type ZdEstimatePackagingRefreshEntry,
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
import {
  aggregateCreatedZdLineQtys,
  applyGlowneMarkResultToPostCreateSession,
  buildZdPostCreateMarkFreeze,
  buildZdPostCreateSessionFromCreate,
  buildZdPostCreateSessionFromLink,
  buildZdPostCreateSessionFromTimeout,
  confirmedPostCreateConsumedOrderIds,
  emptyZdPostCreateMarkFreeze,
  excludeConsumedPendingOrders,
  patchZdPostCreateTimeoutCandidates,
  postCreateLinkLineMeta,
  postCreateOrderableTwIds,
  reconcileMarkFreezeWithAcceptedIds,
  undoStubsFromMarkFreeze,
  type ZdPostCreateMarkFreeze,
  type ZdPostCreateSession,
} from "@/lib/orders/zd-estimate-post-create";
import {
  buildPairRatioByTwId,
  collectImplicitPieceSnapshotLines,
} from "@/lib/orders/zd-estimate-snapshot-lines";
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
import { ZdEstimateListToolsBar } from "@/components/zakupy/ZdEstimateListToolsBar";
import { ZdEstimateSelectionToolsReveal } from "@/components/zakupy/ZdEstimateSelectionToolsReveal";
import { ZdEstimateListBand } from "@/components/zakupy/ZdEstimateListBand";
import { ZdEstimateAlertBucket } from "@/components/zakupy/ZdEstimateAlertBucket";
import { ZdEstimatePinnedAlertStack } from "@/components/zakupy/ZdEstimatePinnedAlertStack";
import { ZdEstimateDepartmentSettingsMenu } from "@/components/zakupy/ZdEstimateDepartmentSettingsMenu";
import { ZdEstimateSuppliersMenu } from "@/components/zakupy/ZdEstimateSuppliersMenu";
import { ZdEstimateSnapshotsModal } from "@/components/zakupy/ZdEstimateSnapshotsModal";
import { ZdEstimateSettingsTrustBanner } from "@/components/zakupy/ZdEstimateSettingsTrustBanner";
import { UndoToast } from "@/components/ui/UndoToast";
import { Toast } from "@/components/ui/Toast";
import {
  filterZdEstimateLinesBySearch,
} from "@/lib/orders/zd-estimate-list-tools";
import {
  collectZdPackagingPairConflicts,
  formatZdPackagingPairConflictHint,
} from "@/lib/orders/zd-estimate-packaging-pair-conflict";
import {
  ZdEstimatePairPackStockCell,
  ZdEstimatePairPiecesCell,
  ZdEstimatePairSalesCell,
  ZdEstimatePiecesMetricCell,
} from "@/components/zakupy/ZdEstimatePairMetaBadge";
import { ZdEstimateDoZdCell } from "@/components/zakupy/ZdEstimateDoZdCell";
import { ZdEstimatePackagingCell } from "@/components/zakupy/ZdEstimatePackagingCell";
import { ZdEstimateNameMetaStack } from "@/components/zakupy/ZdEstimateNameMetaStack";
import { ZdEstimateQtyValue } from "@/components/zakupy/ZdEstimateQtyValue";
import { ZdEstimateIndividualServicesSection } from "@/components/zakupy/ZdEstimateIndividualServicesSection";
import { ZdEstimateBulkExcludeDialog } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";
import { ZdEstimateBulkPackagingDialog } from "@/components/zakupy/ZdEstimateBulkPackagingDialog";
import { ZdEstimateExcludeDialog } from "@/components/zakupy/ZdEstimateExcludeDialog";
import { ZdEstimateExclusionsModal } from "@/components/zakupy/ZdEstimateExclusionsModal";
import { ZdEstimateOnRequestModal } from "@/components/zakupy/ZdEstimateOnRequestModal";
import { ZdEstimateSupplierScopesModal } from "@/components/zakupy/ZdEstimateSupplierScopesModal";
import { ZdEstimateLinkZdDialog } from "@/components/zakupy/ZdEstimateLinkZdDialog";
import { ZdEstimateCreateZdDialog } from "@/components/zakupy/ZdEstimateCreateZdDialog";
import { ZdEstimatePostCreatePanel } from "@/components/zakupy/ZdEstimatePostCreatePanel";
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
import { ZdEstimateSessionResumeProgressPanel } from "@/components/zakupy/ZdEstimateSessionResumeProgressPanel";
import { ZdEstimateExternalSessionActiveChip } from "@/components/zakupy/ZdEstimateExternalSessionActiveChip";
import { ZdEstimatePageIntro } from "@/components/zakupy/ZdEstimatePageIntro";
import { ZdEstimatePrepScopeFacts } from "@/components/zakupy/ZdEstimatePrepScopeFacts";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { ZdEstimateRecountOverlay } from "@/components/zakupy/ZdEstimateRecountOverlay";
import { Alert } from "@/components/ui/Alert";
import {
  launchProgressMinRevealWaitMs,
  ZD_ESTIMATE_SESSION_RESUME_COMPLETE_TAIL_MS,
  ZD_ESTIMATE_SESSION_RESUME_MIN_VISIBLE_MS,
} from "@/lib/orders/zd-estimate-launch-progress";
import {
  clearZdEstimateExternalSessionResumeQueryParam,
  isZdEstimateExternalSessionReturnNavigation,
  shouldShowZdEstimateSessionResumeLoading,
} from "@/lib/orders/zd-estimate-external-session-resume";
import {
  scrollZdEstimateAfterSelectionChange,
  scrollZdEstimateIntoView,
  scrollZdEstimateWhenReady,
  scrollZdEstimateRevealListWhenReady,
  clampZdEstimateScrollSurfaces,
  clampZdEstimateTableScroll,
  resetZdEstimateTableScroll,
  syncZdEstimateFlexibleColumnStickyWidths,
  ZD_ESTIMATE_ASSIGN_FOCUS_ID,
  ZD_ESTIMATE_ERROR_FOCUS_ID,
  ZD_ESTIMATE_LAUNCH_FOCUS_ID,
  ZD_ESTIMATE_LIST_FOCUS_ID,
  ZD_ESTIMATE_POLICZ_CTA_ID,
  ZD_ESTIMATE_SELECTION_TOOLS_ID,
  ZD_ESTIMATE_SERVICES_FOCUS_ID,
  ZD_ESTIMATE_STICKY_ACTIONS_ID,
  ZD_ESTIMATE_SCROLL_END_ID,
  ZD_ESTIMATE_TABLE_SCROLL_ID,
} from "@/lib/orders/zd-estimate-launch-scroll";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
} from "@/components/ui/OverflowMenu";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconChartTrend,
  IconChevronDown,
  IconClipboardList,
  IconLayers,
  IconSearch,
  IconTarget,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  floatingToastAboveZdStickyClass,
  floatingToastAboveZdStickyTallClass,
} from "@/lib/ui/sales-mobile-chrome";
import {
  checkboxBrandClass,
  panelTypography,
  zdEstimateCardSurfaceClass,
  zdEstimateDockButtonClass,
  zdEstimateListBodyInsetClass,
  zdEstimateListBodyPadClass,
  zdEstimateNestedWellClass,
  zdEstimatePrepIdleBodyClass,
  zdEstimatePrepIdleFooterClass,
  zdEstimatePrepFormInsetXClass,
  zdEstimatePrepPrimaryButtonClass,
  zdEstimateRadiusNestedClass,
  zdEstimateShadowControlClass,
  zdEstimateSoftStatusStripClass,
  zdEstimateStickyBarClass,
  zdEstimateStickyClearanceClass,
  zdEstimateStickyClearanceTallClass,
  zdEstimateStickyDockClass,
  zdEstimateToolbarActionClass,
  zdEstimateToolbarMenuClass,
  zdEstimateWorkbenchStackClass,
} from "@/lib/ui/ontime-theme";

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
  onRequestsError: string | null;
  packagingError: string | null;
  productPairsError: string | null;
  productBomsError: string | null;
  teethProductsError: string | null;
}): string {
  const parts = [
    input.exclusionsError ? `wykluczenia (${input.exclusionsError})` : null,
    input.onRequestsError
      ? `tylko na prośbę (${input.onRequestsError})`
      : null,
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
  onRequests: ZdEstimateOnRequestRow[];
  onRequestsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
  productPairs: ZdProductPairRow[];
  productPairsError: string | null;
  productBoms: ZdProductBomRow[];
  productBomsError: string | null;
  teethTwIds: number[];
  teethProductsError: string | null;
  uiPrefs?: ZdEstimateUiPrefs;
  extrasPolicy?: ZdEstimateExtrasPolicy;
  todayScopeCoverage?: ZdEstimateScopeCoverage;
};

type RunMeta = {
  pagesFetched: number;
  totalCountApi: number;
  truncated: boolean;
  ordersBaseUrl: string;
  durationMs: number;
  totalFromSubiekt: number;
};

type ListFilter = ZdEstimateListFilter;

const ZD_ESTIMATE_EXTERNAL_SESSION_PERSIST_DEBOUNCE_MS = 600;

import { deleteZdEstimateExternalSessionRecord } from "@/lib/orders/zd-estimate-external-session-actions";

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

export function ZdEstimateWorkbench({
  bootstrap,
  launch = null,
}: {
  bootstrap: Bootstrap;
  launch?: ZdEstimateLaunchProps | null;
}) {
  const uiPrefs = bootstrap.uiPrefs ?? ZD_ESTIMATE_UI_PREFS_DEFAULTS;
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
  /** Gdy odtwarzamy snapshot sesji, nie nadpisuj jej re-fetchem próśb po supplierId. */
  const skipPendingIndividualsFetchRef = useRef(false);
  /** Opóźniony reveal sukcesu — min. czas widoczności checklisty. */
  const launchRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const runEstimateRef = useRef<
    (opts?: {
      fromLaunch?: boolean;
      mode?: ZdEstimateRunMode;
      grupaId?: number;
      cechaId?: number;
    }) => void
  >(() => {});

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
        prefsDniZapasu: uiPrefs.dniZapasu,
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
      prefsDniZapasu: uiPrefs.dniZapasu,
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
  const [zapasMin, setZapasMin] = useState(String(uiPrefs.zapasMin));
  const [showAdvanced, setShowAdvanced] = useState(uiPrefs.showAdvanced);
  const [prepCollapsed, setPrepCollapsed] = useState(false);
  const [launchReadyMessage, setLaunchReadyMessage] = useState<string | null>(
    null
  );
  /** Reveal scroll tylko raz na toast „Lista gotowa” (nie przy każdym setLines). */
  const launchRevealDoneRef = useRef(false);
  /** EmptyState „Brak listy” tylko po nieudanym Policz. */
  const [lastEstimateFailed, setLastEstimateFailed] = useState(false);
  /** Po clear wyniku przez zmianę zakresu — hint w prep zamiast EmptyState. */
  const [scopeNeedsRecount, setScopeNeedsRecount] = useState(false);
  /** Moc boosta zmieniona po Policz — lista Do ZD nieaktualna. */
  const [boostNeedsRecount, setBoostNeedsRecount] = useState(false);
  /** Kwalifikacja snapshotów do history cut zmieniona — lista Do ZD nieaktualna. */
  const [historyNeedsRecount, setHistoryNeedsRecount] = useState(false);
  /** Fetch historii przy Policz rzucił — cięcia mogły nie wejść. */
  const [historyFetchFailed, setHistoryFetchFailed] = useState(false);
  const [extrasPolicy, setExtrasPolicy] = useState<ZdEstimateExtrasPolicy>(
    bootstrap.extrasPolicy ?? "sum"
  );
  const [todayCoverage, setTodayCoverage] = useState<ZdEstimateScopeCoverage>(
    bootstrap.todayScopeCoverage ??
      zdEstimateScopeCoverage([], [])
  );
  const [acceptedReviewTwIds, setAcceptedReviewTwIds] = useState<
    Record<number, true>
  >({});
  const [snapshotsPanelOpen, setSnapshotsPanelOpen] = useState(false);
  /** Zapisany w app_settings (radio). */
  const [boostPreset, setBoostPreset] = useState<ZdBoostPowerPreset>(
    ZD_BOOST_POWER_DEFAULT
  );
  /** Preset użyty przy ostatnim Policz / live remat (do dirty A→B→A). */
  const [appliedBoostPreset, setAppliedBoostPreset] =
    useState<ZdBoostPowerPreset>(ZD_BOOST_POWER_DEFAULT);
  /**
   * Policy użyty przy ostatnim Policz / live remat.
   * Po zmianie presetu zostaje stary do re-Policz (nie resetuje Do ZD do nowego).
   */
  const [appliedBoostPolicy, setAppliedBoostPolicy] = useState(() =>
    policyForBoostPreset(ZD_BOOST_POWER_DEFAULT)
  );
  const [scopesPanelOpen, setScopesPanelOpen] = useState(false);
  /** Remap zakresu gdy mapping już istnieje (oddzielny od pierwszego assign). */
  const [scopeRemapActive, setScopeRemapActive] = useState(false);
  /** Krótki status po re-Policz (nie mylić z settingsLiveMessage). */
  const [recountStatusMessage, setRecountStatusMessage] = useState<string | null>(
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
    launchRevealDoneRef.current = false;
    return started;
  }, []);
  const [columns, setColumns] = useState<ZdEstimateColumnVisibility>(
    () => ({ ...uiPrefs.columns })
  );
  const [columnOrder, setColumnOrder] = useState<ZdEstimateOptionalColumn[]>(
    () => [...uiPrefs.columnOrder]
  );
  const showStockDetail = columns.stock;
  const showZkColumn = columns.zk;
  const showPackagingColumn = columns.packaging;
  const visibleOptionalColumns = useMemo(
    () => resolveZdEstimateScrollableColumnOrder(columns, columnOrder),
    [columns, columnOrder]
  );
  const optionalColumnSectionStarts = useMemo(
    () => resolveZdEstimateColumnSectionStarts(visibleOptionalColumns),
    [visibleOptionalColumns]
  );
  const flowColumnClass = (col: ZdEstimateOptionalColumn) =>
    col === "available" ||
    col === "sales" ||
    col === "target" ||
    col === "openZd"
      ? "zd-estimate-col--flow"
      : null;
  const columnsAreDefault =
    zdEstimateColumnVisibilityEqual(
      columns,
      ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS
    ) &&
    zdEstimateColumnOrderEqual(columnOrder, ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS);
  const toggleColumn = useCallback((key: ZdEstimateOptionalColumn) => {
    setColumns((prev) => toggleZdEstimateColumnVisibility(prev, key));
  }, []);
  const moveColumn = useCallback(
    (key: ZdEstimateOptionalColumn, direction: "up" | "down") => {
      setColumnOrder((prev) => moveZdEstimateColumnOrder(prev, key, direction));
    },
    []
  );
  const resetColumns = useCallback(() => {
    setColumns({ ...ZD_ESTIMATE_COLUMN_VISIBILITY_DEFAULTS });
    setColumnOrder([...ZD_ESTIMATE_COLUMN_ORDER_DEFAULTS]);
  }, []);
  const [listFilter, setListFilter] = useState<ListFilter>(uiPrefs.listFilter);
  const [listSearch, setListSearch] = useState("");
  const [sortKey, setSortKey] = useState<ZdEstimateListSortKey>(uiPrefs.sortKey);
  const [sortDir, setSortDir] = useState<ZdEstimateListSortDir>(uiPrefs.sortDir);
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (!launch?.autorun || launch.needsAssign) return null;
    if (!bootstrap.configured) return null;
    if (!launchHasRunnableScope(launch)) {
      return "Brak zakresu Subiekta do automatycznego uruchomienia kreatora.";
    }
    const trusted =
      bootstrap.exclusionsError == null &&
      bootstrap.onRequestsError == null &&
      bootstrap.packagingError == null &&
      bootstrap.productPairsError == null &&
      bootstrap.productBomsError == null &&
      bootstrap.teethProductsError == null;
    if (trusted) return null;
    return settingsTrustFailMessage({
      exclusionsError: bootstrap.exclusionsError,
      onRequestsError: bootstrap.onRequestsError,
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
  const [postCreate, setPostCreate] = useState<ZdPostCreateSession | null>(
    null
  );
  const [createZdOpen, setCreateZdOpen] = useState(false);
  const [createDoneDokId, setCreateDoneDokId] = useState<number | null>(null);
  const [createDoneDokNr, setCreateDoneDokNr] = useState<string | null>(null);
  /** Timeout create — lock bez dokId (dokument mógł powstać). */
  const [createUnconfirmedAttempt, setCreateUnconfirmedAttempt] =
    useState(false);
  const [creatingZd, setCreatingZd] = useState(false);
  /** Preview zamrożony przy starcie create — timeout / sesja / UI dialogu. */
  const createPreviewCaptureRef = useRef<ReturnType<
    typeof buildZdCreatePreviewFromOrderable
  > | null>(null);
  const [createPreviewFrozen, setCreatePreviewFrozen] = useState<ReturnType<
    typeof buildZdCreatePreviewFromOrderable
  > | null>(null);
  const createLineMetaCaptureRef = useRef<
    { twId: number; celAtLink: number; deltaAtLink: number }[] | null
  >(null);
  const createMarkFreezeCaptureRef = useRef<ZdPostCreateMarkFreeze | null>(
    null
  );
  /**
   * Freeze z timeout create — przeżywa dismiss panelu, aż do link / unlock / Policz.
   * Bez tego „Powiąż ZD” po zamknięciu panelu traci submit freeze + durable consume.
   */
  const timeoutRecoveryFreezeRef = useRef<ZdPostCreateMarkFreeze | null>(null);
  /** Mirror ref → state, żeby dialog nie czytał ref podczas renderu. */
  const [createMarkFreezeFrozen, setCreateMarkFreezeFrozen] =
    useState<ZdPostCreateMarkFreeze | null>(null);
  const [consumedOnThisZdIds, setConsumedOnThisZdIds] = useState<string[]>(
    []
  );
  const glowneRemovedForUndoRef = useRef<ZdEstimatePendingIndividualOrder[]>(
    []
  );
  /** ID ostatniej paczki Główne — undo nigdy nie cofa całego glowneMarkedIds. */
  const glowneUndoOrderIdsRef = useRef<string[]>([]);
  const rememberConsumedOrderIds = (ids: readonly string[]) => {
    if (!ids.length) return;
    setConsumedOnThisZdIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        const trimmed = String(id ?? "").trim();
        if (trimmed) next.add(trimmed);
      }
      return next.size === prev.length ? prev : [...next];
    });
  };
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
  const [onRequests, setOnRequests] = useState<ZdEstimateOnRequestRow[]>(
    bootstrap.onRequests ?? []
  );
  const [onRequestsError, setOnRequestsError] = useState<string | null>(
    bootstrap.onRequestsError ?? null
  );
  const [onRequestPanelOpen, setOnRequestPanelOpen] = useState(false);
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
  const [missingPartnerTwIds, setMissingPartnerTwIds] = useState<number[]>([]);
  const pairPartnerMissingCount = missingPartnerTwIds.length;
  const [bomsOpen, setBomsOpen] = useState(false);
  const [bomSeed, setBomSeed] = useState<readonly ZdBomSeedProduct[] | null>(
    null
  );
  const [missingBomTwIds, setMissingBomTwIds] = useState<number[]>([]);
  const bomMissingCount = missingBomTwIds.length;
  const [createUnlockedAfterDone, setCreateUnlockedAfterDone] = useState(false);
  const [qtyOverrideByTwId, setQtyOverrideByTwId] = useState<Record<number, number>>({});
  const [sessionIncludeTwIds, setSessionIncludeTwIds] = useState<Record<number, true>>({});
  const [createUndoVisible, setCreateUndoVisible] = useState(false);
  const selectAnchorTwIdRef = useRef<number | null>(null);
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
  const [cancelExternalSessionOpen, setCancelExternalSessionOpen] =
    useState(false);
  const cancelExternalSessionSessionIdRef = useRef<string | null>(null);
  const externalSessionIdRef = useRef<string | null>(null);
  const externalSessionRestoreGenRef = useRef(0);
  const externalSessionPersistTimerRef = useRef<number | null>(null);
  const externalSessionPersistInFlightRef = useRef(false);
  const externalSessionPersistQueuedRef = useRef(false);
  const externalSessionCreatedAtRef = useRef<string | null>(null);
  const externalSessionPersistSkipRef = useRef(false);
  const externalSessionRestoredRef = useRef(false);
  const flushExternalSessionPersistRef = useRef<() => Promise<void>>(
    async () => undefined
  );
  const scheduleExternalSessionPersistRef = useRef<() => void>(() => undefined);
  const externalSessionAutorunPendingRef = useRef<{
    mode: ZdEstimateRunMode;
    grupaId?: number;
    cechaId?: number;
    launchKey: string;
  } | null>(null);
  const externalSessionAutorunBlockedRef = useRef(false);
  const scopeChangePendingActionRef = useRef<(() => void) | null>(null);
  const [externalSessionTokenState, setExternalSessionTokenState] =
    useState<ReturnType<typeof peekZdEstimateExternalSessionToken>>(null);
  const [externalSessionRestoredToast, setExternalSessionRestoredToast] =
    useState<string | null>(null);
  const [externalSessionExpiredAlert, setExternalSessionExpiredAlert] =
    useState(false);
  const [externalSessionRestoreFailedAlert, setExternalSessionRestoreFailedAlert] =
    useState(false);
  const [externalSessionPersistFailedAlert, setExternalSessionPersistFailedAlert] =
    useState(false);
  const [externalSessionAutorunConflictOpen, setExternalSessionAutorunConflictOpen] =
    useState(false);
  const [externalSessionScopeChangeOpen, setExternalSessionScopeChangeOpen] =
    useState(false);
  const sessionResumeStartedAtMsRef = useRef(Date.now());
  const sessionResumeRevealTimerRef = useRef<number | null>(null);
  const pendingRestoredToastRef = useRef<string | null>(null);
  /** Blokuje formularz zakresu do czasu restore (także cichego refreshu z tokenem). */
  const [sessionRestorePending, setSessionRestorePending] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(peekZdEstimateExternalSessionToken());
  });
  const [sessionResumeBlocking, setSessionResumeBlocking] = useState(() => {
    if (typeof window === "undefined") return false;
    const token = peekZdEstimateExternalSessionToken();
    if (!token) return false;
    return shouldShowZdEstimateSessionResumeLoading({ token });
  });
  const [sessionResumeForceComplete, setSessionResumeForceComplete] =
    useState(false);
  const [sessionResumeReturningFromAway, setSessionResumeReturningFromAway] =
    useState(() => {
      if (typeof window === "undefined") return false;
      return isZdEstimateExternalSessionReturnNavigation(
        peekZdEstimateExternalSessionToken()
      );
    });
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const prevSelectedCountRef = useRef(0);
  const selectedCountLiveRef = useRef(0);
  const selectionScrollTwIdRef = useRef<number | null>(null);
  /** Pomija scroll przy programmatic clear (Policz / zmiana zakresu). */
  const skipSelectionScrollRef = useRef(false);

  const resetSelectionQuiet = useCallback(() => {
    selectionScrollTwIdRef.current = null;
    setSelected((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      skipSelectionScrollRef.current = true;
      return {};
    });
  }, []);

  const busy = estimating || searching || mutating;
  const exclusionsTrusted = exclusionsError == null;
  const onRequestTrusted = onRequestsError == null;
  const packagingTrusted = packagingError == null;
  const pairsTrusted = productPairsError == null;
  const bomsTrusted = productBomsError == null;
  const teethTrusted = teethProductsError == null;
  const settingsTrusted =
    exclusionsTrusted &&
    onRequestTrusted &&
    packagingTrusted &&
    pairsTrusted &&
    bomsTrusted &&
    teethTrusted;

  /** „Odznacz” z UI — bez skoku viewportu (jak programmatic clear). */
  const clearSelection = resetSelectionQuiet;
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

  /**
   * Po bulk „Na prośbę” succeeded może być packTwId (retarget),
   * a zaznaczenie trzyma piece — czyść oba końce pary + oryginał.
   */
  const clearBulkOnRequestSelection = useCallback(
    (succeededTwIds: number[], submittedTwIds: number[]) => {
      const succeeded = new Set(succeededTwIds);
      const clearIds = new Set<number>(succeededTwIds);
      for (const twId of submittedTwIds) {
        const packId = retargetTwIdToPackIfPiece(twId, productPairs).twId;
        if (succeeded.has(twId) || succeeded.has(packId)) {
          clearIds.add(twId);
          clearIds.add(packId);
        }
      }
      clearSucceededFromSelection([...clearIds]);
    },
    [productPairs, clearSucceededFromSelection]
  );

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
    setErrorMessage(userFacingErrorTextFromMessage(message));
  }, []);

  const flashSettingsLive = useCallback((message: string) => {
    setSettingsLiveMessage(message);
    window.setTimeout(() => {
      setSettingsLiveMessage((cur) => (cur === message ? null : cur));
    }, 3200);
  }, []);

  const prefsSkipSaveRef = useRef(true);
  /**
   * Tylko ręczna zmiana „Dni zapasu” trafia do prefs.
   * Trzymamy ostatnią wartość użytkownika — nie aktualnego pola (to może być zapas z grupy/Dziś).
   */
  const dniZapasuTouchedForPrefsRef = useRef(false);
  const dniZapasuPrefsValueRef = useRef<number | null>(uiPrefs.dniZapasu);
  const prefsSaveTimerRef = useRef<number | null>(null);
  const prefsDirtyRef = useRef(false);
  const prefsPayloadRef = useRef<{
    zapasMin: number;
    showAdvanced: boolean;
    columns: ZdEstimateColumnVisibility;
    columnOrder: ZdEstimateOptionalColumn[];
    listFilter: ListFilter;
    sortKey: ZdEstimateListSortKey;
    sortDir: ZdEstimateListSortDir;
    dniZapasu?: number | null;
  }>({
    zapasMin: Number(zapasMin) || 0,
    showAdvanced,
    columns,
    columnOrder,
    listFilter,
    sortKey,
    sortDir,
  });
  const prefsLastSavedFingerprintRef = useRef(
    JSON.stringify({
      zapasMin: uiPrefs.zapasMin,
      showAdvanced: uiPrefs.showAdvanced,
      columns: uiPrefs.columns,
      columnOrder: uiPrefs.columnOrder,
      listFilter: uiPrefs.listFilter,
      sortKey: uiPrefs.sortKey,
      sortDir: uiPrefs.sortDir,
      dniZapasu: "__omit__",
    })
  );

  const flushZdEstimateUiPrefsSave = useCallback(() => {
    if (prefsSkipSaveRef.current) return;
    if (!prefsDirtyRef.current) return;
    if (prefsSaveTimerRef.current != null) {
      window.clearTimeout(prefsSaveTimerRef.current);
      prefsSaveTimerRef.current = null;
    }
    const patch = {
      zapasMin: prefsPayloadRef.current.zapasMin,
      showAdvanced: prefsPayloadRef.current.showAdvanced,
      columns: { ...prefsPayloadRef.current.columns },
      columnOrder: [...prefsPayloadRef.current.columnOrder],
      listFilter: prefsPayloadRef.current.listFilter,
      sortKey: prefsPayloadRef.current.sortKey,
      sortDir: prefsPayloadRef.current.sortDir,
      ...(prefsPayloadRef.current.dniZapasu !== undefined
        ? { dniZapasu: prefsPayloadRef.current.dniZapasu }
        : {}),
    };
    const fingerprint = JSON.stringify({
      zapasMin: patch.zapasMin,
      showAdvanced: patch.showAdvanced,
      columns: patch.columns,
      columnOrder: patch.columnOrder,
      listFilter: patch.listFilter,
      sortKey: patch.sortKey,
      sortDir: patch.sortDir,
      dniZapasu: "dniZapasu" in patch ? patch.dniZapasu : "__omit__",
    });
    if (fingerprint === prefsLastSavedFingerprintRef.current) {
      prefsDirtyRef.current = false;
      return;
    }
    prefsDirtyRef.current = false;
    void actionSaveZdEstimateUiPrefs({ patch }).then((res) => {
      if (!res.ok) {
        prefsDirtyRef.current = true;
        flashSettingsLive(
          res.message || "Nie udało się zapisać układu kolumn."
        );
        return;
      }
      prefsLastSavedFingerprintRef.current = fingerprint;
    });
  }, [flashSettingsLive]);

  useEffect(() => {
    prefsPayloadRef.current = {
      zapasMin: Number(zapasMin) || 0,
      showAdvanced,
      columns: { ...columns },
      columnOrder: [...columnOrder],
      listFilter,
      sortKey,
      sortDir,
      ...(dniZapasuTouchedForPrefsRef.current
        ? { dniZapasu: dniZapasuPrefsValueRef.current }
        : {}),
    };
    if (prefsSkipSaveRef.current) {
      prefsSkipSaveRef.current = false;
      return;
    }
    prefsDirtyRef.current = true;
    if (prefsSaveTimerRef.current != null) {
      window.clearTimeout(prefsSaveTimerRef.current);
    }
    prefsSaveTimerRef.current = window.setTimeout(() => {
      prefsSaveTimerRef.current = null;
      flushZdEstimateUiPrefsSave();
    }, 600);
    return () => {
      if (prefsSaveTimerRef.current != null) {
        window.clearTimeout(prefsSaveTimerRef.current);
        prefsSaveTimerRef.current = null;
      }
    };
  }, [
    zapasMin,
    showAdvanced,
    columns,
    columnOrder,
    listFilter,
    sortKey,
    sortDir,
    dniZapasu,
    flushZdEstimateUiPrefsSave,
  ]);

  // Flush przy wyjściu / ukryciu karty — debounce 600 ms nie może zgubić kolumn.
  useEffect(() => {
    const onHide = () => {
      flushZdEstimateUiPrefsSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushZdEstimateUiPrefsSave();
    };
  }, [flushZdEstimateUiPrefsSave]);

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

  const onRequestTwIds = useMemo(
    () =>
      onRequestTrusted
        ? onRequestTwIdSet(onRequests, productPairs)
        : new Set<number>(),
    [onRequests, onRequestTrusted, productPairs]
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

  /**
   * Hard exclude: DB ∪ auto z nazwy ∪ zęby − session include
   * (session nie zdejmuje „tylko na prośbę”).
   */
  const hardBase = useMemo(() => {
    const db = exclusionsTrusted ? [...dbExcludedIds] : [];
    let base: Set<number>;
    if (!lines) {
      base = new Set(db);
      if (teethTrusted) for (const id of teethTwIdSet) base.add(id);
    } else {
      base = mergeZdEstimateExcludedTwIds(lines, db, {
        teethTwIds: teethTrusted ? teethTwIdSet : null,
      });
    }
    const sessionOk = filterSessionIncludeRespectingOnRequest(
      sessionIncludeTwIds,
      onRequestTwIds
    );
    for (const id of sessionOk) base.delete(id);
    return base;
  }, [
    lines,
    dbExcludedIds,
    exclusionsTrusted,
    teethTwIdSet,
    teethTrusted,
    sessionIncludeTwIds,
    onRequestTwIds,
  ]);

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

  const packagingByTwIdForRefresh = useMemo(
    () => packagingRowsToRefreshLookup(packaging),
    [packaging]
  );

  useEffect(() => {
    let cancelled = false;
    void actionGetZdBoostPowerPreset().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setFeedback(null);
        setErrorMessage(userFacingErrorTextFromMessage(res.message));
        return;
      }
      setBoostPreset(res.preset);
      setAppliedBoostPreset(res.preset);
      // Przed pierwszym Policz trzymaj applied = zapisany (gentle default).
      setAppliedBoostPolicy(policyForBoostPreset(res.preset));
      setBoostNeedsRecount(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reapplyPairsToLines = useCallback(
    (
      nextPairs: readonly ZdProductPairRef[],
      nextBoms: readonly ZdProductBomRow[] = productBoms,
      packagingLookup:
        | ReadonlyMap<number, ZdEstimatePackagingRefreshEntry>
        | null
        | undefined = packagingByTwIdForRefresh
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
            packagingByTwId: packagingLookup ?? packagingByTwIdForRefresh,
            historyByTwId:
              historyByTwId.size > 0 ? historyByTwId : null,
            salesTrackPolicy: appliedBoostPolicy,
          },
        });
      setLines(nextLines);
      setMissingPartnerTwIds(missingPartnerTwIds);
      setMissingBomTwIds(missingBomTwIds);
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
      appliedBoostPolicy,
    ]
  );

  const canAutoRecount =
    Boolean(linesBase?.length) &&
    ((scopeMode === "grupa" && selectedGroup?.grt_Id) ||
      (scopeMode === "cecha" && selectedCecha?.ctw_Id));

  const recountEstimateLinesWithExcluded = useCallback(
    (excludedTwIds: ReadonlySet<number>) => {
      if (!linesBase?.length) return;
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
            excludedTwIds,
            packagingByTwId: packagingByTwIdForRefresh,
            historyByTwId: historyByTwId.size > 0 ? historyByTwId : null,
            salesTrackPolicy: appliedBoostPolicy,
          },
        });
      setLines(nextLines);
      setMissingPartnerTwIds(missingPartnerTwIds);
      setMissingBomTwIds(missingBomTwIds);
    },
    [
      linesBase,
      productPairs,
      productBoms,
      dniZapasu,
      paramInfo,
      zapasMin,
      packagingByTwIdForRefresh,
      historyByTwId,
      appliedBoostPolicy,
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

  const setSessionIncludeTwId = useCallback(
    (twId: number, include: boolean) => {
      const next = { ...sessionIncludeTwIds };
      if (include) next[twId] = true;
      else delete next[twId];
      setSessionIncludeTwIds(next);
      recountEstimateLinesWithExcluded(
        buildExcludedIdsForSessionIncludes(next)
      );
    },
    [
      sessionIncludeTwIds,
      recountEstimateLinesWithExcluded,
      buildExcludedIdsForSessionIncludes,
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
    ]
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
      });
    }
    for (const pair of productPairs) {
      const existing = map.get(pair.packTwId);
      map.set(pair.packTwId, {
        unitsPerPackage: pair.unitsPerPack,
        packageLabel: existing?.packageLabel ?? "op.",
        documentUnitMode: "packages",
      });
    }
    return map;
  }, [packaging, productPairs]);

  const extrasConsumedOrderIds = useMemo(
    () => [
      ...new Set([
        ...consumedOnThisZdIds,
        ...confirmedPostCreateConsumedOrderIds(postCreate),
      ]),
    ],
    [consumedOnThisZdIds, postCreate]
  );

  const pendingForExtras = useMemo(
    () =>
      excludeConsumedPendingOrders(
        pendingIndividuals,
        extrasConsumedOrderIds
      ),
    [pendingIndividuals, extrasConsumedOrderIds]
  );

  const catalogExtrasBundle = useMemo(() => {
    const mikranByTw = buildMikranByTwFromEstimateLines(lines ?? []);
    const presentTwIds = new Set((lines ?? []).map((l) => l.tw_Id));
    const raw = buildIndividualEstimateExtras({
      orders: pendingForExtras,
      lines: lines ?? [],
      pairs: productPairs,
      boms: bomRowsToRefs(productBoms),
      teethTwIds,
      mikranByTw,
    });
    return reclassifyMissingTwExtrasToServices(raw, presentTwIds);
  }, [
    pendingForExtras,
    lines,
    productPairs,
    productBoms,
    teethTwIds,
  ]);

  const pendingIndividualsTrusted = pendingIndividualsError == null;

  /** Lift: on-request z dodatnią rezerwą — tylko gdy prośby zaufane (fail-closed). */
  const extraOnlyTwIds = useMemo(() => {
    if (!pendingIndividualsTrusted) return new Set<number>();
    return buildExtraOnlyTwIds(
      onRequestTwIds,
      individualExtraPiecesMap(catalogExtrasBundle)
    );
  }, [pendingIndividualsTrusted, onRequestTwIds, catalogExtrasBundle]);

  const orderExcludedTwIds = useMemo(
    () =>
      buildOrderExcludedTwIds(hardBase, onRequestTwIds, extraOnlyTwIds),
    [hardBase, onRequestTwIds, extraOnlyTwIds]
  );

  /** To samo co orderExcluded — nigdy extraOnly. */
  const reclassifyExcludedTwIds = orderExcludedTwIds;

  const individualBundle = useMemo(
    () =>
      reclassifyExcludedTwExtrasToServices(
        catalogExtrasBundle,
        reclassifyExcludedTwIds
      ),
    [catalogExtrasBundle, reclassifyExcludedTwIds]
  );

  const kitOnlyBlockedAlertCount = useMemo(() => {
    if (!lines?.length && individualBundle.serviceLines.length === 0) return 0;
    const blockedTwIds = new Set<number>();
    for (const l of lines ?? []) {
      if (l.bom?.purchaseBlocked !== true) continue;
      const sales = Math.max(0, Number(l.sprzedazOkres) || 0);
      if (sales > 0) blockedTwIds.add(l.tw_Id);
    }
    let serviceHits = 0;
    for (const s of individualBundle.serviceLines) {
      if (s.reason !== "bom_component_not_purchased") continue;
      serviceHits += 1;
    }
    return blockedTwIds.size + serviceHits;
  }, [lines, individualBundle.serviceLines]);

  const explodeBomIncomplete = useMemo(
    () =>
      hasUnresolvedExplodeBomNodes(
        bomRowsToRefs(productBoms),
        missingBomTwIds
      ),
    [productBoms, missingBomTwIds]
  );

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
        reclassifyExcludedTwIds
      ),
    [individualBundle.byTwId, reclassifyExcludedTwIds]
  );

  // Synchronizuj nadpisania ze stanem — bez „wskrzeszania” po zmianie opakowania.
  if (lines && settingsTrusted && Object.keys(qtyOverrideByTwId).length > 0) {
    const pruned = pruneZdDocumentUnitOverrides(
      qtyOverrideByTwId,
      lines,
      packagingLookup,
      individualExtraByTwId,
      extraOnlyTwIds,
      extrasPolicy
    );
    if (pruned !== qtyOverrideByTwId) {
      setQtyOverrideByTwId(pruned);
    }
  }

  const qtyOverrideMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const [k, v] of Object.entries(qtyOverrideByTwId)) {
      m.set(Number(k), v);
    }
    return m;
  }, [qtyOverrideByTwId]);

  const orderableLines = useMemo(() => {
    if (!lines || !settingsTrusted) return [];
    if (explodeBomIncomplete) return [];
    return filterOrderableLinesWithPackaging(
      lines,
      packagingLookup,
      orderExcludedTwIds,
      individualExtraByTwId,
      qtyOverrideMap,
      extraOnlyTwIds,
      extrasPolicy
    );
  }, [
    lines,
    packagingLookup,
    orderExcludedTwIds,
    settingsTrusted,
    explodeBomIncomplete,
    individualExtraByTwId,
    qtyOverrideMap,
    extraOnlyTwIds,
    extrasPolicy,
  ]);

  const packagingPairConflicts = useMemo(
    () =>
      lines
        ? collectZdPackagingPairConflicts(
            lines,
            packagingMap,
            orderExcludedTwIds
          )
        : [],
    [lines, packagingMap, orderExcludedTwIds]
  );

  const createZdPreview = useMemo(
    () =>
      buildZdCreatePreviewFromOrderable(
        orderableLines,
        packagingLookup,
        individualExtraByTwId,
        qtyOverrideMap,
        extraOnlyTwIds,
        extrasPolicy
      ),
    [
      orderableLines,
      packagingLookup,
      individualExtraByTwId,
      qtyOverrideMap,
      extraOnlyTwIds,
      extrasPolicy,
    ]
  );

  const packagingByTwIdForSnapshot = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of packaging) {
      map.set(row.subiektTwId, row.unitsPerPackage);
    }
    return map;
  }, [packaging]);

  const pairRatioByTwIdForSnapshot = useMemo(
    () => buildPairRatioByTwId(productPairs),
    [productPairs]
  );

  const createDialogPreview = createPreviewFrozen ?? createZdPreview;

  const confirmedTwIdsForSnapshot = useMemo(
    () => createDialogPreview.lines.map((l) => l.twId),
    [createDialogPreview.lines]
  );

  const implicitPieceSnapshotLines = useMemo(() => {
    if (!settingsTrusted || !createDialogPreview.lineCount) return [];
    return collectImplicitPieceSnapshotLines(
      createDialogPreview.lines.map((l) => ({
        twId: l.twId,
        symbol: l.symbol,
        nazwa: l.nazwa,
      })),
      packagingByTwIdForSnapshot,
      pairRatioByTwIdForSnapshot
    );
  }, [
    settingsTrusted,
    createDialogPreview.lines,
    createDialogPreview.lineCount,
    packagingByTwIdForSnapshot,
    pairRatioByTwIdForSnapshot,
  ]);

  const implicitPieceSnapshotNotice = useMemo(
    () => buildImplicitPieceSnapshotNotice(implicitPieceSnapshotLines),
    [implicitPieceSnapshotLines]
  );

  const createZdGate = useMemo(
    () =>
      canCreateZdFromEstimateState({
        configured: bootstrap.configured,
        settingsTrusted,
        orderableCount: createZdPreview.lineCount,
        supplierId,
        khResolution: createKhResolution,
        estimating,
        mutating,
        creating: creatingZd,
        createDoneDokId,
        createUnconfirmedAttempt,
        createUnlockedAfterDone,
        packagingPairConflictCount: packagingPairConflicts.length,
        explodeBomIncomplete,
        boostNeedsRecount,
        historyNeedsRecount,
        historyFetchFailed,
        pendingIndividualsError,
        pendingIndividualsTruncated,
        pendingIndividualsLoading: Boolean(supplierId && pendingIndividualsLoading),
      }),
    [
      bootstrap.configured,
      settingsTrusted,
      createZdPreview.lineCount,
      supplierId,
      createKhResolution,
      estimating,
      mutating,
      creatingZd,
      createDoneDokId,
      createUnconfirmedAttempt,
      createUnlockedAfterDone,
      packagingPairConflicts.length,
      explodeBomIncomplete,
      boostNeedsRecount,
      historyNeedsRecount,
      historyFetchFailed,
      pendingIndividualsError,
      pendingIndividualsTruncated,
      pendingIndividualsLoading,
    ]
  );

  const createBaseUwagi = useMemo(() => {
    const label =
      scopeMode === "grupa"
        ? selectedGroup?.grt_Nazwa ?? null
        : selectedCecha?.ctw_Nazwa ?? null;
    return defaultZdCreateUwagi({
      scopeMode,
      scopeLabel: label,
      dateKey: bootstrap.todayKey,
    });
  }, [
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

  const createServiceOrderIdsMarkPreview = useMemo(
    () => createUwagiWithServices.includedServiceOrderIds,
    [createUwagiWithServices.includedServiceOrderIds]
  );

  const createMarkFreeze = useMemo(
    () =>
      buildZdPostCreateMarkFreeze({
        catalogOrderIds: createCatalogOrderIds,
        includedServiceOrderIds: createServiceOrderIdsMarkPreview,
        omittedServiceCount: createUwagiWithServices.omittedServiceCount,
        serviceLines: individualBundle.serviceLines,
        catalogByTwId: individualBundle.byTwId,
      }),
    [
      createCatalogOrderIds,
      createServiceOrderIdsMarkPreview,
      createUwagiWithServices.omittedServiceCount,
      individualBundle.serviceLines,
      individualBundle.byTwId,
    ]
  );

  const excludedInGroupCount = useMemo(() => {
    if (!lines) return 0;
    // Soft on-request + hard + auto; lifted (extraOnly) nie liczy się jako wykluczone.
    return lines.filter((l) => orderExcludedTwIds.has(l.tw_Id)).length;
  }, [lines, orderExcludedTwIds]);

  const scopeSelected =
    scopeMode === "grupa" ? selectedGroup != null : selectedCecha != null;
  const canPolicz =
    bootstrap.configured && scopeSelected && settingsTrusted;
  /** Karta zakresu otwarta (start albo Zmień zakres) — ten sam czytelny formularz. */
  const prepFormOpen =
    !sessionRestorePending && (!lines || !prepCollapsed);
  const activeScopeLabel = resolveZdEstimateActiveScopeLabel({
    scopeMode,
    selectedGroupName: selectedGroup?.grt_Nazwa,
    selectedCechaName: selectedCecha?.ctw_Nazwa,
    launchMode: launch?.mode,
    launchLabel: launch?.label,
  });
  const activeSupplierName = resolveZdEstimateActiveSupplierName({
    selectedSupplierName: selectedSupplier?.name,
    launchSupplierName: launch?.supplierName,
  });
  const scopeLabel = activeScopeLabel;
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

  const syncExternalSessionTokenState = useCallback(() => {
    setExternalSessionTokenState(peekZdEstimateExternalSessionToken());
  }, []);

  const finishSessionResumeReveal = useCallback(
    (
      ok: boolean,
      opts?: { linesReady?: boolean; restoreGen?: number }
    ) => {
      // Stary restore nie może zdejmować gate'a nowszego restore.
      if (
        opts?.restoreGen != null &&
        opts.restoreGen !== externalSessionRestoreGenRef.current
      ) {
        return;
      }
      if (sessionResumeRevealTimerRef.current != null) {
        window.clearTimeout(sessionResumeRevealTimerRef.current);
        sessionResumeRevealTimerRef.current = null;
      }
      if (!ok) {
        setSessionResumeForceComplete(false);
        setSessionResumeBlocking(false);
        setSessionRestorePending(false);
        pendingRestoredToastRef.current = null;
        return;
      }

      setSessionResumeForceComplete(true);
      const minVisibleMs = opts?.linesReady
        ? ZD_ESTIMATE_SESSION_RESUME_COMPLETE_TAIL_MS
        : ZD_ESTIMATE_SESSION_RESUME_MIN_VISIBLE_MS;
      const waitMs = launchProgressMinRevealWaitMs(
        sessionResumeStartedAtMsRef.current,
        Date.now(),
        minVisibleMs
      );
      const revealGen = externalSessionRestoreGenRef.current;
      sessionResumeRevealTimerRef.current = window.setTimeout(() => {
        sessionResumeRevealTimerRef.current = null;
        if (revealGen !== externalSessionRestoreGenRef.current) return;
        setSessionResumeBlocking(false);
        setSessionRestorePending(false);
        setSessionResumeForceComplete(false);
        // Odśwież token state — status „Sesja aktywna” musi wrócić razem z listą.
        setExternalSessionTokenState(peekZdEstimateExternalSessionToken());
        if (pendingRestoredToastRef.current) {
          setExternalSessionRestoredToast(pendingRestoredToastRef.current);
          pendingRestoredToastRef.current = null;
        }
      }, waitMs);
    },
    []
  );

  const endExternalSession = useCallback(
    async (opts?: { sessionId?: string | null }) => {
      const sessionId =
        opts?.sessionId ??
        externalSessionIdRef.current ??
        readZdEstimateExternalSessionToken()?.sessionId ??
        null;

      externalSessionRestoreGenRef.current += 1;
      externalSessionIdRef.current = null;
      externalSessionCreatedAtRef.current = null;
      externalSessionRestoredRef.current = false;
      externalSessionPersistSkipRef.current = true;
      externalSessionPersistQueuedRef.current = false;
      setSessionRestorePending(false);
      setSessionResumeBlocking(false);
      cancelPendingZdEstimateExternalSessionAwayStart();
      if (externalSessionPersistTimerRef.current != null) {
        window.clearTimeout(externalSessionPersistTimerRef.current);
        externalSessionPersistTimerRef.current = null;
      }

      clearZdEstimateExternalSessionToken();
      syncExternalSessionTokenState();
      setExternalSessionPersistFailedAlert(false);

      if (sessionId) {
        await deleteZdEstimateExternalSessionRecord(sessionId);
      }
    },
    [syncExternalSessionTokenState]
  );

  const buildCurrentExternalSessionSnapshot =
    useCallback((): ZdEstimateUiSessionSnapshot | null => {
      if (!lines || !linesBase) return null;

      return buildZdEstimateUiSessionSnapshot({
        createdAt: externalSessionCreatedAtRef.current ?? undefined,
        linesBase,
        lines,
        historyByTwId: historyEntriesFromMap(historyByTwId),
        historyFetchFailed,
        pendingIndividuals,
        pendingIndividualsTruncated,
        pendingIndividualsError,
        meta: meta ?? {
          pagesFetched: 0,
          totalCountApi: 0,
          truncated: false,
          ordersBaseUrl: "",
          durationMs: 0,
          totalFromSubiekt: 0,
        },
        missingPartnerTwIds,
        missingBomTwIds,
        paramInfo: paramInfo ?? {},
        exclusions,
        onRequests,
        packaging,
        productPairs,
        productBoms,
        teethTwIds,
        boostPreset,
        appliedBoostPreset,
        boostNeedsRecount,
        scopeMode,
        selectedGroup,
        selectedCecha,
        groupQuery,
        cechaQuery,
        supplierId,
        dniZapasu,
        dataOd,
        dataDo,
        zapasMin,
        showAdvanced,
        salesWindowSource,
        qtyOverrideByTwId,
        acceptedReviewTwIds,
        sessionIncludeTwIds,
        listFilter,
        listSearch,
        sortKey,
        sortDir,
        columns,
        columnOrder,
      });
    }, [
      lines,
      linesBase,
      historyByTwId,
      historyFetchFailed,
      pendingIndividuals,
      pendingIndividualsTruncated,
      pendingIndividualsError,
      meta,
      missingPartnerTwIds,
      missingBomTwIds,
      paramInfo,
      exclusions,
      onRequests,
      packaging,
      productPairs,
      productBoms,
      teethTwIds,
      appliedBoostPreset,
      boostPreset,
      boostNeedsRecount,
      scopeMode,
      selectedGroup,
      selectedCecha,
      groupQuery,
      cechaQuery,
      supplierId,
      dniZapasu,
      dataOd,
      dataDo,
      zapasMin,
      showAdvanced,
      salesWindowSource,
      qtyOverrideByTwId,
      acceptedReviewTwIds,
      sessionIncludeTwIds,
      listFilter,
      listSearch,
      sortKey,
      sortDir,
      columns,
      columnOrder,
    ]);

  const flushExternalSessionPersist = useCallback(async () => {
    if (externalSessionPersistTimerRef.current != null) {
      window.clearTimeout(externalSessionPersistTimerRef.current);
      externalSessionPersistTimerRef.current = null;
    }

    if (externalSessionPersistInFlightRef.current) {
      externalSessionPersistQueuedRef.current = true;
      return;
    }

    const sessionId = externalSessionIdRef.current;
    if (!sessionId || externalSessionPersistSkipRef.current) return;

    const snapshot = buildCurrentExternalSessionSnapshot();
    if (!snapshot) return;

    externalSessionPersistInFlightRef.current = true;
    try {
      const res = await actionUpsertZdEstimateUiSessionSnapshot({
        sessionId,
        payload: snapshot,
        schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      });

      // Sesja wymieniona w trakcie requestu (nowe Policz / end) — wynik starego upsertu ignoruj.
      if (externalSessionIdRef.current !== sessionId) return;

      if (!res.ok && res.reason === "not_found") {
        // Bieżąca sesja zniknęła z DB — odtwórz tylko jeśli nadal jesteśmy na tym ID
        // i nie trwa nowe Policz / end (skip).
        if (
          externalSessionIdRef.current !== sessionId ||
          externalSessionPersistSkipRef.current
        ) {
          return;
        }
        const created = await actionCreateZdEstimateUiSession({
          payload: snapshot,
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
        });
        if (
          externalSessionIdRef.current !== sessionId ||
          externalSessionPersistSkipRef.current
        ) {
          if (created.ok) {
            void deleteZdEstimateExternalSessionRecord(created.sessionId);
          }
          return;
        }
        if (!created.ok) {
          setExternalSessionPersistFailedAlert(true);
          console.warn(
            "Sesja UI kreatora: recreate po not_found nieudany.",
            created.message
          );
          return;
        }
        externalSessionIdRef.current = created.sessionId;
        const prev = peekZdEstimateExternalSessionToken();
        const token = recreateZdEstimateExternalSessionTokenPreservingTimer({
          sessionId: created.sessionId,
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
          supplierId: prev?.supplierId ?? supplierId,
          scopeMode: (prev?.scopeMode ??
            (scopeMode === "cecha" ? "cecha" : "grupa")) as "grupa" | "cecha",
          grupaId:
            prev?.grupaId ??
            (scopeMode === "grupa" ? selectedGroup?.grt_Id ?? null : null),
          cechaId:
            prev?.cechaId ??
            (scopeMode === "cecha" ? selectedCecha?.ctw_Id ?? null : null),
          previous: prev,
        });
        writeZdEstimateExternalSessionToken(token);
        syncExternalSessionTokenState();
        setExternalSessionPersistFailedAlert(false);
        return;
      }

      if (!res.ok) {
        setExternalSessionPersistFailedAlert(true);
        console.warn("Sesja UI kreatora: upsert nieudany.", res.message);
        return;
      }

      setExternalSessionPersistFailedAlert(false);
    } finally {
      externalSessionPersistInFlightRef.current = false;
      if (
        externalSessionPersistQueuedRef.current &&
        externalSessionIdRef.current &&
        !externalSessionPersistSkipRef.current
      ) {
        externalSessionPersistQueuedRef.current = false;
        void flushExternalSessionPersistRef.current();
      } else {
        externalSessionPersistQueuedRef.current = false;
      }
    }
  }, [
    buildCurrentExternalSessionSnapshot,
    scopeMode,
    selectedCecha?.ctw_Id,
    selectedGroup?.grt_Id,
    supplierId,
    syncExternalSessionTokenState,
  ]);

  const scheduleExternalSessionPersist = useCallback(() => {
    if (!externalSessionIdRef.current || externalSessionPersistSkipRef.current) {
      return;
    }
    if (externalSessionPersistTimerRef.current != null) {
      window.clearTimeout(externalSessionPersistTimerRef.current);
    }
    externalSessionPersistTimerRef.current = window.setTimeout(() => {
      externalSessionPersistTimerRef.current = null;
      void flushExternalSessionPersistRef.current();
    }, ZD_ESTIMATE_EXTERNAL_SESSION_PERSIST_DEBOUNCE_MS);
  }, []);

  flushExternalSessionPersistRef.current = flushExternalSessionPersist;
  scheduleExternalSessionPersistRef.current = scheduleExternalSessionPersist;

  const hasActiveExternalSessionWork = lines != null;

  const requestScopeChangeWithSessionGuard = useCallback(
    (action: () => void) => {
      if (!hasActiveExternalSessionWork) {
        action();
        return;
      }
      scopeChangePendingActionRef.current = action;
      setExternalSessionScopeChangeOpen(true);
    },
    [hasActiveExternalSessionWork]
  );

  const applyExternalSessionPayload = useCallback(
    (payload: ZdEstimateUiSessionSnapshot, restoreGen: number) => {
      if (restoreGen !== externalSessionRestoreGenRef.current) return;

      setScopeMode(payload.scopeMode);
      setSelectedGroup(payload.selectedGroup ?? null);
      setSelectedCecha(payload.selectedCecha ?? null);
      setGroupQuery(payload.groupQuery ?? payload.selectedGroup?.grt_Nazwa ?? "");
      setCechaQuery(payload.cechaQuery ?? payload.selectedCecha?.ctw_Nazwa ?? "");
      setSupplierId(payload.supplierId ?? null);
      setDniZapasu(String(payload.dniZapasu ?? ""));
      setDataOd(payload.dataOd);
      setDataDo(payload.dataDo);
      setZapasMin(String(payload.zapasMin ?? ""));
      setShowAdvanced(Boolean(payload.showAdvanced));
      setSalesWindowSource(payload.salesWindowSource ?? "stock");

      setLinesBase(payload.linesBase);
      setLines(payload.lines);
      setHistoryByTwId(historyMapFromEntries(payload.historyByTwId));
      setHistoryFetchFailed(Boolean(payload.historyFetchFailed));

      setPendingIndividualsLoading(false);
      setPendingIndividuals(payload.pendingIndividuals ?? []);
      setPendingIndividualsTruncated(
        Boolean(payload.pendingIndividualsTruncated)
      );
      setPendingIndividualsError(payload.pendingIndividualsError ?? null);

      setOnRequests(payload.onRequests ?? []);
      setOnRequestsError(null);
      setExclusions(payload.exclusions ?? []);
      setExclusionsError(null);
      setPackaging(payload.packaging ?? []);
      setPackagingError(null);
      setProductPairs(payload.productPairs ?? []);
      setProductPairsError(null);
      setProductBoms(payload.productBoms ?? []);
      setProductBomsError(null);
      setTeethTwIds(payload.teethTwIds ?? []);
      setTeethProductsError(null);
      setMissingPartnerTwIds(payload.missingPartnerTwIds ?? []);
      setMissingBomTwIds(payload.missingBomTwIds ?? []);

      setQtyOverrideByTwId(payload.qtyOverrideByTwId ?? {});
      setAcceptedReviewTwIds(payload.acceptedReviewTwIds ?? {});
      setSessionIncludeTwIds(payload.sessionIncludeTwIds ?? {});

      setListFilter(payload.listFilter ?? "order");
      setListSearch(payload.listSearch ?? "");
      setSortKey(payload.sortKey);
      setSortDir(payload.sortDir);
      setColumns(payload.columns ?? columns);
      setColumnOrder(payload.columnOrder ?? columnOrder);

      setParamInfo(payload.paramInfo ?? {});
      if (payload.meta) setMeta(payload.meta);

      const restoredBoostNeedsRecount = payload.boostPreset
        ? Boolean(payload.boostNeedsRecount) ||
          (payload.appliedBoostPreset != null &&
            payload.boostPreset !== payload.appliedBoostPreset)
        : false;

      if (payload.boostPreset) {
        setBoostPreset(payload.boostPreset);
        const applied =
          payload.appliedBoostPreset ?? payload.boostPreset;
        setAppliedBoostPreset(applied);
        setAppliedBoostPolicy(policyForBoostPreset(applied));
      }

      // Restore = snapshot roboczy, nie post-create / create-lock z bieżącego mountu.
      setPostCreate(null);
      setConsumedOnThisZdIds([]);
      glowneRemovedForUndoRef.current = [];
      glowneUndoOrderIdsRef.current = [];
      setCreateDoneDokId(null);
      setCreateDoneDokNr(null);
      setCreateUnconfirmedAttempt(false);
      setCreateUnlockedAfterDone(false);
      setCreateUndoVisible(false);
      setCreateZdOpen(false);
      setCreatingZd(false);
      setLinkZdOpen(false);
      setLinkNrPrefill(null);
      createPreviewCaptureRef.current = null;
      setCreatePreviewFrozen(null);
      createLineMetaCaptureRef.current = null;
      createMarkFreezeCaptureRef.current = null;
      setCreateMarkFreezeFrozen(null);
      timeoutRecoveryFreezeRef.current = null;
      resetSelectionQuiet();
      setFeedback(null);
      setErrorMessage(null);
      setLastEstimateFailed(false);
      setScopeNeedsRecount(false);
      setBoostNeedsRecount(restoredBoostNeedsRecount);
      setHistoryNeedsRecount(false);
      setScopeRemapActive(false);
      setPrepCollapsed(true);
      setLaunchReadyMessage(null);
      setRecountStatusMessage(null);
    },
    [columnOrder, columns, resetSelectionQuiet]
  );

  const restoreExternalSession = useCallback(
    async (token: NonNullable<ReturnType<typeof peekZdEstimateExternalSessionToken>>) => {
      sessionResumeStartedAtMsRef.current = Date.now();
      setSessionResumeReturningFromAway(
        isZdEstimateExternalSessionReturnNavigation(token)
      );
      if (shouldShowZdEstimateSessionResumeLoading({ token })) {
        setSessionResumeBlocking(true);
      }
      setSessionResumeForceComplete(false);
      setSessionRestorePending(true);
      clearZdEstimateExternalSessionResumeQueryParam();

      const restoreGen = ++externalSessionRestoreGenRef.current;
      setExternalSessionExpiredAlert(false);
      setExternalSessionRestoreFailedAlert(false);
      setExternalSessionRestoredToast(null);

      skipPendingIndividualsFetchRef.current = true;

      const failRestore = async (
        opts: {
          expired?: boolean;
          deleteSessionId?: string | null;
          clearToken?: boolean;
        } = {}
      ) => {
        if (opts.clearToken !== false) {
          clearZdEstimateExternalSessionToken();
          syncExternalSessionTokenState();
        }
        if (opts.deleteSessionId) {
          await deleteZdEstimateExternalSessionRecord(opts.deleteSessionId);
        }
        if (opts.expired) {
          setExternalSessionExpiredAlert(true);
        } else {
          setExternalSessionRestoreFailedAlert(true);
        }
        finishSessionResumeReveal(false, { restoreGen });
      };

      try {
      const paused = pauseAwayTimerOnReturnToExternalSession(token);
      if (paused.remainingMs <= 0) {
        await failRestore({
          expired: true,
          deleteSessionId: paused.sessionId,
        });
        return;
      }

      writeZdEstimateExternalSessionToken(paused);
      syncExternalSessionTokenState();

      const got = await actionGetZdEstimateUiSession({
        sessionId: paused.sessionId,
      });

      if (restoreGen !== externalSessionRestoreGenRef.current) {
        // Nowszy restore przejął gate — nie zdejmuj go.
        return;
      }

      if (!got.ok) {
        await failRestore({
          expired: got.reason === "expired",
          // expired: serwer już usuwa; not_found: nie ma czego kasować.
          deleteSessionId: null,
        });
        return;
      }

      if (
        got.schemaVersion !== ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION
      ) {
        await failRestore({ deleteSessionId: paused.sessionId });
        return;
      }

      const payload = parseZdEstimateUiSessionSnapshot(
        got.payload,
        got.schemaVersion
      );
      if (!payload) {
        await failRestore({ deleteSessionId: paused.sessionId });
        return;
      }

      externalSessionIdRef.current = paused.sessionId;
      externalSessionCreatedAtRef.current = payload.createdAt;
      externalSessionPersistSkipRef.current = false;
      externalSessionRestoredRef.current = true;

      applyExternalSessionPayload(payload, restoreGen);
      if (restoreGen !== externalSessionRestoreGenRef.current) {
        return;
      }

      pendingRestoredToastRef.current =
        zdEstimateExternalSessionRestoredToastDescription({
          updatedAt: payload.updatedAt ?? got.updatedAt,
        });
      setExternalSessionPersistFailedAlert(false);
      finishSessionResumeReveal(true, { linesReady: true, restoreGen });
      } catch (e) {
        console.warn("Sesja UI kreatora: restore rzucił błąd.", e);
        if (restoreGen === externalSessionRestoreGenRef.current) {
          await failRestore({
            deleteSessionId: token.sessionId,
          });
        }
      } finally {
        skipPendingIndividualsFetchRef.current = false;
      }
    },
    [
      applyExternalSessionPayload,
      finishSessionResumeReveal,
      syncExternalSessionTokenState,
    ]
  );

  const clearEstimateResult = (opts?: { fromScopeChange?: boolean }) => {
    estimateGenRef.current += 1;
    setLines(null);
    setLinesBase(null);
    setHistoryByTwId(new Map());
    setParamInfo(null);
    setMeta(null);
    resetSelectionQuiet();
    setListSearch("");
    setMissingPartnerTwIds([]);
    setMissingBomTwIds([]);
    setQtyOverrideByTwId({});
    setAcceptedReviewTwIds({});
    setSessionIncludeTwIds({});
    setCreateUnlockedAfterDone(false);
    setCreateUndoVisible(false);
    selectAnchorTwIdRef.current = null;
    setCopyOk(false);
    setPostCreate(null);
    setCreateDoneDokId(null);
    setCreateDoneDokNr(null);
    setCreateUnconfirmedAttempt(false);
    setCreateZdOpen(false);
    setCreatingZd(false);
    setLinkZdOpen(false);
    setLinkNrPrefill(null);
    createPreviewCaptureRef.current = null;
    setCreatePreviewFrozen(null);
    createLineMetaCaptureRef.current = null;
    createMarkFreezeCaptureRef.current = null;
    setCreateMarkFreezeFrozen(null);
    timeoutRecoveryFreezeRef.current = null;
    setConsumedOnThisZdIds([]);
    glowneRemovedForUndoRef.current = [];
    glowneUndoOrderIdsRef.current = [];
    setLaunchReadyMessage(null);
    setRecountStatusMessage(null);
    // Brak listy → dirty boosta / historii nieaktualne; applied = aktualne radio.
    setBoostNeedsRecount(false);
    setHistoryNeedsRecount(false);
    setHistoryFetchFailed(false);
    setAppliedBoostPreset(boostPreset);
    setAppliedBoostPolicy(policyForBoostPreset(boostPreset));
    if (opts?.fromScopeChange) {
      setLastEstimateFailed(false);
      setScopeNeedsRecount(true);
      // Pokaż formularz zakresu z nową grupą/cechą — nie zostawiaj zwiniętego
      // prep z chipami / postępu ze starym launch.label.
      setPrepCollapsed(false);
      setLaunchBlocking(false);
      setLaunchForceComplete(false);
      setLaunchStartedAtMs(null);
      // Unieważnij prośby do czasu fetchu dla (ew. nowego) dostawcy / Policz.
      pendingFetchGenRef.current += 1;
      setPendingIndividuals([]);
      setPendingIndividualsError(null);
      setPendingIndividualsTruncated(false);
      setPendingIndividualsLoading(false);
    }
  };

  const changeScopeMode = (mode: ZdEstimateRunMode) => {
    if (mode === scopeMode) return;
    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      setScopeMode(mode);
      setFeedback(null);
      setErrorMessage(null);
      clearEstimateResult({ fromScopeChange: lines != null });
      if (mode === "grupa") {
        setSelectedCecha(null);
        setCechaHits([]);
        setCechaQuery("");
      } else {
        setSelectedGroup(null);
        setGroupHits([]);
        setGroupQuery("");
      }
    });
  };

  const selectGroup = (group: ZdEstimateGroupOption) => {
    const scopeChanged =
      scopeMode !== "grupa" || selectedGroup?.grt_Id !== group.grt_Id;
    const applied = resolveWindowForGroup(
      group,
      bootstrap.suppliers,
      bootstrap.salesEndKey
    );
    const supplierChanged = applied.supplierId !== supplierId;
    const affectsScope = scopeChanged || supplierChanged;

    const applySelection = () => {
      setScopeMode("grupa");
      setSelectedGroup(group);
      setSelectedCecha(null);
      setCechaHits([]);
      setGroupQuery(group.grt_Nazwa);
      setGroupHits([]);
      setFeedback(null);
      setErrorMessage(null);

      if (affectsScope) {
        clearEstimateResult({ fromScopeChange: lines != null });
      } else setCopyOk(false);

      setSupplierId(applied.supplierId);
      setDniZapasu(String(applied.dniZapasu));
      if (shouldApplyStockSalesWindow(salesWindowSource)) {
        setDataOd(applied.dataOd);
        setDataDo(applied.dataDo);
      }
      requestAnimationFrame(() => {
        scrollZdEstimateIntoView(ZD_ESTIMATE_POLICZ_CTA_ID, {
          behavior: "smooth",
          block: "nearest",
          offsetPx: 24,
        });
      });
    };

    if (!affectsScope) {
      applySelection();
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applySelection();
    });
  };

  const selectCecha = (cecha: ZdEstimateCechaOption) => {
    const scopeChanged =
      scopeMode !== "cecha" || selectedCecha?.ctw_Id !== cecha.ctw_Id;
    const applied = resolveWindowForCecha(
      cecha,
      bootstrap.suppliers,
      bootstrap.salesEndKey
    );
    const supplierChanged = applied.supplierId !== supplierId;
    const affectsScope = scopeChanged || supplierChanged;

    const applySelection = () => {
      setScopeMode("cecha");
      setSelectedCecha(cecha);
      setSelectedGroup(null);
      setGroupHits([]);
      setCechaQuery(cecha.ctw_Nazwa);
      setCechaHits([]);
      setFeedback(null);
      setErrorMessage(null);

      if (affectsScope) {
        clearEstimateResult({ fromScopeChange: lines != null });
      } else setCopyOk(false);

      setSupplierId(applied.supplierId);
      setDniZapasu(String(applied.dniZapasu));
      if (shouldApplyStockSalesWindow(salesWindowSource)) {
        setDataOd(applied.dataOd);
        setDataDo(applied.dataDo);
      }
      requestAnimationFrame(() => {
        scrollZdEstimateIntoView(ZD_ESTIMATE_POLICZ_CTA_ID, {
          behavior: "smooth",
          block: "nearest",
          offsetPx: 24,
        });
      });
    };

    if (!affectsScope) {
      applySelection();
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applySelection();
    });
  };

  const onDniZapasuChange = (raw: string) => {
    dniZapasuTouchedForPrefsRef.current = true;
    const n = Math.round(Number(raw));
    const currentN = Math.round(Number(dniZapasu));
    const valid = Number.isFinite(n) && n >= 1;
    const valueChanged = valid && n !== currentN;
    const affectsScope = lines != null && valueChanged;

    const applyValidChange = () => {
      setDniZapasu(raw);
      dniZapasuPrefsValueRef.current = n;
      setSalesWindowSource("stock");
      const end = dataDo || bootstrap.salesEndKey;
      setDataOd(salesWindowFromDniZapasu(n, end).dataOd);
      clearEstimateResult({ fromScopeChange: true });
    };

    if (!affectsScope) {
      setDniZapasu(raw);
      if (valueChanged) {
        dniZapasuPrefsValueRef.current = n;
        setSalesWindowSource("stock");
        const end = dataDo || bootstrap.salesEndKey;
        setDataOd(salesWindowFromDniZapasu(n, end).dataOd);
      }
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applyValidChange();
    });
  };

  const onSupplierOverride = (id: string) => {
    if (id === (supplierId ?? "")) return;

    const affectsScope = lines != null;

    const applyChange = () => {
      if (!id) {
        setSupplierId(null);
        clearEstimateResult({ fromScopeChange: lines != null });
        return;
      }
      const prev = supplierId;
      const s = bootstrap.suppliers.find((x) => x.id === id);
      setSupplierId(id);
      if (prev !== id) {
        clearEstimateResult({ fromScopeChange: lines != null });
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

    if (!affectsScope) {
      applyChange();
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applyChange();
    });
  };

  const restoreSalesWindowFromStock = () => {
    const n = Math.round(Number(dniZapasu));
    const days =
      Number.isFinite(n) && n >= 1 ? n : DEFAULT_DNI_ZAPASU;
    const end = bootstrap.salesEndKey;
    const window = salesWindowFromDniZapasu(days, end);
    const affectsScope =
      lines != null &&
      (salesWindowSource !== "stock" ||
        dataOd !== window.dataOd ||
        dataDo !== window.dataDo);

    const applyRestore = () => {
      setSalesWindowSource("stock");
      setDataOd(window.dataOd);
      setDataDo(window.dataDo);
      clearEstimateResult({ fromScopeChange: true });
    };

    if (!affectsScope) {
      setSalesWindowSource("stock");
      setDataOd(window.dataOd);
      setDataDo(window.dataDo);
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applyRestore();
    });
  };

  const onManualDataOdChange = (value: string) => {
    const affectsScope = lines != null && value !== dataOd;

    const applyChange = () => {
      setSalesWindowSource("manual");
      setDataOd(value);
      clearEstimateResult({ fromScopeChange: true });
    };

    if (!affectsScope) {
      setSalesWindowSource("manual");
      setDataOd(value);
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applyChange();
    });
  };

  const onManualDataDoChange = (nextDo: string) => {
    const nextOd = nextDataOdAfterDataDoChange({
      source: "manual",
      dataDo: nextDo,
      dataOd,
      dniZapasu: Number(dniZapasu),
    });
    const affectsScope =
      lines != null && (nextDo !== dataDo || nextOd !== dataOd);

    const applyChange = () => {
      setSalesWindowSource("manual");
      setDataDo(nextDo);
      setDataOd(nextOd);
      clearEstimateResult({ fromScopeChange: true });
    };

    if (!affectsScope) {
      setSalesWindowSource("manual");
      setDataDo(nextDo);
      setDataOd(nextOd);
      return;
    }

    requestScopeChangeWithSessionGuard(() => {
      void endExternalSession();
      applyChange();
    });
  };

  const searchGroups = () => {
    setFeedback(null);
    setErrorMessage(null);
    startSearch(async () => {
      const res = await actionSearchZdEstimateGroups(groupQuery);
      if (!res.ok) {
        setGroupHits([]);
        setFeedback(res.feedback ?? null);
        reportError(res.message);
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
        reportError(res.message);
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
    externalSessionRestoreGenRef.current += 1;
    setExternalSessionExpiredAlert(false);
    setExternalSessionRestoreFailedAlert(false);
    setExternalSessionRestoredToast(null);
    setFeedback(null);
    setErrorMessage(null);
    setCopyOk(false);
    setLaunchReadyMessage(null);
    setRecountStatusMessage(null);
    const mode = opts?.mode ?? scopeMode;
    const grupaId =
      opts?.grupaId ??
      (mode === "grupa" ? selectedGroup?.grt_Id : undefined);
    const cechaId =
      opts?.cechaId ??
      (mode === "cecha" ? selectedCecha?.ctw_Id : undefined);
    const useProgressShell = shouldUseZdEstimateProgressShell({
      hasLines: lines != null,
    });
    const clearProgressBlocking = () => {
      if (useProgressShell) setLaunchBlocking(false);
    };
    if (mode === "grupa" && !grupaId) {
      setErrorMessage("Wybierz grupę (np. Falcon).");
      setLastEstimateFailed(true);
      clearProgressBlocking();
      return;
    }
    if (mode === "cecha" && !cechaId) {
      setErrorMessage("Wybierz cechę (np. Ivoclar).");
      setLastEstimateFailed(true);
      clearProgressBlocking();
      return;
    }
    if (!settingsTrusted) {
      const msg = settingsTrustFailMessage({
        exclusionsError,
        onRequestsError,
        packagingError,
        productPairsError,
        productBomsError,
        teethProductsError,
      });
      setErrorMessage(msg);
      setLastEstimateFailed(true);
      clearProgressBlocking();
      return;
    }
    const launchStartedCapture = useProgressShell
      ? launchBlocking && launchStartedAtMs != null
        ? launchStartedAtMs
        : beginLaunchProgress()
      : null;
    if (useProgressShell) {
      setLaunchForceComplete(false);
    }
    setLastEstimateFailed(false);
    setScopeNeedsRecount(false);
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
        resetSelectionQuiet();
        setAcceptedReviewTwIds({});
        setMissingPartnerTwIds([]);
        setPrepCollapsed(false);
        setLaunchForceComplete(false);
        setLastEstimateFailed(true);
        setScopeNeedsRecount(false);
        setBoostNeedsRecount(false);
        setHistoryNeedsRecount(false);
        setHistoryFetchFailed(false);
        setPendingIndividualsLoading(false);
        setAppliedBoostPreset(boostPreset);
        setAppliedBoostPolicy(policyForBoostPreset(boostPreset));
        setRecountStatusMessage(null);
        // Lista nieważna — zdejmij handoff/lock z poprzedniej sesji (jak przy clearEstimateResult).
        setPostCreate(null);
        setConsumedOnThisZdIds([]);
        glowneRemovedForUndoRef.current = [];
        glowneUndoOrderIdsRef.current = [];
        setCreateDoneDokId(null);
        setCreateDoneDokNr(null);
        setCreateUnconfirmedAttempt(false);
        setCreateUnlockedAfterDone(false);
        setCreateUndoVisible(false);
        setCreateZdOpen(false);
        setCreatingZd(false);
        setLinkZdOpen(false);
        setLinkNrPrefill(null);
        createPreviewCaptureRef.current = null;
        setCreatePreviewFrozen(null);
        createLineMetaCaptureRef.current = null;
        createMarkFreezeCaptureRef.current = null;
        setCreateMarkFreezeFrozen(null);
        timeoutRecoveryFreezeRef.current = null;
        clearProgressBlocking();
        void endExternalSession();
        if (
          useProgressShell &&
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
          reportError(res.message);
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
        setHistoryFetchFailed(Boolean(res.historyFetchFailed));
        setPendingIndividualsLoading(false);
        // Nowe Policz = nowa sesja robocza; zdejmij post-create / lock z poprzedniego ZD.
        setPostCreate(null);
        setConsumedOnThisZdIds([]);
        glowneRemovedForUndoRef.current = [];
        glowneUndoOrderIdsRef.current = [];
        if (res.pendingIndividuals != null) {
          pendingFetchGenRef.current += 1;
          setPendingIndividuals(res.pendingIndividuals);
          setPendingIndividualsError(null);
          setPendingIndividualsTruncated(
            Boolean(res.pendingIndividualsTruncated)
          );
        } else {
          // Nie zostawiaj próśb z poprzedniego zakresu / dostawcy.
          pendingFetchGenRef.current += 1;
          setPendingIndividuals([]);
          setPendingIndividualsTruncated(false);
          setPendingIndividualsError(
            res.pendingIndividualsError?.trim() ||
              "Nie wczytano próśb przy Policz — użyj „Wczytaj ponownie” albo policz listę jeszcze raz."
          );
        }
        if (res.onRequests != null) {
          setOnRequests(res.onRequests);
          setOnRequestsError(null);
        }
        setCreateDoneDokId(null);
        setCreateDoneDokNr(null);
        setCreateUnconfirmedAttempt(false);
        setCreateUnlockedAfterDone(false);
        setCreateUndoVisible(false);
        setCreateZdOpen(false);
        setCreatingZd(false);
        setLinkZdOpen(false);
        setLinkNrPrefill(null);
        createPreviewCaptureRef.current = null;
        setCreatePreviewFrozen(null);
        createLineMetaCaptureRef.current = null;
        createMarkFreezeCaptureRef.current = null;
        setCreateMarkFreezeFrozen(null);
        timeoutRecoveryFreezeRef.current = null;
        resetSelectionQuiet();
        setListSearch("");
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
        setMissingPartnerTwIds(res.meta.pairMissingTwIds ?? []);
        setMissingBomTwIds(res.meta.bomMissingTwIds ?? []);
        setQtyOverrideByTwId({});
        setAcceptedReviewTwIds({});
        setSessionIncludeTwIds({});
        setCreateUnlockedAfterDone(false);
        setCreateUndoVisible(false);
        setFeedback(null);
        setErrorMessage(null);
        setLastEstimateFailed(false);
        setScopeNeedsRecount(false);
        if (res.boostPreset) {
          setBoostPreset(res.boostPreset);
          setAppliedBoostPreset(res.boostPreset);
          setAppliedBoostPolicy(policyForBoostPreset(res.boostPreset));
        }
        setBoostNeedsRecount(false);
        setHistoryNeedsRecount(false);
        setScopeRemapActive(false);
        // Po Policz: zwijaj prep — max wysokość tabeli (także recount bez progress shell).
        setPrepCollapsed(true);
        if (useProgressShell) {
          setLaunchReadyMessage(
            zdEstimateLaunchReadyToastDescription({
              doZamowieniaCount: res.meta.doZamowieniaCount,
              pendingIndividualsCount: res.pendingIndividuals?.length ?? 0,
              isLive: bootstrap.ordersIsLive,
            })
          );
          setLaunchForceComplete(false);
          setLaunchBlocking(false);
          setRecountStatusMessage(null);
        } else {
          setRecountStatusMessage(
            zdEstimateRecountListStatus({
              doZamowieniaCount: res.meta.doZamowieniaCount,
              durationMs: res.meta.durationMs,
            })
          );
        }
      };

      if (useProgressShell) {
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

      // Po sukcesie „Policz” zapisz snapshot UI sesji kreatora ZD oraz token timeru w sessionStorage.
      try {
        const pendingIndividualsOk = res.pendingIndividuals != null;
        const snapshotPayload = buildZdEstimateUiSessionSnapshot({
          linesBase: res.result.pozycjeBase ?? res.result.pozycje,
          lines: res.result.pozycje,
          historyByTwId: (res.historyByTwId ?? [])
            .filter((e) => e.twId > 0)
            .map((e) => ({
              twId: e.twId,
              lastOrderedQty: e.lastOrderedQty,
              linkedAt: e.linkedAt,
            })),
          historyFetchFailed: Boolean(res.historyFetchFailed),
          pendingIndividuals: pendingIndividualsOk
            ? (res.pendingIndividuals ?? [])
            : [],
          pendingIndividualsTruncated: pendingIndividualsOk
            ? Boolean(res.pendingIndividualsTruncated)
            : false,
          pendingIndividualsError: pendingIndividualsOk
            ? null
            : res.pendingIndividualsError?.trim() ||
              "Nie wczytano próśb przy Policz — użyj „Wczytaj ponownie” albo policz listę jeszcze raz.",
          meta: {
            pagesFetched: res.meta.pagesFetched,
            totalCountApi: res.meta.totalCountApi,
            truncated: res.meta.truncated,
            ordersBaseUrl: res.meta.ordersBaseUrl,
            durationMs: res.meta.durationMs,
            totalFromSubiekt: res.meta.totalFromSubiekt,
          },
          missingPartnerTwIds: res.meta.pairMissingTwIds ?? [],
          missingBomTwIds: res.meta.bomMissingTwIds ?? [],
          paramInfo: res.result.parametry as Record<string, unknown>,
          exclusions:
            genExBefore === exclusionsGenRef.current
              ? freshEx.ok
                ? freshEx.exclusions
                : res.exclusions
              : exclusions,
          onRequests: res.onRequests != null ? res.onRequests : onRequests,
          packaging:
            genPackBefore === packagingGenRef.current
              ? freshPack.ok
                ? freshPack.packaging
                : res.packaging
              : packaging,
          productPairs:
            genPairsBefore === pairsGenRef.current
              ? freshPairs.ok
                ? freshPairs.pairs
                : res.productPairs ?? []
              : productPairs,
          productBoms: freshBoms.ok ? freshBoms.boms : res.productBoms ?? [],
          teethTwIds: res.teethTwIds ?? [],
          boostPreset: res.boostPreset ?? boostPreset,
          appliedBoostPreset: res.boostPreset ?? appliedBoostPreset,
          boostNeedsRecount: false,
          scopeMode,
          selectedGroup,
          selectedCecha,
          groupQuery,
          cechaQuery,
          supplierId,
          dniZapasu,
          dataOd,
          dataDo,
          zapasMin,
          showAdvanced,
          salesWindowSource,
          qtyOverrideByTwId: {},
          acceptedReviewTwIds: {},
          sessionIncludeTwIds: {},
          listFilter: "order",
          listSearch: "",
          sortKey,
          sortDir,
          columns,
          columnOrder,
        });

        externalSessionPersistSkipRef.current = true;
        externalSessionPersistQueuedRef.current = false;
        if (externalSessionPersistTimerRef.current != null) {
          window.clearTimeout(externalSessionPersistTimerRef.current);
          externalSessionPersistTimerRef.current = null;
        }
        // Odłącz stary ID i token od razu — in-flight upsert/recreate nie walczy
        // z create, a notice/unmount nie startuje away na usuniętej sesji DB.
        externalSessionIdRef.current = null;
        clearZdEstimateExternalSessionToken();
        syncExternalSessionTokenState();
        const persist = await actionCreateZdEstimateUiSession({
          payload: snapshotPayload,
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
        });

        if (estimateGen !== estimateGenRef.current) {
          if (persist.ok) {
            void deleteZdEstimateExternalSessionRecord(persist.sessionId);
          }
          return;
        }

        if (!persist.ok) {
          externalSessionIdRef.current = null;
          externalSessionCreatedAtRef.current = null;
          clearZdEstimateExternalSessionToken();
          syncExternalSessionTokenState();
          setExternalSessionPersistFailedAlert(true);
          console.warn("Sesja UI kreatora: zapis nieudany.", persist.message);
          return;
        }

        externalSessionIdRef.current = persist.sessionId;
        externalSessionCreatedAtRef.current = snapshotPayload.createdAt;
        externalSessionPersistSkipRef.current = false;
        externalSessionPersistQueuedRef.current = false;
        setExternalSessionPersistFailedAlert(false);
        setExternalSessionRestoredToast(null);
        externalSessionRestoredRef.current = false;

        const token = createZdEstimateExternalSessionToken({
          sessionId: persist.sessionId,
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
          supplierId,
          scopeMode: scopeMode as "grupa" | "cecha",
          grupaId: scopeMode === "grupa" ? selectedGroup?.grt_Id ?? null : null,
          cechaId: scopeMode === "cecha" ? selectedCecha?.ctw_Id ?? null : null,
        });

        writeZdEstimateExternalSessionToken(token);
        syncExternalSessionTokenState();
      } catch (e) {
        externalSessionIdRef.current = null;
        externalSessionCreatedAtRef.current = null;
        clearZdEstimateExternalSessionToken();
        syncExternalSessionTokenState();
        setExternalSessionPersistFailedAlert(true);
        console.warn("Sesja UI kreatora: zapis payloadu rzucił błąd.", e);
      }
    });
  };

  useEffect(() => {
    runEstimateRef.current = runEstimate;
  });

  // Sesja zewnętrzna: restore albo konflikt z autorun na mount (przed pierwszym paintem treści).
  useLayoutEffect(() => {
    syncExternalSessionTokenState();

    const token = peekZdEstimateExternalSessionToken();
    const wantsAutorun =
      Boolean(launch?.autorun) &&
      !launch?.needsAssign &&
      bootstrap.configured &&
      launchHasRunnableScope(launch);

    if (token && wantsAutorun && launch?.launchKey) {
      externalSessionAutorunBlockedRef.current = true;
      externalSessionAutorunPendingRef.current = {
        mode: launch.mode!,
        grupaId: launch.grupaId ?? undefined,
        cechaId: launch.cechaId ?? undefined,
        launchKey: launch.launchKey,
      };
      // Trzymaj gate restore — formularz zakresu nie miga pod dialogiem konfliktu.
      setSessionResumeBlocking(false);
      setSessionRestorePending(true);
      setExternalSessionAutorunConflictOpen(true);
      return;
    }

    if (!token) {
      setSessionRestorePending(false);
      setSessionResumeBlocking(false);
      return;
    }

    skipPendingIndividualsFetchRef.current = true;
    void restoreExternalSession(token).catch(() => {
      /* błąd obsłużony w restoreExternalSession */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPendingAutorunAfterSessionDiscard = useCallback(() => {
    const pending = externalSessionAutorunPendingRef.current;
    externalSessionAutorunPendingRef.current = null;
    externalSessionAutorunBlockedRef.current = false;
    if (!pending) return;

    launchedRef.current = true;
    markZdEstimateLaunchAutorunDone(pending.launchKey);
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
    queueMicrotask(() => {
      runEstimateRef.current?.({
        fromLaunch: true,
        mode: pending.mode,
        grupaId: pending.grupaId,
        cechaId: pending.cechaId,
      });
    });
  }, []);

  const openCreateZdModal = useCallback(() => {
    setLinkZdOpen(false);
    setLinkNrPrefill(null);
    setCreateZdOpen(true);
  }, []);
  const clearCreateZdCapture = useCallback(() => {
    setCreatingZd(false);
    createPreviewCaptureRef.current = null;
    setCreatePreviewFrozen(null);
    createLineMetaCaptureRef.current = null;
    createMarkFreezeCaptureRef.current = null;
    setCreateMarkFreezeFrozen(null);
  }, []);
  const closeCreateZdModal = useCallback(() => {
    setCreateZdOpen(false);
    clearCreateZdCapture();
  }, [clearCreateZdCapture]);
  const openLinkZdModal = useCallback(() => {
    closeCreateZdModal();
    setLinkZdOpen(true);
  }, [closeCreateZdModal]);

  // Prośby przy supplierId (także needsAssign — bez czekania na Policz).
  useEffect(() => {
    if (skipPendingIndividualsFetchRef.current) return;
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
        setPendingIndividualsError(userFacingErrorTextFromMessage(res.message));
      }
    })();
  }, [supplierId]);

  // Prefill z launch jest w initial state — tu tylko autorun.
  // settingsTrusted: przy launch false = twardy fail (bootstrap errors nie „naprawią się” same).
  useEffect(() => {
    if (!launch?.autorun || launch.needsAssign) return;
    if (launchedRef.current) return;
    if (!bootstrap.configured) return;
    if (externalSessionAutorunBlockedRef.current) return;
    if (peekZdEstimateExternalSessionToken()) return;

    const failLaunch = (message: string) => {
      launchedRef.current = true;
      markZdEstimateLaunchAutorunDone(launch.launchKey);
      queueMicrotask(() => {
        setLaunchBlocking(false);
        setErrorMessage(message);
      });
    };

    if (!launchHasRunnableScope(launch)) {
      failLaunch("Brak zakresu Subiekta do automatycznego uruchomienia kreatora.");
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
          onRequestsError,
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

  // Unmount kreatora => flush persist + odroczony start away.
  // Odroczenie (~120ms) anulujemy przy remount na poziomie modułu —
  // Strict Mode / szybki leave→return nie traktują się jak wyjście
  // (token zostaje „paused”; instance useRef tego nie ogarnia).
  useEffect(() => {
    cancelPendingZdEstimateExternalSessionAwayStart();

    const expiredId = consumeExpiredOrInvalidZdEstimateExternalSessionToken();
    if (expiredId) {
      void deleteZdEstimateExternalSessionRecord(expiredId);
    }

    return () => {
      void flushExternalSessionPersistRef.current();
      scheduleZdEstimateExternalSessionAwayStart({
        onExpiredSessionId: (sessionId) => {
          void deleteZdEstimateExternalSessionRecord(sessionId);
        },
      });
    };
  }, []);

  // Debounced persist zmian użytkownika po Policz.
  useEffect(() => {
    if (!lines || !externalSessionIdRef.current) return;
    if (externalSessionPersistSkipRef.current) return;
    scheduleExternalSessionPersistRef.current();
    return () => {
      if (externalSessionPersistTimerRef.current != null) {
        window.clearTimeout(externalSessionPersistTimerRef.current);
        externalSessionPersistTimerRef.current = null;
      }
    };
  }, [
    lines,
    linesBase,
    historyByTwId,
    historyFetchFailed,
    pendingIndividuals,
    pendingIndividualsTruncated,
    pendingIndividualsError,
    meta,
    missingPartnerTwIds,
    missingBomTwIds,
    paramInfo,
    exclusions,
    onRequests,
    packaging,
    productPairs,
    productBoms,
    teethTwIds,
    boostPreset,
    appliedBoostPreset,
    boostNeedsRecount,
    scopeMode,
    selectedGroup,
    selectedCecha,
    groupQuery,
    cechaQuery,
    supplierId,
    dniZapasu,
    dataOd,
    dataDo,
    zapasMin,
    showAdvanced,
    salesWindowSource,
    qtyOverrideByTwId,
    acceptedReviewTwIds,
    sessionIncludeTwIds,
    listFilter,
    listSearch,
    sortKey,
    sortDir,
    columns,
    columnOrder,
  ]);

  useEffect(() => {
    const onHide = () => {
      void flushExternalSessionPersistRef.current();
    };
    window.addEventListener("pagehide", onHide);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      void flushExternalSessionPersistRef.current();
    };
  }, []);

  /** Jeden spokojny panel — pierwsze Policz (menu i daily), bez overlay na formularzu. */
  const showLaunchProgress = Boolean(
    launchBlocking ||
      (estimating && !lines && !launchReadyMessage)
  );

  useEffect(() => {
    return () => {
      if (sessionResumeRevealTimerRef.current != null) {
        window.clearTimeout(sessionResumeRevealTimerRef.current);
        sessionResumeRevealTimerRef.current = null;
      }
    };
  }, []);

  /** Sticky Create/TSV/Link gdy jest wynik Policz (także przy 0 Do ZD). */
  const showResultStickyActions = Boolean(lines);
  /** Pełny panel resume tylko przy realnym powrocie z away — nie przy F5 na kreatorze. */
  const showSessionResumeProgress = Boolean(
    sessionResumeBlocking && !showLaunchProgress
  );
  /** Cichy restore (F5): blokuj treść + lekki spinner, bez pełnego gate'a. */
  const showQuietSessionRestore = Boolean(
    sessionRestorePending &&
      !sessionResumeBlocking &&
      !showLaunchProgress &&
      !externalSessionAutorunConflictOpen
  );
  const canCancelExternalSession = Boolean(
    lines != null &&
      externalSessionTokenState != null &&
      externalSessionTokenState.awayExpiresAtMs == null
  );
  const showExternalSessionActiveStatus = Boolean(
    canCancelExternalSession &&
      !showSessionResumeProgress &&
      !showQuietSessionRestore &&
      !showLaunchProgress
  );

  /** Blur na liście przy każdym Policz, gdy wynik już jest na ekranie. */
  const showListRecountOverlay = Boolean(estimating && lines);

  /** Blokery z pełnym Alertem nad listą — nie powtarzaj reason w sticky. */
  const createGateShownAsFullAlert =
    Boolean(boostNeedsRecount && lines) ||
    Boolean(historyNeedsRecount && lines) ||
    Boolean(historyFetchFailed && lines) ||
    Boolean(pendingIndividualsError) ||
    Boolean(pendingIndividualsTruncated) ||
    packagingPairConflicts.length > 0 ||
    explodeBomIncomplete ||
    !settingsTrusted ||
    Boolean(
      createDoneDokNr &&
        lines &&
        lines.length > 0 &&
        !postCreate &&
        !createUnlockedAfterDone
    );

  const servicesOnlyBlockerVisible =
    individualBundle.serviceLines.length > 0 && orderableLines.length === 0;

  /** Caption sticky — bez `estimating` (info jest na blurze listy). */
  const stickyCreateGateCaption =
    !createZdGate.ok &&
    !createGateShownAsFullAlert &&
    !servicesOnlyBlockerVisible &&
    !estimating
      ? createZdGate.reason
      : null;

  /** Caption w Alert odblokowania, gdy po odblokowaniu zostają inne gate'y. */
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
        setPendingIndividualsError(userFacingErrorTextFromMessage(res.message));
      }
    })();
  };

  /** Etykiety w oknie „Liczę…” — wyłącznie aktualny wybór, nie stary handoff. */
  const launchScopeLabel = activeScopeLabel;
  const launchScopeMode: "grupa" | "cecha" = scopeMode;

  // Scroll: start progress / resume / assign — celuj w scroll parent (appMain), nie window.
  useEffect(() => {
    if (showLaunchProgress || showSessionResumeProgress) {
      // Okno jest wyśrodkowane w scenie — `start` ściągałoby je do góry i psuło kompozycję.
      return scrollZdEstimateWhenReady(ZD_ESTIMATE_LAUNCH_FOCUS_ID, {
        initialDelayMs: 80,
        block: "center",
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
  }, [
    showLaunchProgress,
    showSessionResumeProgress,
    assignHint,
    launch?.fromDaily,
  ]);

  // Scroll na dół po reveal listy — raz na toast „Lista gotowa”.
  // Nie w deps `lines`: refresh par/BOM podczas toastu nie może gonić sticky.
  useEffect(() => {
    if (!launchReadyMessage) {
      launchRevealDoneRef.current = false;
      return;
    }
    if (!lines || showLaunchProgress || estimating) return;
    if (launchRevealDoneRef.current) return;
    launchRevealDoneRef.current = true;
    return scrollZdEstimateRevealListWhenReady({
      initialDelayMs: 80,
      settlePassesMs: [200, 450],
      maxAttempts: 28,
    });
  }, [launchReadyMessage, lines, showLaunchProgress, estimating]);

  // Scroll: reveal listy po wznowieniu sesji (raz na udany restore).
  const sessionRestoreRevealDoneRef = useRef(false);
  useEffect(() => {
    if (sessionRestorePending || !lines) {
      sessionRestoreRevealDoneRef.current = false;
      return;
    }
    if (showLaunchProgress || showSessionResumeProgress || estimating) return;
    if (sessionRestoreRevealDoneRef.current) return;
    if (!externalSessionRestoredRef.current) return;
    sessionRestoreRevealDoneRef.current = true;
    return scrollZdEstimateRevealListWhenReady({
      initialDelayMs: 60,
      settlePassesMs: [120, 280],
      maxAttempts: 24,
    });
  }, [
    sessionRestorePending,
    lines,
    showLaunchProgress,
    showSessionResumeProgress,
    estimating,
  ]);

  // Scroll: błąd po progress (menu i daily) — nie podczas postępu
  useEffect(() => {
    if ((!errorMessage && !feedback) || showLaunchProgress) return;
    if (!lastEstimateFailed && !(launch?.fromDaily || launch?.autorun)) return;
    return scrollZdEstimateWhenReady(ZD_ESTIMATE_ERROR_FOCUS_ID, {
      initialDelayMs: 80,
      block: "center",
      maxAttempts: 16,
    });
  }, [
    errorMessage,
    feedback,
    showLaunchProgress,
    lastEstimateFailed,
    launch?.fromDaily,
    launch?.autorun,
  ]);

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
        reportError(res.message);
        return;
      }
      setAssignHint(null);
      setScopeRemapActive(false);
      runEstimate({ fromLaunch: true });
    });
  };

  const beginChangeSupplierScope = () => {
    setPrepCollapsed(false);
    setScopeRemapActive(true);
  };

  const cancelChangeSupplierScope = () => {
    setScopeRemapActive(false);
  };

  const onBoostPresetChange = (next: ZdBoostPowerPreset) => {
    if (next === boostPreset) return;
    startMutate(async () => {
      const res = await actionSetZdBoostPowerPreset({ preset: next });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      setBoostPreset(res.preset);
      const hasList = Boolean(linesBase && linesBase.length > 0);
      if (hasList) {
        // Dirty tylko gdy różni się od mocy użytej przy ostatnim Policz.
        setBoostNeedsRecount(res.preset !== appliedBoostPreset);
      } else {
        setAppliedBoostPreset(res.preset);
        setAppliedBoostPolicy(policyForBoostPreset(res.preset));
        setBoostNeedsRecount(false);
      }
    });
  };

  const onExtrasPolicyChange = (next: ZdEstimateExtrasPolicy) => {
    if (next === extrasPolicy) return;
    startMutate(async () => {
      const res = await actionSetZdEstimateExtrasPolicy({ policy: next });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      setExtrasPolicy(res.policy);
      flashSettingsLive(
        res.policy === "max"
          ? "Prośby: maksimum względem niedoboru — Do ZD na bieżąco."
          : "Prośby: suma niedoboru i rezerwy — Do ZD na bieżąco."
      );
    });
  };

  const openScopesPanel = () => {
    setScopesPanelOpen(true);
  };

  const reviewInGroupCount = useMemo(() => {
    if (!lines) return 0;
    return lines.filter((l) =>
      isZdEstimatePendingReview({
        qtyReview: l.salesTrackQtyReview,
        accepted: acceptedReviewTwIds[l.tw_Id],
        excluded: orderExcludedTwIds.has(l.tw_Id),
      })
    ).length;
  }, [lines, acceptedReviewTwIds, orderExcludedTwIds]);

  /** Soft warn w Create — tylko pozycje z preview dokumentu (nie cały zakres). */
  const pendingReviewOnCreateCount = useMemo(() => {
    if (!createDialogPreview.lineCount) return 0;
    const byTw = new Map((lines ?? []).map((l) => [l.tw_Id, l]));
    let n = 0;
    for (const row of createDialogPreview.lines) {
      const l = byTw.get(row.twId);
      if (!l) continue;
      if (
        isZdEstimatePendingReview({
          qtyReview: l.salesTrackQtyReview,
          accepted: acceptedReviewTwIds[l.tw_Id],
          excluded: false,
        })
      ) {
        n += 1;
      }
    }
    return n;
  }, [
    createDialogPreview.lines,
    createDialogPreview.lineCount,
    lines,
    acceptedReviewTwIds,
  ]);

  const segmentFilteredLines = useMemo(() => {
    if (!lines) return [];
    if (!settingsTrusted) {
      // „Do ZD” wymaga DB + opakowań. Auto z nazwy można pokazać od razu.
      if (listFilter === "order") return [];
      if (listFilter === "excluded") {
        return lines.filter((l) => nameAutoByTwId.has(l.tw_Id));
      }
      if (listFilter === "review") {
        return lines.filter((l) =>
          isZdEstimatePendingReview({
            qtyReview: l.salesTrackQtyReview,
            accepted: acceptedReviewTwIds[l.tw_Id],
            excluded: orderExcludedTwIds.has(l.tw_Id),
          })
        );
      }
      return lines;
    }
    if (listFilter === "excluded") {
      return lines.filter((l) => orderExcludedTwIds.has(l.tw_Id));
    }
    if (listFilter === "review") {
      return lines.filter((l) =>
        isZdEstimatePendingReview({
          qtyReview: l.salesTrackQtyReview,
          accepted: acceptedReviewTwIds[l.tw_Id],
          excluded: orderExcludedTwIds.has(l.tw_Id),
        })
      );
    }
    if (listFilter === "all") {
      return lines;
    }
    return filterOrderableLinesWithPackaging(
      lines,
      packagingLookup,
      orderExcludedTwIds,
      individualExtraByTwId,
      qtyOverrideMap,
      extraOnlyTwIds,
      extrasPolicy
    );
  }, [
    lines,
    listFilter,
    orderExcludedTwIds,
    packagingLookup,
    settingsTrusted,
    nameAutoByTwId,
    individualExtraByTwId,
    qtyOverrideMap,
    extraOnlyTwIds,
    extrasPolicy,
    acceptedReviewTwIds,
  ]);

  const visibleLines = useMemo(() => {
    const searched = filterZdEstimateLinesBySearch(
      segmentFilteredLines,
      listSearch
    );
    return sortZdEstimateLines(
      searched,
      sortKey,
      sortDir,
      packagingLookup,
      individualExtraByTwId,
      qtyOverrideMap,
      extraOnlyTwIds,
      extrasPolicy
    );
  }, [
    segmentFilteredLines,
    listSearch,
    sortKey,
    sortDir,
    packagingLookup,
    individualExtraByTwId,
    qtyOverrideMap,
    extraOnlyTwIds,
    extrasPolicy,
  ]);

  const listSearchActive = listSearch.trim().length > 0;
  const listSearchNoHits =
    listSearchActive &&
    visibleLines.length === 0 &&
    segmentFilteredLines.length > 0;

  // Po filtrze / szukaniu: przytnij overscroll (timeouty = main+tabela;
  // ResizeObserver tylko tabela — clamp main w RO skakał przy sticky/gestach).
  useEffect(() => {
    if (!lines) return;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    const runAll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncZdEstimateFlexibleColumnStickyWidths();
        clampZdEstimateScrollSurfaces();
      });
    };
    const runTableOnly = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncZdEstimateFlexibleColumnStickyWidths();
        clampZdEstimateTableScroll();
      });
    };
    const t0 = window.setTimeout(runAll, 0);
    const t1 = window.setTimeout(runAll, 120);
    const t2 = window.setTimeout(runAll, 320);
    const tableEl = document.getElementById(ZD_ESTIMATE_TABLE_SCROLL_ID);
    const tableNode = document.querySelector(
      "table.data-table.zd-estimate-table"
    );
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => runTableOnly());
      if (tableEl) ro.observe(tableEl);
      if (tableNode) ro.observe(tableNode);
    }
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [listFilter, listSearch, lines, visibleLines.length]);

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

  /** Filtr listy — w fill-viewport tylko reset tabeli na początek (Create i tak widoczny). */
  const handleListFilterChange = useCallback((next: ListFilter) => {
    setListFilter(next);
    window.setTimeout(() => {
      resetZdEstimateTableScroll({ behavior: "auto" });
      clampZdEstimateScrollSurfaces();
    }, 40);
  }, []);

  const selectedLines = useMemo(() => {
    if (!lines) return [];
    return lines.filter((l) => selected[l.tw_Id]);
  }, [lines, selected]);

  const selectedCount = selectedLines.length;

  // Live count dla cleanup scrolla (Strict Mode / rapid toggle) — layout, nie render.
  useLayoutEffect(() => {
    selectedCountLiveRef.current = selectedCount;
  }, [selectedCount]);

  const visibleSelectedCount = useMemo(
    () => visibleLines.filter((l) => selected[l.tw_Id]).length,
    [visibleLines, selected]
  );
  /** Ostatnie liczniki — treść paska zostaje w DOM podczas animacji exit. */
  const [selectionExitCounts, setSelectionExitCounts] = useState({
    selected: 0,
    visible: 0,
  });
  // Sync bez useEffect — unikamy react-hooks/set-state-in-effect.
  if (
    selectedCount > 0 &&
    (selectionExitCounts.selected !== selectedCount ||
      selectionExitCounts.visible !== visibleSelectedCount)
  ) {
    setSelectionExitCounts({
      selected: selectedCount,
      visible: visibleSelectedCount,
    });
  }
  const selectionToolsOpen = selectedCount > 0;
  const selectionBarSelectedCount = selectionToolsOpen
    ? selectedCount
    : selectionExitCounts.selected;
  const selectionBarVisibleSelectedCount = selectionToolsOpen
    ? visibleSelectedCount
    : selectionExitCounts.visible;
  const allVisibleSelected =
    visibleLines.length > 0 && visibleSelectedCount === visibleLines.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected;

  const excludeEligibleLines = useMemo(
    () =>
      selectedLines.filter((l) => {
        if (bomRowHidesHardExclude(l)) return false;
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
  const onRequestEligibleLines = useMemo(
    () =>
      selectedLines.filter((l) => {
        if (!onRequestTrusted || !exclusionsTrusted) return false;
        if (bomRowHidesOnRequest(l)) return false;
        if (nameAutoByTwId.has(l.tw_Id)) return false;
        if (dbExcludedIds.has(l.tw_Id)) return false;
        const canonical = retargetTwIdToPackIfPiece(l.tw_Id, productPairs).twId;
        if (dbExcludedIds.has(canonical)) return false;
        if (onRequestTwIds.has(canonical)) return false;
        return true;
      }),
    [
      selectedLines,
      onRequestTrusted,
      exclusionsTrusted,
      nameAutoByTwId,
      dbExcludedIds,
      onRequestTwIds,
      productPairs,
    ]
  );
  const clearOnRequestEligibleLines = useMemo(
    () =>
      selectedLines.filter((l) => {
        if (!onRequestTrusted) return false;
        const canonical = retargetTwIdToPackIfPiece(l.tw_Id, productPairs).twId;
        return onRequestTwIds.has(canonical);
      }),
    [selectedLines, onRequestTrusted, onRequestTwIds, productPairs]
  );
  const packagingClearEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => packagingTrusted && packagingMap.has(l.tw_Id)
      ),
    [selectedLines, packagingTrusted, packagingMap]
  );

  const reviewEligibleLines = useMemo(
    () =>
      selectedLines.filter((l) =>
        isZdEstimatePendingReview({
          qtyReview: l.salesTrackQtyReview,
          accepted: acceptedReviewTwIds[l.tw_Id],
          excluded: orderExcludedTwIds.has(l.tw_Id),
        })
      ),
    [
      selectedLines,
      acceptedReviewTwIds,
      orderExcludedTwIds,
    ]
  );

  const bulkActionTruncationHint =
    Math.max(
      excludeEligibleLines.length,
      restoreEligibleLines.length,
      packagingClearEligibleLines.length,
      onRequestEligibleLines.length,
      clearOnRequestEligibleLines.length,
      reviewEligibleLines.length,
      selectedLines.length
    ) > ZD_ESTIMATE_BULK_MAX;

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    const prev = prevSelectedCountRef.current;
    const next = selectedCount;
    if (prev === next) return;

    if (skipSelectionScrollRef.current) {
      skipSelectionScrollRef.current = false;
      prevSelectedCountRef.current = next;
      return;
    }

    const twId = selectionScrollTwIdRef.current;
    let cancelled = false;
    let ran = false;
    const followUpCancel = { current: null as (() => void) | null };
    // Delay tylko przy zaznaczeniu (animacja paska). Przy odznaczeniu scroll od razu.
    // Strict Mode: cleanup NIE przesuwa prev, gdy count nadal = next (remount
    // zobaczy prev≠next i przełoży scroll). Szybkie 0→1→0: live count już ≠ next
    // → commit prev=next, żeby deselect effect miał prev=1.
    const t = window.setTimeout(() => {
      if (cancelled) return;
      ran = true;
      prevSelectedCountRef.current = next;
      followUpCancel.current = scrollZdEstimateAfterSelectionChange({
        prevCount: prev,
        nextCount: next,
        twId,
      });
    }, next > prev ? 50 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      followUpCancel.current?.();
      followUpCancel.current = null;
      if (
        !ran &&
        prevSelectedCountRef.current === prev &&
        selectedCountLiveRef.current !== next
      ) {
        prevSelectedCountRef.current = next;
      }
    };
  }, [selectedCount]);

  const toggleRowSelected = (twId: number, shiftKey = false) => {
    selectionScrollTwIdRef.current = twId;
    if (shiftKey && selectAnchorTwIdRef.current != null) {
      const anchor = selectAnchorTwIdRef.current;
      const ids = visibleLines.map((l) => l.tw_Id);
      const a = ids.indexOf(anchor);
      const b = ids.indexOf(twId);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = { ...prev };
          for (let i = lo; i <= hi; i++) next[ids[i]!] = true;
          return next;
        });
        selectAnchorTwIdRef.current = twId;
        return;
      }
    }
    setSelected((prev) => {
      const next = { ...prev };
      if (next[twId]) delete next[twId];
      else next[twId] = true;
      return next;
    });
    selectAnchorTwIdRef.current = twId;
  };

  const selectAllVisible = () => {
    selectionScrollTwIdRef.current =
      visibleLines[visibleLines.length - 1]?.tw_Id ?? null;
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of visibleLines) next[row.tw_Id] = true;
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      selectionScrollTwIdRef.current =
        visibleLines[0]?.tw_Id ?? selectionScrollTwIdRef.current;
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
      const onReq = await actionListZdEstimateOnRequests();
      if (onReq.ok) {
        applyOnRequestsLive(
          onReq.onRequests,
          res.exclusions.map((r) => r.subiektTwId)
        );
      }
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
    documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode;
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
        documentUnitMode: input.documentUnitMode,
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
        const onReq = await actionListZdEstimateOnRequests();
        if (onReq.ok) {
          applyOnRequestsLive(
            onReq.onRequests,
            res.exclusions.map((r) => r.subiektTwId)
          );
        }
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const markOnRequestLine = (line: ManualZdEstimateLine) => {
    setErrorMessage(null);
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionMarkZdEstimateOnRequest({
          subiektTwId: line.tw_Id,
          twSymbol: line.tw_Symbol,
          twNazwa: line.tw_Nazwa,
          grtId: selectedGroup?.grt_Id ?? line.tw_IdGrupa,
          grtNazwa: selectedGroup?.grt_Nazwa ?? line.grt_Nazwa,
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        setOnRequests(res.onRequests);
        setOnRequestsError(null);
        const nextOnRequest = onRequestTwIdSet(res.onRequests, productPairs);
        const freshEx = await actionListZdEstimateExclusions();
        if (freshEx.ok) {
          applyExclusionsMutation(freshEx.exclusions);
        }
        if (linesBase?.length) {
          recountEstimateLinesWithExcluded(
            buildExcludedIdsForSessionIncludes(
              sessionIncludeTwIds,
              freshEx.ok
                ? freshEx.exclusions.map((r) => r.subiektTwId)
                : exclusionsTrusted
                  ? dbExcludedIds
                  : [],
              nextOnRequest
            )
          );
          flashSettingsLive(
            "„Tylko na prośbę” zaktualizowane — lista przeliczona."
          );
        } else {
          flashSettingsLive("Zapisano „tylko na prośbę”.");
        }
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const clearOnRequestLine = (twId: number) => {
    setErrorMessage(null);
    setMutatingTwId(twId);
    startMutate(async () => {
      try {
        const res = await actionClearZdEstimateOnRequest(twId);
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyOnRequestsLive(res.onRequests);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const confirmBulkOnRequest = () => {
    const products = toBulkProducts(onRequestEligibleLines);
    if (!products.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionMarkZdEstimateOnRequestProducts({ products });
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      setOnRequests(res.onRequests);
      setOnRequestsError(null);
      const nextOnRequest = onRequestTwIdSet(res.onRequests, productPairs);
      clearBulkOnRequestSelection(
        res.succeededTwIds,
        products.map((p) => p.subiektTwId)
      );
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "oznaczeń „tylko na prośbę”"
      );
      const freshEx = await actionListZdEstimateExclusions();
      if (freshEx.ok) {
        applyExclusionsMutation(freshEx.exclusions);
      }
      if (linesBase?.length) {
        recountEstimateLinesWithExcluded(
          buildExcludedIdsForSessionIncludes(
            sessionIncludeTwIds,
            freshEx.ok
              ? freshEx.exclusions.map((r) => r.subiektTwId)
              : exclusionsTrusted
                ? dbExcludedIds
                : [],
            nextOnRequest
          )
        );
        flashSettingsLive(
          "„Tylko na prośbę” zaktualizowane — lista przeliczona."
        );
      }
    });
  };

  const confirmBulkClearOnRequest = () => {
    const ids = clearOnRequestEligibleLines.map((l) => l.tw_Id);
    if (!ids.length) return;
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionClearZdEstimateOnRequestProducts(ids);
      if (!res.ok) {
        reportError(res.message);
        return;
      }
      applyOnRequestsLive(res.onRequests);
      clearBulkOnRequestSelection(
        res.succeededTwIds,
        clearOnRequestEligibleLines.map((l) => l.tw_Id)
      );
      reportBulkPartial(
        res.succeededTwIds.length,
        res.failed,
        res.truncated,
        "usunięć „tylko na prośbę”"
      );
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
        setExclusionsError(userFacingErrorTextFromMessage(res.message));
        reportError(res.message);
        return;
      }
      applyExclusionsLive(res.exclusions);
    });
  };

  const retryLoadOnRequests = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimateOnRequests();
      if (!res.ok) {
        setOnRequestsError(userFacingErrorTextFromMessage(res.message));
        reportError(res.message);
        return;
      }
      applyOnRequestsLive(res.onRequests);
    });
  };

  const retryLoadPackaging = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const res = await actionListZdEstimatePackaging();
      if (!res.ok) {
        setPackagingError(userFacingErrorTextFromMessage(res.message));
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
        setProductPairsError(userFacingErrorTextFromMessage(res.message));
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
        setProductBomsError(userFacingErrorTextFromMessage(res.message));
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
        setTeethProductsError(userFacingErrorTextFromMessage(res.message));
        reportError(res.message);
        return;
      }
      setTeethTwIds(res.teethTwIds);
      setTeethProductsError(null);
    });
  };

  const retryLoadAllSettings = () => {
    setErrorMessage(null);
    startMutate(async () => {
      const [ex, onReq, pack, pairs, boms, teeth] = await Promise.all([
        actionListZdEstimateExclusions(),
        actionListZdEstimateOnRequests(),
        actionListZdEstimatePackaging(),
        actionListZdProductPairs(),
        actionListZdProductBoms(),
        actionListZdEstimateTeethTwIds(),
      ]);
      if (ex.ok) applyExclusionsLive(ex.exclusions);
      else setExclusionsError(userFacingErrorTextFromMessage(ex.message));
      if (onReq.ok) {
        applyOnRequestsLive(
          onReq.onRequests,
          ex.ok ? ex.exclusions.map((r) => r.subiektTwId) : undefined
        );
      } else setOnRequestsError(userFacingErrorTextFromMessage(onReq.message));
      if (pack.ok) applyPackagingLive(pack.packaging);
      else setPackagingError(userFacingErrorTextFromMessage(pack.message));
      let nextPairs = productPairs;
      let nextBoms = productBoms;
      if (pairs.ok) {
        pairsGenRef.current += 1;
        nextPairs = pairs.pairs;
        setProductPairs(pairs.pairs);
        setProductPairsError(null);
      } else setProductPairsError(userFacingErrorTextFromMessage(pairs.message));
      if (boms.ok) {
        nextBoms = boms.boms;
        setProductBoms(boms.boms);
        setProductBomsError(null);
      } else setProductBomsError(userFacingErrorTextFromMessage(boms.message));
      if (teeth.ok) {
        setTeethTwIds(teeth.teethTwIds);
        setTeethProductsError(null);
      } else setTeethProductsError(userFacingErrorTextFromMessage(teeth.message));
      if (linesBase?.length && (pairs.ok || boms.ok)) {
        reapplyPairsToLines(nextPairs, nextBoms);
      }
      const failed = [
        !ex.ok && "wykluczenia",
        !onReq.ok && "tylko na prośbę",
        !pack.ok && "opakowania",
        !pairs.ok && "pary",
        !boms.ok && "składy",
        !teeth.ok && "zęby",
      ].filter(Boolean);
      if (failed.length) {
        reportError(`Nie wczytano: ${failed.join(", ")}`);
      }
    });
  };

  const unifyPackagingWithPairs = () => {
    if (!packagingPairConflicts.length) return;
    startMutate(async () => {
      for (const c of packagingPairConflicts) {
        const line = lines?.find((l) => l.tw_Id === c.twId);
        const res = await actionUpsertZdEstimatePackaging({
          subiektTwId: c.twId,
          twSymbol: line?.tw_Symbol ?? c.symbol,
          twNazwa: line?.tw_Nazwa ?? c.nazwa,
          unitsPerPackage: c.pairUnitsPerPack,
          packageLabel: "op.",
          documentUnitMode: "packages",
          note: "Ujednolicone z parą montaż/demontaż",
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        // Po każdym sukcesie odśwież UI — partial fail nie zostawia stale.
        applyPackagingLive(res.packaging);
      }
    });
  };

  const labelMissingTw = (twId: number) => {
    const fromLine = lines?.find((l) => l.tw_Id === twId);
    if (fromLine) return fromLine.tw_Symbol;
    const pair = productPairs.find(
      (p) => p.packTwId === twId || p.pieceTwId === twId
    );
    if (pair?.packTwId === twId && pair.packSymbol) return pair.packSymbol;
    if (pair?.pieceTwId === twId && pair.pieceSymbol) return pair.pieceSymbol;
    for (const bom of productBoms) {
      if (bom.parentTwId === twId && bom.parentSymbol) return bom.parentSymbol;
      for (const c of bom.components ?? []) {
        if (c.componentTwId === twId && c.componentSymbol) {
          return c.componentSymbol;
        }
      }
    }
    return `id.${twId}`;
  };

  const openExclusionsPanel = () => {
    setExclusionsOpen(true);
    retryLoadExclusions();
  };

  const openOnRequestPanel = () => {
    setOnRequestPanelOpen(true);
    retryLoadOnRequests();
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
    documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode;
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
          documentUnitMode: input.documentUnitMode,
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
        orderableLinesToTsv(
          orderableLines,
          packagingLookup,
          individualExtraByTwId,
          qtyOverrideMap,
          extraOnlyTwIds,
          extrasPolicy
        )
      );
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      reportError("Nie udało się skopiować do schowka.");
    }
  };

  return (
    <div
      className={cn(
        zdEstimateWorkbenchStackClass,
        // Bez listy: scroll całego formularza, jeśli nie mieści się w oknie.
        // Przy liście workbench NIE scrolluje — tabela ma własny scrollport
        // (#zd-estimate-table-scroll); overflow tu psuje sticky nagłówki.
        !showLaunchProgress &&
          !showSessionResumeProgress &&
          !showQuietSessionRestore &&
          !lines &&
          "overflow-y-auto overscroll-contain",
        // Zjedz dolny py insetu (fill: py-2) — clearance docka jest końcem treści.
        showResultStickyActions &&
          !showLaunchProgress &&
          !showSessionResumeProgress &&
          !showQuietSessionRestore &&
          "-mb-2"
      )}
    >
      {showLaunchProgress && launchStartedAtMs != null ? (
        <div className="flex min-h-0 flex-1 flex-col">
        <ZdEstimateLaunchProgressPanel
          key={launchStartedAtMs}
          supplierName={activeSupplierName}
          scopeLabel={launchScopeLabel}
          scopeMode={launchScopeMode}
          startedAtMs={launchStartedAtMs}
          scopeAlreadyResolved={
            Boolean(launchScopeLabel) || launchHasRunnableScope(launch)
          }
          forceComplete={launchForceComplete}
          ordersIsLive={bootstrap.ordersIsLive}
          host={{
            configured: bootstrap.configured,
            isLive: bootstrap.ordersIsLive,
            port: bootstrap.ordersPort ?? bootstrap.testPort,
            salesEndFromFs: bootstrap.salesEndFromFs,
            salesEndKeyFormatted: bootstrap.salesEndFromFs
              ? formatPlDate(bootstrap.salesEndKey)
              : null,
          }}
        />
        </div>
      ) : null}

      {showSessionResumeProgress ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ZdEstimateSessionResumeProgressPanel
            key={sessionResumeStartedAtMsRef.current}
            startedAtMs={sessionResumeStartedAtMsRef.current}
            returningFromAway={sessionResumeReturningFromAway}
            forceComplete={sessionResumeForceComplete}
            supplierName={activeSupplierName}
            scopeLabel={activeScopeLabel}
            scopeMode={scopeMode}
            ordersIsLive={bootstrap.ordersIsLive}
            host={{
              configured: bootstrap.configured,
              isLive: bootstrap.ordersIsLive,
              port: bootstrap.ordersPort ?? bootstrap.testPort,
              salesEndFromFs: bootstrap.salesEndFromFs,
              salesEndKeyFormatted: bootstrap.salesEndFromFs
                ? formatPlDate(bootstrap.salesEndKey)
                : null,
            }}
          />
        </div>
      ) : null}

      {showQuietSessionRestore ? (
        <div
          className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 px-4 py-10"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner className="size-6 text-slate-500" />
          <p className="text-sm font-medium text-slate-700">
            Przywracanie listy…
          </p>
        </div>
      ) : null}

      {/* Podczas przygotowania z panelu — tylko checklista, bez szumu formularza. */}
      {!showLaunchProgress && !showSessionResumeProgress && !sessionRestorePending ? (
        <>
      <ZdEstimatePageIntro
        hint={zdEstimatePageHint({
          isLive: bootstrap.ordersIsLive,
          configured: bootstrap.configured,
        })}
        facts={
          scopeSelected && scopeLabel ? (
            <ZdEstimatePrepScopeFacts
              variant="toolbar"
              scopeMode={scopeMode}
              scopeName={scopeLabel}
              stockLabel={stockLabel}
              dniZapasu={dniZapasu}
              supplierLabel={supplierLabel}
              dataOd={dataOd}
              dataDo={dataDo}
            />
          ) : null
        }
        actions={
          <>
            {(() => {
              const showChangeScope = Boolean(lines && prepCollapsed);
              const showCollapse = Boolean(lines && !prepCollapsed);
              const showChangeSupplier = Boolean(
                launch?.supplierId && !scopeRemapActive && !assignHint
              );
              const hasScopeOverflow =
                showChangeScope || showCollapse || showChangeSupplier;
              if (!hasScopeOverflow) return null;
              return (
                <OverflowMenu
                  label={ZD_ESTIMATE_UI.scopeMenuAriaLabel}
                  align="end"
                  triggerLabel={ZD_ESTIMATE_UI.scopeMenuTrigger}
                  triggerLeading={
                    <IconLayers
                      size={14}
                      strokeWidth={2}
                      className="shrink-0 opacity-90"
                    />
                  }
                  triggerTrailing={
                    <IconChevronDown
                      size={13}
                      strokeWidth={2.25}
                      className="shrink-0 opacity-70"
                    />
                  }
                  triggerClassName={zdEstimateToolbarActionClass}
                  disabled={mutating || estimating}
                >
                  <OverflowMenuLabel>
                    {ZD_ESTIMATE_UI.scopeMenuTrigger}
                  </OverflowMenuLabel>
                  {showChangeScope ? (
                    <OverflowMenuItem
                      onClick={() => setPrepCollapsed(false)}
                    >
                      {ZD_ESTIMATE_UI.scopeMenuExpandItem}
                    </OverflowMenuItem>
                  ) : null}
                  {showCollapse ? (
                    <OverflowMenuItem onClick={() => setPrepCollapsed(true)}>
                      {ZD_ESTIMATE_UI.scopeMenuCollapseItem}
                    </OverflowMenuItem>
                  ) : null}
                  {showChangeSupplier ? (
                    <OverflowMenuItem
                      onClick={beginChangeSupplierScope}
                      disabled={mutating || estimating}
                    >
                      {ZD_ESTIMATE_UI.changeSupplierScopeCta}
                    </OverflowMenuItem>
                  ) : null}
                </OverflowMenu>
              );
            })()}
            <ZdEstimateSuppliersMenu
              todayUnmappedCount={todayCoverage.unmapped.length}
              onOpenScopes={openScopesPanel}
              onOpenSnapshots={() => setSnapshotsPanelOpen(true)}
              disabled={mutating || estimating}
              compact
              triggerClassName={zdEstimateToolbarMenuClass}
            />
            <ZdEstimateDepartmentSettingsMenu
              exclusionsCount={exclusions.length}
              onRequestsCount={onRequests.length}
              packagingCount={packaging.length}
              pairsCount={productPairs.length}
              bomsCount={productBoms.length}
              onOpenExclusions={openExclusionsPanel}
              onOpenOnRequest={openOnRequestPanel}
              onOpenPackaging={openPackagingPanel}
              onOpenPairs={openPairsPanel}
              onOpenBoms={openBomsPanel}
              disabled={mutating || estimating}
              compact
              triggerClassName={zdEstimateToolbarMenuClass}
            />
          </>
        }
        host={{
          configured: bootstrap.configured,
          isLive: bootstrap.ordersIsLive,
          port: bootstrap.ordersPort ?? bootstrap.testPort,
          salesEndFromFs: bootstrap.salesEndFromFs,
          salesEndKeyFormatted: bootstrap.salesEndFromFs
            ? formatPlDate(bootstrap.salesEndKey)
            : null,
        }}
      />
      {launchReadyMessage ? (
        <Toast
          tone="success"
          title={zdEstimateLaunchReadyToastTitle()}
          description={launchReadyMessage}
          durationMs={6500}
          onDismiss={() => setLaunchReadyMessage(null)}
          className={cn(
            floatingToastAboveZdStickyClass,
            stickyCreateGateCaption || selectedCount > 0
              ? floatingToastAboveZdStickyTallClass
              : undefined
          )}
        />
      ) : null}

      {externalSessionRestoredToast ? (
        <Toast
          tone="success"
          title={zdEstimateExternalSessionRestoredToastTitle}
          description={externalSessionRestoredToast}
          durationMs={8000}
          onDismiss={() => setExternalSessionRestoredToast(null)}
          className={cn(
            floatingToastAboveZdStickyClass,
            stickyCreateGateCaption || selectedCount > 0
              ? floatingToastAboveZdStickyTallClass
              : undefined
          )}
        />
      ) : null}

      <div className="flex shrink-0 flex-col gap-1.5">
      {externalSessionExpiredAlert ? (
        <Alert tone="warning" title={zdEstimateExternalSessionExpiredAlertTitle}>
          {zdEstimateExternalSessionExpiredAlertBody}
        </Alert>
      ) : null}

      {externalSessionRestoreFailedAlert ? (
        <Alert
          tone="warning"
          title={zdEstimateExternalSessionRestoreFailedAlertTitle}
        >
          {zdEstimateExternalSessionRestoreFailedAlertBody}
        </Alert>
      ) : null}

      {externalSessionPersistFailedAlert && lines ? (
        <Alert
          tone="warning"
          title={zdEstimateExternalSessionPersistFailedAlertTitle}
        >
          {zdEstimateExternalSessionPersistFailedAlertBody}
        </Alert>
      ) : null}

      {/* Status LIVE/test jest w ZdEstimatePageIntro — tu tylko blokada. */}
      {!bootstrap.configured ? (
        <Alert tone="error" title="Kreator ZD zablokowany">
          {zdEstimateBlockedOrdersAlertBody(bootstrap.ordersMessage)}
        </Alert>
      ) : null}

      {postCreate ? (
        <ZdEstimatePostCreatePanel
          session={postCreate}
          dateKey={bootstrap.todayKey}
          createLocked={
            !createUnlockedAfterDone &&
            (createUnconfirmedAttempt ||
              (createDoneDokId != null && createDoneDokId > 0) ||
              Boolean(createDoneDokNr))
          }
          onDismiss={() => {
            setPostCreate(null);
            setLinkNrPrefill(null);
          }}
          onOpenLink={() => {
            setLinkNrPrefill(
              postCreate.linkNrPrefill ?? postCreate.dokNrPelny ?? null
            );
            openLinkZdModal();
          }}
          onUnlockCreate={() => {
            setCreateUnlockedAfterDone(true);
            setCreateUndoVisible(false);
            // Nie kasuj timeoutRecoveryFreezeRef — link po odblokowaniu
            // nadal musi mieć submit freeze + durable consume.
          }}
          onCopyError={reportError}
          onGlowneMarked={({ processedIds, dropPendingIds }) => {
            const marked = new Set(processedIds);
            const drop = new Set(dropPendingIds);
            const freezeForStubs = postCreate?.markFreeze;
            glowneUndoOrderIdsRef.current = [...processedIds];
            setPendingIndividuals((prev) => {
              const fromLive = prev.filter((o) => marked.has(o.id));
              const have = new Set(fromLive.map((o) => o.id));
              const fromFreeze = freezeForStubs
                ? undoStubsFromMarkFreeze(freezeForStubs, processedIds).filter(
                    (o) => !have.has(o.id)
                  )
                : [];
              glowneRemovedForUndoRef.current = [...fromLive, ...fromFreeze];
              return prev.filter((o) => !drop.has(o.id));
            });
            setPostCreate((prev) =>
              prev
                ? applyGlowneMarkResultToPostCreateSession(prev, {
                    processedIds,
                    dropPendingIds,
                  })
                : prev
            );
          }}
          onScheduleMarked={() => {
            setPostCreate((prev) =>
              prev ? { ...prev, scheduleDone: true } : prev
            );
          }}
          onUndoMark={(kind) => {
            if (kind === "glowne") {
              const restored = glowneRemovedForUndoRef.current;
              const undoIds = [
                ...new Set(
                  (glowneUndoOrderIdsRef.current.length
                    ? glowneUndoOrderIdsRef.current
                    : restored.map((o) => o.id)
                  )
                    .map((id) => String(id ?? "").trim())
                    .filter(Boolean)
                ),
              ];
              glowneRemovedForUndoRef.current = [];
              glowneUndoOrderIdsRef.current = [];
              // Bez ID ostatniej paczki — nie ruszaj sesji (nie cofaj całego Główne).
              if (!undoIds.length) return;
              const restoreSet = new Set(undoIds);
              setPostCreate((prev) => {
                if (!prev) return prev;
                const glowneMarkedIds = prev.glowneMarkedIds.filter(
                  (id) => !restoreSet.has(id)
                );
                const pendingGlowneCatalogIds = [
                  ...new Set([
                    ...prev.markFreeze.pendingGlowneCatalogIds,
                    ...undoIds.filter((id) =>
                      prev.markFreeze.catalogRequests.some(
                        (r) => r.orderId === id
                      )
                    ),
                  ]),
                ];
                const pendingGlowneServiceIds = [
                  ...new Set([
                    ...prev.markFreeze.pendingGlowneServiceIds,
                    ...undoIds.filter(
                      (id) =>
                        !prev.markFreeze.catalogRequests.some(
                          (r) => r.orderId === id
                        )
                    ),
                  ]),
                ];
                const remaining =
                  pendingGlowneCatalogIds.length +
                  pendingGlowneServiceIds.length;
                return {
                  ...prev,
                  glowneMarkedIds,
                  glowneDone: remaining === 0,
                  markFreeze: {
                    ...prev.markFreeze,
                    pendingGlowneCatalogIds,
                    pendingGlowneServiceIds,
                  },
                };
              });
              const stubs =
                restored.length > 0
                  ? restored
                  : postCreate?.markFreeze
                    ? undoStubsFromMarkFreeze(postCreate.markFreeze, undoIds)
                    : [];
              if (stubs.length) {
                setPendingIndividuals((prev) => {
                  const have = new Set(prev.map((o) => o.id));
                  return [
                    ...stubs.filter((o) => !have.has(o.id)),
                    ...prev,
                  ];
                });
              }
              return;
            }
            setPostCreate((prev) =>
              prev ? { ...prev, scheduleDone: false } : prev
            );
          }}
        />
      ) : null}

      {pendingIndividualsError ? (
        <Alert tone="error" title="Nie wczytano próśb">
          <span className="block">{pendingIndividualsError}</span>
          <span className="mt-1 block text-sm">
            {ZD_ESTIMATE_UI.createGatePendingIndividualsError}
          </span>
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
          szacunku. {ZD_ESTIMATE_UI.createGatePendingIndividualsTruncated}
        </Alert>
      ) : null}

      {createDoneDokNr && lines && lines.length > 0 && !postCreate ? (
        <Alert
          tone={
            createUnlockedAfterDone && createZdGate.ok
              ? "success"
              : "warning"
          }
          title={
            !createUnlockedAfterDone
              ? createUnconfirmedAttempt
                ? "Tworzenie ZD zablokowane (timeout)"
                : "Tworzenie ZD zablokowane"
              : createZdGate.ok
                ? "Tworzenie ZD odblokowane świadomie"
                : "Tworzenie ZD odblokowane — inne blokady"
          }
        >
          {createUnconfirmedAttempt && !createUnlockedAfterDone
            ? ZD_ESTIMATE_UI.postCreateTimeoutLockBody
            : <>
                Z tej listy utworzono już {createDoneDokNr}.{" "}
                {!createUnlockedAfterDone
                  ? "Przelicz listę, użyj „Powiąż ZD” albo odblokuj świadomie."
                  : createZdGate.ok
                    ? "Możesz utworzyć kolejne ZD — uważaj na duplikaty w Subiekcie."
                    : createZdGateCaption ?? createZdGate.reason}
              </>}
          {!createUnlockedAfterDone && !createUndoVisible ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setCreateUnlockedAfterDone(true);
                setCreateUndoVisible(false);
              }}
            >
              Odblokuj tworzenie ZD (świadomie)
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {assignHint ? (
        <div id={ZD_ESTIMATE_ASSIGN_FOCUS_ID} className="scroll-mt-4">
          <Alert tone="warning" title={ZD_ESTIMATE_UI.assignSupplierScopeTitle}>
            {assignHint}
            {activeSupplierName ? (
              <span className="mt-1 block text-sm">
                Dostawca: <strong>{activeSupplierName}</strong>
              </span>
            ) : null}
            {pendingIndividualsLoading ? (
              <span className="mt-1 block text-sm text-slate-600">
                Wczytuję prośby handlowców…
              </span>
            ) : pendingIndividuals.length > 0 ? (
              <span className="mt-1 block text-sm">
                Wczytano {pendingIndividuals.length}{" "}
                {zdEstimateProsbaWordAccusative(pendingIndividuals.length)} —
                wejdą
                do kreatora po Policz.
              </span>
            ) : pendingIndividualsError ? (
              <span className="mt-1 block text-sm text-amber-900">
                Prośby nie wczytane — użyj „Wczytaj ponownie” powyżej.
              </span>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {scopeRemapActive && !assignHint ? (
        <div id={ZD_ESTIMATE_ASSIGN_FOCUS_ID} className="scroll-mt-4">
          <Alert tone="warning" title={ZD_ESTIMATE_UI.changeSupplierScopeTitle}>
            {ZD_ESTIMATE_UI.changeSupplierScopeHint}
            {activeSupplierName ? (
              <span className="mt-1 block text-sm">
                Dostawca: <strong>{activeSupplierName}</strong>
              </span>
            ) : null}
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={cancelChangeSupplierScope}
                disabled={mutating || estimating}
              >
                {ZD_ESTIMATE_UI.changeSupplierScopeCancelCta}
              </Button>
            </div>
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
      </div>

      <ZdEstimatePinnedAlertStack
        items={[
          exclusionsError ||
          onRequestsError ||
          packagingError ||
          productPairsError ||
          productBomsError ||
          teethProductsError ? (
          <ZdEstimateSettingsTrustBanner
            key="settings-trust"
            parts={{
              exclusions: exclusionsError,
              onRequest: onRequestsError,
              packaging: packagingError,
              pairs: productPairsError,
              boms: productBomsError,
              teeth: teethProductsError,
            }}
            mutating={mutating}
            onRetryAll={retryLoadAllSettings}
            onRetryPart={(key) => {
              if (key === "exclusions") retryLoadExclusions();
              else if (key === "onRequest") retryLoadOnRequests();
              else if (key === "packaging") retryLoadPackaging();
              else if (key === "pairs") retryLoadPairs();
              else if (key === "boms") retryLoadBoms();
              else retryLoadTeeth();
            }}
          />
          ) : null,
          boostNeedsRecount && lines ? (
            <Alert
              key="boost-recount"
              tone="warning"
              title={ZD_ESTIMATE_UI.boostNeedsRecountTitle}
            >
              <p className="text-sm leading-snug">
                {ZD_ESTIMATE_UI.boostNeedsRecountBody}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={
                  estimating ||
                  mutating ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                onClick={() => runEstimate()}
              >
                {ZD_ESTIMATE_UI.boostNeedsRecountCta}
              </Button>
            </Alert>
          ) : null,
          historyNeedsRecount && lines ? (
            <Alert
              key="history-recount"
              tone="warning"
              title={ZD_ESTIMATE_UI.historyNeedsRecountTitle}
            >
              <p className="text-sm leading-snug">
                {ZD_ESTIMATE_UI.historyNeedsRecountBody}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={
                  estimating ||
                  mutating ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                onClick={() => runEstimate()}
              >
                {ZD_ESTIMATE_UI.historyNeedsRecountCta}
              </Button>
            </Alert>
          ) : null,
          historyFetchFailed && lines ? (
            <Alert
              key="history-fetch-failed"
              tone="error"
              title={ZD_ESTIMATE_UI.historyFetchFailedTitle}
            >
              <p className="text-sm leading-snug">
                {ZD_ESTIMATE_UI.historyFetchFailedBody}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={
                  estimating ||
                  mutating ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                onClick={() => runEstimate()}
              >
                {ZD_ESTIMATE_UI.historyFetchFailedCta}
              </Button>
            </Alert>
          ) : null,
          packagingPairConflicts.length > 0 ? (
            <Alert
              key="packaging-pair"
              tone="warning"
              title={ZD_ESTIMATE_UI.packagingPairConflictTitle}
            >
              <p className="text-sm leading-snug">
                {(() => {
                  const hasMode = packagingPairConflicts.some(
                    (c) => c.reason === "pieces_multiple_mode"
                  );
                  const hasUnits = packagingPairConflicts.some(
                    (c) => c.reason === "units_mismatch"
                  );
                  const n = packagingPairConflicts.length;
                  const mod10 = n % 10;
                  const mod100 = n % 100;
                  const countLabel =
                    n === 1
                      ? "1 paczka ma"
                      : mod10 >= 2 &&
                          mod10 <= 4 &&
                          (mod100 < 10 || mod100 >= 20)
                        ? `${n} paczki mają`
                        : `${n} paczek ma`;
                  const body =
                    hasMode && hasUnits
                      ? ZD_ESTIMATE_UI.packagingPairConflictMixedBody
                      : hasMode
                        ? ZD_ESTIMATE_UI.packagingPairConflictModeBody
                        : ZD_ESTIMATE_UI.packagingPairConflictUnitsBody;
                  return `${countLabel} ${body}`;
                })()}
              </p>
              <ul className="mt-2 space-y-0.5 text-[12px] text-slate-700">
                {packagingPairConflicts.slice(0, 8).map((c) => (
                  <li key={c.twId}>{formatZdPackagingPairConflictHint(c)}</li>
                ))}
                {packagingPairConflicts.length > 8 ? (
                  <li>…i {packagingPairConflicts.length - 8} więcej</li>
                ) : null}
              </ul>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                disabled={mutating || estimating}
                onClick={unifyPackagingWithPairs}
              >
                Ujednolić opakowanie z parą
              </Button>
            </Alert>
          ) : null,
          explodeBomIncomplete ? (
            <Alert
              key="explode-bom"
              tone="warning"
              title={ZD_BOM_UI.alertExplodeIncompleteTitle}
            >
              <p className="text-sm leading-snug">
                {ZD_BOM_UI.alertExplodeIncompleteBody}
              </p>
            </Alert>
          ) : null,
          feedback ? (
            <div key="feedback" id={ZD_ESTIMATE_ERROR_FOCUS_ID} className="scroll-mt-4">
              <SubiektFeedbackAlert feedback={feedback} />
            </div>
          ) : errorMessage ? (
            <div key="error" id={ZD_ESTIMATE_ERROR_FOCUS_ID} className="scroll-mt-4">
              <Alert tone="error" title="Błąd">
                {errorMessage}
              </Alert>
            </div>
          ) : null,
        ]}
      />

        </>
      ) : null}

      {!showLaunchProgress && !showSessionResumeProgress && prepFormOpen ? (
      <Card
        padding={false}
        className={cn(
          "relative flex shrink-0 flex-col overflow-visible",
          zdEstimateCardSurfaceClass
        )}
      >
        <CardHeader
          inset
          density="compact"
          className={zdEstimatePrepFormInsetXClass}
          title="Zakres i polityki"
          hint={zdEstimatePrepCardHint()}
          description={zdEstimatePrepIdleLead()}
        />

        <div className={zdEstimatePrepIdleBodyClass}>
        <div className="min-w-0 space-y-3">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={cn(
                  panelTypography.sectionLabel,
                  "text-xs tracking-wide text-slate-700"
                )}
              >
                Zakres
              </p>
              <SegmentedControl
                ariaLabel="Tryb zakresu szacunku"
                value={scopeMode}
                onChange={changeScopeMode}
                touchFriendly
                options={[
                  {
                    value: "grupa",
                    label: "Grupa",
                    title: zdEstimateScopeModeGrupaHint(),
                  },
                  {
                    value: "cecha",
                    label: "Cecha",
                    title: zdEstimateScopeModeCechaHint(),
                  },
                ]}
              />
            </div>

            {scopeMode === "grupa" ? (
              <>
                <div className="flex flex-wrap content-start gap-2">
                  {bootstrap.quickGroups.length === 0 ? (
                    <p className="w-full text-sm leading-snug text-slate-600">
                      Brak skrótów grup — wyszukaj grupę poniżej.
                    </p>
                  ) : null}
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
                          "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-left text-sm leading-none transition",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5"
                            : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className="max-w-[16rem] truncate font-medium">
                          {g.grt_Nazwa}
                        </span>
                        {g.dniZapasu != null ? (
                          <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                            {g.dniZapasu}d
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch
                      size={18}
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
                      className="h-11 pl-10 text-sm"
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
                  <ul
                    className={cn(
                      "max-h-44 divide-y divide-slate-100 overflow-y-auto border border-slate-200/90 bg-white",
                      zdEstimateRadiusNestedClass,
                      zdEstimateShadowControlClass
                    )}
                  >
                    {groupHits.map((g) => (
                      <li key={g.grt_Id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left text-sm transition hover:bg-slate-50",
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
                <p className="text-sm leading-snug text-slate-600">
                  {zdEstimateCechaScopeCaption()}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch
                      size={18}
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
                      className="h-11 pl-10 text-sm"
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
                  <ul
                    className={cn(
                      "max-h-44 divide-y divide-slate-100 overflow-y-auto border border-slate-200/90 bg-white",
                      zdEstimateRadiusNestedClass,
                      zdEstimateShadowControlClass
                    )}
                  >
                    {cechaHits.map((c) => (
                      <li key={c.ctw_Id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left text-sm transition hover:bg-slate-50",
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
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {scopeSelected && scopeLabel ? (
            <ZdEstimatePrepScopeFacts
              variant="card"
              scopeMode={scopeMode}
              scopeName={scopeLabel}
              stockLabel={stockLabel}
              dniZapasu={dniZapasu}
              supplierLabel={supplierLabel}
              dataOd={dataOd}
              dataDo={dataDo}
              tone={
                !settingsTrusted || scopeNeedsRecount ? "warn" : "ready"
              }
              caption={
                !settingsTrusted
                  ? zdEstimateNeedsSettingsHint()
                  : scopeNeedsRecount
                    ? zdEstimateScopeChangedHint()
                    : zdEstimateScopeLinkedCaption()
              }
            />
          ) : (
            <div
              className={cn(
                "border-dashed px-3.5 py-3 text-sm leading-relaxed text-slate-700",
                zdEstimateNestedWellClass
              )}
            >
              {zdEstimateScopeDashedHint(scopeMode)}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  panelTypography.sectionLabel,
                  "text-xs tracking-wide text-slate-700"
                )}
              >
                {ZD_ESTIMATE_UI.policiesSectionLabel}
              </p>
              <HelpHintBubble
                message={zdEstimatePoliciesSectionHint()}
                tone="slate"
                size="md"
                ariaLabel="Co robią polityki liczenia"
              />
            </div>
            <div className="flex flex-col gap-2 sm:gap-2.5">
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0 text-sm font-medium text-slate-700 sm:w-[8.5rem]">
                  {ZD_ESTIMATE_UI.boostPowerLabel}
                </span>
                <SegmentedControl
                  ariaLabel={ZD_ESTIMATE_UI.boostPowerAriaLabel}
                  value={boostPreset}
                  onChange={onBoostPresetChange}
                  disabled={mutating || estimating}
                  touchFriendly
                  className="w-full sm:w-auto sm:max-w-none"
                  options={ZD_BOOST_PRESET_DEFS.map((def) => ({
                    value: def.id,
                    label: def.shortLabel,
                    title: def.hint,
                  }))}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0 text-sm font-medium text-slate-700 sm:w-[8.5rem]">
                  {ZD_ESTIMATE_UI.extrasPolicyLabel}
                </span>
                <SegmentedControl
                  ariaLabel={ZD_ESTIMATE_UI.extrasPolicyAriaLabel}
                  value={extrasPolicy}
                  onChange={onExtrasPolicyChange}
                  disabled={mutating || estimating}
                  touchFriendly
                  className="w-full sm:w-auto"
                  options={[
                    {
                      value: "sum" as const,
                      label: ZD_ESTIMATE_UI.extrasPolicySumShort,
                      title: ZD_ESTIMATE_UI.extrasPolicySumHint,
                    },
                    {
                      value: "max" as const,
                      label: ZD_ESTIMATE_UI.extrasPolicyMaxShort,
                      title: ZD_ESTIMATE_UI.extrasPolicyMaxHint,
                    },
                  ]}
                />
              </div>
            </div>
          </section>
        </div>

        {showAdvanced ? (
          <div
            id="zd-estimate-prep-advanced"
            className={cn(
              "space-y-3 p-3.5 sm:p-4 lg:col-span-2",
              zdEstimateNestedWellClass
            )}
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Dostawca (nadpisanie)"
                hint={ZD_ESTIMATE_UI.advancedSupplierOverrideHint}
              >
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
              <Field
                label="Dni zapasu"
                hint={ZD_ESTIMATE_UI.advancedDniZapasuHint}
              >
                <Input
                  type="number"
                  min={1}
                  max={730}
                  value={dniZapasu}
                  onChange={(e) => onDniZapasuChange(e.target.value)}
                />
              </Field>
              <Field
                label="Data od"
                hint={ZD_ESTIMATE_UI.advancedDataOdHint}
              >
                <Input
                  type="date"
                  value={dataOd}
                  onChange={(e) => onManualDataOdChange(e.target.value)}
                />
              </Field>
              <Field
                label="Data do"
                hint={ZD_ESTIMATE_UI.advancedDataDoHint}
              >
                <Input
                  type="date"
                  value={dataDo}
                  onChange={(e) => onManualDataDoChange(e.target.value)}
                />
              </Field>
            </div>
            {salesWindowSource === "manual" ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
                <span className="font-medium">
                  {ZD_ESTIMATE_UI.advancedSalesWindowManualNote}
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
            <div className="grid gap-2 sm:grid-cols-2">
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

          <div
            id={ZD_ESTIMATE_POLICZ_CTA_ID}
            className={zdEstimatePrepIdleFooterClass}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-slate-900"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              aria-controls="zd-estimate-prep-advanced"
            >
              <IconChevronDown
                size={15}
                strokeWidth={2}
                className={cn(
                  "transition-transform duration-150",
                  showAdvanced && "rotate-180"
                )}
              />
              {showAdvanced ? "Ukryj zaawansowane" : "Zaawansowane"}
            </button>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
              {scopeSelected && scopeNeedsRecount ? (
                <p className="max-w-sm text-sm leading-snug text-amber-800 sm:text-right">
                  {zdEstimateScopeChangedHint()}
                </p>
              ) : null}
              {scopeSelected &&
              !scopeNeedsRecount &&
              !(boostNeedsRecount && lines) &&
              !(historyNeedsRecount && lines) &&
              canPolicz ? (
                <p className="text-sm leading-snug text-emerald-800 sm:text-right">
                  {zdEstimateReadyToCountHint()}
                </p>
              ) : null}
              {scopeSelected && !settingsTrusted ? (
                <p className="max-w-sm text-sm leading-snug text-amber-800 sm:text-right">
                  {zdEstimateNeedsSettingsHint()}
                </p>
              ) : null}
              <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:justify-end">
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
                        ? zdEstimateCountingButtonLabel()
                        : "Policz listę do ZD z Subiekta"
              }
              className={cn(
                zdEstimatePrepPrimaryButtonClass,
                "h-11 min-h-11 text-sm sm:min-w-[12rem]",
                canPolicz &&
                  !estimating &&
                  "shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/25"
              )}
            >
              {estimating ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3.5" /> {zdEstimateCountingButtonLabel()}
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
                className={zdEstimatePrepPrimaryButtonClass}
              >
                {mutating ? "Zapisuję…" : "Zapisz zakres i policz"}
              </Button>
            ) : null}
            {scopeRemapActive && !assignHint && launch?.supplierId ? (
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
                className={zdEstimatePrepPrimaryButtonClass}
              >
                {mutating ? "Zapisuję…" : "Zapisz zakres i policz"}
              </Button>
            ) : null}
              </div>
            </div>
          </div>
      </Card>
      ) : null}

      {!showLaunchProgress && !showSessionResumeProgress && !sessionRestorePending ? (
        <>

      {kitOnlyBlockedAlertCount > 0 ||
      pairPartnerMissingCount > 0 ||
      (bomMissingCount > 0 && !explodeBomIncomplete) ||
      Boolean(settingsLiveMessage) ||
      (Boolean(lines) &&
        excludedWithIndividualCount > 0 &&
        excludedRoutedToServicesCount === 0) ? (
      <div className={zdEstimateSoftStatusStripClass}>
      {kitOnlyBlockedAlertCount > 0 ? (
        <Alert tone="warning" title={ZD_BOM_UI.alertKitOnlySalesTitle}>
          <p className="text-sm leading-snug">
            {ZD_BOM_UI.alertKitOnlySalesBody(kitOnlyBlockedAlertCount)}
          </p>
        </Alert>
      ) : null}
      <ZdEstimateAlertBucket
        key={[
          pairPartnerMissingCount,
          bomMissingCount > 0 && !explodeBomIncomplete ? bomMissingCount : 0,
          settingsLiveMessage ? 1 : 0,
          lines &&
          excludedWithIndividualCount > 0 &&
          excludedRoutedToServicesCount === 0
            ? excludedWithIndividualCount
            : 0,
        ].join(":")}
        title="Inne uwagi"
        defaultOpen={
          pairPartnerMissingCount > 0 ||
          (bomMissingCount > 0 && !explodeBomIncomplete) ||
          (Boolean(lines) &&
            excludedWithIndividualCount > 0 &&
            excludedRoutedToServicesCount === 0)
        }
        items={[
          pairPartnerMissingCount > 0 ? (
            <Alert tone="warning" title="Brak partnera pary w szacunku">
              <p className="text-sm leading-snug">
                Nie udało się dociągnąć {pairPartnerMissingCount}{" "}
                {pairPartnerMissingCount === 1 ? "towaru" : "towarów"} z pary —
                linie tych paczek mają ilość 0 (albo tylko prośbę). Reszta listy
                nadal może iść na ZD.
              </p>
              {missingPartnerTwIds.length > 0 ? (
                <p className="mt-1.5 text-[12px] text-slate-700">
                  {missingPartnerTwIds
                    .slice(0, 12)
                    .map((id) => labelMissingTw(id))
                    .join(", ")}
                  {missingPartnerTwIds.length > 12
                    ? ` …+${missingPartnerTwIds.length - 12}`
                    : ""}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={estimating || mutating}
                  onClick={() => runEstimate()}
                >
                  Policz ponownie
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={openPairsPanel}
                >
                  Otwórz Pary
                </Button>
              </div>
            </Alert>
          ) : null,
          /* Soft only — blocking explode incomplete jest pełnym alertem powyżej. */
          bomMissingCount > 0 && !explodeBomIncomplete ? (
            <Alert tone="warning" title={ZD_BOM_UI.alertMissingTitle}>
              <p className="text-sm leading-snug">
                {ZD_BOM_UI.alertMissingBody(bomMissingCount)}
              </p>
              {missingBomTwIds.length > 0 ? (
                <p className="mt-1.5 text-[12px] text-slate-700">
                  {missingBomTwIds
                    .slice(0, 12)
                    .map((id) => labelMissingTw(id))
                    .join(", ")}
                  {missingBomTwIds.length > 12
                    ? ` …+${missingBomTwIds.length - 12}`
                    : ""}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={estimating || mutating}
                  onClick={() => runEstimate()}
                >
                  Policz ponownie
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={openBomsPanel}
                >
                  Otwórz {ZD_BOM_UI.panelTitle}
                </Button>
              </div>
            </Alert>
          ) : null,
          settingsLiveMessage ? (
            <Alert tone="success" title="Lista na bieżąco">
              {settingsLiveMessage}
            </Alert>
          ) : null,
          lines &&
          excludedWithIndividualCount > 0 &&
          excludedRoutedToServicesCount === 0 ? (
            <Alert tone="warning" title="Prośby na wykluczonych pozycjach">
              {excludedWithIndividualCount}{" "}
              {zdEstimateProsbaWord(excludedWithIndividualCount)}{" "}
              {excludedWithIndividualCount === 1
                ? "nadal na wykluczonej pozycji"
                : "nadal na wykluczonych pozycjach"}{" "}
              — sprawdź listę.
            </Alert>
          ) : null,
        ]}
      />
      </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-col gap-1.5",
          (Boolean(lines) || lastEstimateFailed) && "flex-1"
        )}
      >
      {!lines &&
      !estimating &&
      !launchBlocking &&
      lastEstimateFailed ? (
        <Card
          padding={false}
          className={cn(
            "flex min-h-0 flex-1 flex-col justify-center",
            zdEstimateCardSurfaceClass
          )}
        >
          <EmptyState
            brandAccent
            icon={<IconClipboardList size={28} strokeWidth={1.75} />}
            title="Brak listy"
            description={zdEstimateEmptyListDescription(bootstrap.ordersIsLive)}
          />
        </Card>
      ) : null}

      {lines ? (
        <div
          id={ZD_ESTIMATE_LIST_FOCUS_ID}
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col scroll-mt-4 outline-none"
        >
        <Card
          padding={false}
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-hidden",
            zdEstimateCardSurfaceClass
          )}
        >
          {showListRecountOverlay ? (
            <ZdEstimateRecountOverlay
              message={zdEstimateRecountOverlayMessage()}
              hint={zdEstimateRecountOverlayHint(bootstrap.ordersIsLive)}
            />
          ) : null}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              showListRecountOverlay &&
                "pointer-events-none opacity-60 transition-opacity duration-300 motion-reduce:transition-none"
            )}
          >
          <ZdEstimateListBand
            listFilter={listFilter}
            onListFilterChange={handleListFilterChange}
            reviewInGroupCount={reviewInGroupCount}
            excludedInGroupCount={excludedInGroupCount}
            inScopeCount={meta?.totalFromSubiekt ?? lines.length}
            listSearch={listSearch}
            onListSearchChange={setListSearch}
            searchVisibleCount={
              listSearchActive ? visibleLines.length : undefined
            }
            searchTotalCount={
              listSearchActive ? segmentFilteredLines.length : undefined
            }
            statusNote={
              [
                meta?.truncated
                  ? "lista niepełna — limit stron Subiekta"
                  : null,
                recountStatusMessage,
              ]
                .filter(Boolean)
                .join(" · ") || null
            }
            columns={columns}
            columnOrder={columnOrder}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            columnsAreDefault={columnsAreDefault}
            onSortByConfidence={() => {
              setSortKey("confidence");
              setSortDir("desc");
            }}
            sortKeyIsConfidence={sortKey === "confidence"}
            visibleCount={visibleLines.length}
            allVisibleSelected={allVisibleSelected}
            selectedCount={selectedCount}
            onSelectAllVisible={selectAllVisible}
            disabled={mutating || estimating}
          />

          <div className={zdEstimateListBodyInsetClass}>
            {individualBundle.serviceLines.length > 0 ? (
              <div className={zdEstimateListBodyPadClass}>
                <ZdEstimateIndividualServicesSection
                  serviceLines={individualBundle.serviceLines}
                  catalogOrderableCount={orderableLines.length}
                  excludedRoutedCount={excludedRoutedToServicesCount}
                />
              </div>
            ) : null}

            {visibleLines.length === 0 ? (
              <div className={zdEstimateListBodyPadClass}>
              <EmptyState
                title={
                  listSearchNoHits
                    ? "Brak trafień"
                    : !settingsTrusted && listFilter === "order"
                      ? "Ustawienia niewczytane"
                      : listFilter === "order"
                        ? ZD_ESTIMATE_UI.emptyOrderTitle
                        : listFilter === "excluded"
                          ? ZD_ESTIMATE_UI.emptyExcludedTitle
                          : listFilter === "review"
                            ? "Brak pozycji do weryfikacji"
                            : "Brak pozycji"
                }
                description={
                  listSearchNoHits
                    ? `Nie znaleziono „${listSearch.trim()}” w ${segmentFilteredLines.length} pozycjach tego filtra.`
                    : !settingsTrusted && listFilter === "order"
                      ? ZD_BOM_UI.settingsEmptyHint
                      : !settingsTrusted && listFilter === "excluded"
                        ? "Tu widać tylko auto-wykluczenia (outlet / wycofane / zęby). Wczytaj wykluczenia i „tylko na prośbę”, żeby dołączyć pozycje z bazy."
                        : listFilter === "order" &&
                            individualBundle.serviceLines.length > 0
                          ? "Powyżej są usługi z próśb (uwagi ZD). Do utworzenia ZD potrzebna jest ≥1 pozycja katalogowa — albo obsłuż prośby w panelu Dziś."
                          : listFilter === "order"
                            ? "Przy tych parametrach ilość = 0 albo wszystkie braki są na liście wykluczeń. Przełącz filtr, żeby zobaczyć pełny zakres."
                            : listFilter === "review"
                              ? "Żadna pozycja nie ma wstrzymanego ani częściowego podbicia Do ZD — pewność sprzedaży jest wystarczająca albo brak boostu."
                              : listFilter === "excluded"
                                ? ZD_ESTIMATE_UI.emptyExcludedDescription
                                : "Subiekt nie zwrócił pozycji dla tego zakresu."
                }
                action={
                  listSearchNoHits ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setListSearch("")}
                    >
                      Wyczyść filtr
                    </Button>
                  ) : !settingsTrusted && listFilter === "order" ? (
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
                      onClick={() => handleListFilterChange("all")}
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
              </div>
            ) : (
            <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
            <TableScroll
              id={ZD_ESTIMATE_TABLE_SCROLL_ID}
              className="zd-estimate-table-scroll min-h-0 w-full min-w-0 flex-1 bg-white px-0 pb-0 sm:px-0 sm:pb-0"
            >
                <DataTable
                  className={cn(
                    "zd-estimate-table",
                    showPackagingColumn && "zd-estimate-table--pack",
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
                          className={checkboxBrandClass}
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
                        align="left"
                        hint={ZD_ESTIMATE_UI.listSortSymbolHint}
                        density="compact"
                      />
                      <ZdEstimateSortableTh
                        label="Nazwa"
                        field="name"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="zd-estimate-product-name-col"
                        align="left"
                        hint={ZD_ESTIMATE_UI.listSortNameHint}
                        density="compact"
                      />
                      {showPackagingColumn ? (
                        <th
                          className="zd-estimate-pack-col"
                          title="Definicja opakowania: ile sztuk = 1 jednostka na ZD (paczka) albo wielokrotność dobicia. Osobno od Dost. / Sprzed. / Cel."
                        >
                          Opak.
                        </th>
                      ) : null}
                      <ZdEstimateSortableTh
                        label="Do ZD"
                        field="doZd"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        className="zd-estimate-dozd-col text-center"
                        align="center"
                        hint={ZD_ESTIMATE_UI.doZdColumnHint}
                      />
                      {visibleOptionalColumns.map((col) => {
                        const sectionCls = optionalColumnSectionStarts.has(col)
                          ? "zd-estimate-col--section"
                          : null;
                        const flowCls = flowColumnClass(col);
                        switch (col) {
                          case "packaging":
                            return null;
                          case "status":
                            return (
                              <th
                                key={col}
                                className={cn(
                                  "zd-estimate-status-col",
                                  sectionCls
                                )}
                                scope="col"
                                title={ZD_ESTIMATE_UI.listStatusColumnHint}
                              >
                                Status
                              </th>
                            );
                          case "stock":
                            return (
                              <Fragment key={col}>
                                <th
                                  className={cn(
                                    "zd-estimate-num-col",
                                    sectionCls
                                  )}
                                >
                                  Stan
                                </th>
                                <th
                                  className="zd-estimate-num-col"
                                  title="Rezerwacje"
                                >
                                  Rez.
                                </th>
                              </Fragment>
                            );
                          case "available":
                            return (
                              <th
                                key={col}
                                className={cn(
                                  "zd-estimate-num-col",
                                  flowCls,
                                  sectionCls
                                )}
                                title="Dostępne w sztukach (stan − rezerwacje). Przy SKU paczki z pary — jednostki karty (op.)."
                              >
                                Dost.
                              </th>
                            );
                          case "sales":
                            return (
                              <th
                                key={col}
                                className={cn(
                                  "zd-estimate-metric-col zd-estimate-metric-col--plan",
                                  flowCls,
                                  sectionCls
                                )}
                                title="Sprzedaż w oknie w sztukach. Przybliżenie w opakowaniach — w podpowiedzi (hover), nie w komórce."
                              >
                                <span className="zd-est-metric-th">
                                  <IconChartTrend
                                    size={11}
                                    strokeWidth={2}
                                    className="zd-est-metric-th__icon zd-est-metric-th__icon--sales"
                                  />
                                  <span className="zd-est-metric-th__label">
                                    Sprzed.
                                  </span>
                                </span>
                              </th>
                            );
                          case "target":
                            return (
                              <th
                                key={col}
                                className={cn(
                                  "zd-estimate-metric-col zd-estimate-metric-col--plan",
                                  flowCls,
                                  sectionCls
                                )}
                                title="Cel zapasu w sztukach. Przybliżenie w opakowaniach — w podpowiedzi (hover)."
                              >
                                <span className="zd-est-metric-th">
                                  <IconTarget
                                    size={11}
                                    strokeWidth={2}
                                    className="zd-est-metric-th__icon zd-est-metric-th__icon--target"
                                  />
                                  <span className="zd-est-metric-th__label">
                                    Cel
                                  </span>
                                </span>
                              </th>
                            );
                          case "openZd":
                            return (
                              <th
                                key={col}
                                className={cn(
                                  "zd-estimate-num-col",
                                  flowCls,
                                  sectionCls
                                )}
                                title="Otwarte ZD — jednostki dokumentu (przy paczkach: przeliczenie na sztuki w podpowiedzi)."
                              >
                                Otwarte
                              </th>
                            );
                          case "zk":
                            return (
                              <Fragment key={col}>
                                <th
                                  className={cn(
                                    "zd-estimate-num-col",
                                    sectionCls
                                  )}
                                  title="Otwarte ZK bez rezerwacji"
                                >
                                  ZK
                                </th>
                                <th
                                  className="zd-estimate-num-col"
                                  title="Surowe do zamówienia z API"
                                >
                                  API
                                </th>
                              </Fragment>
                            );
                          default:
                            return null;
                        }
                      })}
                      <th className="zd-estimate-spacer-col" aria-hidden />
                      <th className="zd-estimate-actions-col text-center">
                        Akcje
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.map((l) => {
                      const nameHit = nameAutoByTwId.get(l.tw_Id);
                      const dbExcluded =
                        exclusionsTrusted && dbExcludedIds.has(l.tw_Id);
                      const onRequestCanonicalId = retargetTwIdToPackIfPiece(
                        l.tw_Id,
                        productPairs
                      ).twId;
                      const dbOnRequest =
                        onRequestTrusted &&
                        onRequestTwIds.has(onRequestCanonicalId);
                      const liftedExtraOnly = extraOnlyTwIds.has(
                        onRequestCanonicalId
                      );
                      const softOnRequest =
                        dbOnRequest &&
                        orderExcludedTwIds.has(onRequestCanonicalId) &&
                        !liftedExtraOnly;
                      const excluded = orderExcludedTwIds.has(l.tw_Id);
                      const hidePairOrBomHardActions = bomRowHidesHardExclude(l);
                      const hideOnRequestAction = bomRowHidesOnRequest(l);
                      const allowsDoZdOverride =
                        !excluded && lineAllowsZdDocumentUnitOverride(l);
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
                                documentUnitMode: packRow.documentUnitMode,
                              }
                            : null),
                        individualExtraPiecesForTw(
                          l.tw_Id,
                          individualExtraByTwId
                        ),
                        liftedExtraOnly,
                        extrasPolicy
                      );
                      const celPieces =
                        Math.abs(l.salesTrackDelta) > 1e-9
                          ? l.celZapasuTracked
                          : l.celZapasu;
                      const salesTrackTitle =
                        formatSalesTrackHint({
                          applied: Math.abs(l.salesTrackDelta) > 1e-9,
                          deltaPieces: l.salesTrackDelta,
                          reasons: l.salesTrackReasons,
                          confidence: l.salesTrackConfidence,
                          qtyReview: l.salesTrackQtyReview,
                          heldExtraQty: l.salesTrackHeldExtraQty,
                          allowedExtraQty: l.salesTrackAllowedExtraQty,
                        }) ?? undefined;
                      const salesTrackSubline =
                        l.salesTrackDelta > 1e-9 ? (
                          <span className="zd-est-unit tabular-nums text-slate-500">
                            +{formatQty(l.salesTrackDelta)} szt
                          </span>
                        ) : l.salesTrackDelta < -1e-9 ? (
                          <span className="zd-est-unit tabular-nums text-amber-800/80">
                            −{formatQty(Math.abs(l.salesTrackDelta))} szt
                          </span>
                        ) : null;
                      const metricPackUnits =
                        pairMeta && !pairMeta.partnerMissing
                          ? pairMeta.unitsPerPack
                          : qty.hasPackaging
                            ? qty.unitsPerPackage
                            : null;
                      const individualExtra =
                        individualBundle.byTwId.get(l.tw_Id) ?? null;
                      const packagingConflict =
                        pairMeta?.role === "pack" &&
                        packRow != null &&
                        (packagingDocumentMode(packRow) === "pieces_multiple" ||
                          (packRow.unitsPerPackage > 1 &&
                            packRow.unitsPerPackage !== pairMeta.unitsPerPack));
                      const isSelected = Boolean(selected[l.tw_Id]);
                      const sessionIncluded = Boolean(
                        sessionIncludeTwIds[l.tw_Id]
                      );
                      const overrideZd = allowsDoZdOverride
                        ? qtyOverrideByTwId[l.tw_Id]
                        : undefined;
                      // „nie w Do ZD” tylko gdy exclude albo nadpisanie < wyliczenie
                      // (Zeruj). Podbicie qty nadal pokrywa prośbę w Do ZD.
                      const doZdSuppressed =
                        excluded ||
                        (overrideZd != null &&
                          Number.isFinite(overrideZd) &&
                          Math.trunc(overrideZd) < qty.zdUnits);
                      const displayZdUnits =
                        overrideZd != null && Number.isFinite(overrideZd)
                          ? Math.trunc(overrideZd)
                          : qty.zdUnits;
                      const doZdIdle = excluded || displayZdUnits <= 0;
                      return (
                        <tr
                          key={l.tw_Id}
                          data-zd-estimate-tw-id={l.tw_Id}
                          data-selected={isSelected ? "true" : undefined}
                          className={cn(
                            excluded && "bg-slate-50/80",
                            isSelected && "zd-estimate-row-selected"
                          )}
                        >
                          <td className="zd-estimate-check-col">
                            <input
                              type="checkbox"
                              className={checkboxBrandClass}
                              checked={isSelected}
                              disabled={mutating || estimating}
                              onClick={(e) => {
                                if (!e.shiftKey) return;
                                // Shift+zakres — bez natywnego toggle (stan ustawia zakres).
                                e.preventDefault();
                                toggleRowSelected(l.tw_Id, true);
                              }}
                              onChange={(e) => {
                                if (
                                  e.nativeEvent instanceof MouseEvent &&
                                  e.nativeEvent.shiftKey
                                ) {
                                  return;
                                }
                                toggleRowSelected(l.tw_Id, false);
                              }}
                              aria-label={`Zaznacz ${l.tw_Symbol}`}
                            />
                          </td>
                          <td
                            className={cn(
                              "zd-estimate-symbol-col",
                              excluded ? "text-slate-400" : "text-slate-900"
                            )}
                            title={l.tw_Symbol}
                          >
                            <span
                              className={cn(
                                "zd-est-symbol",
                                excluded && "zd-est-symbol--excluded"
                              )}
                            >
                              {l.tw_Symbol}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "zd-estimate-product-name-col",
                              excluded ? "text-slate-400" : null
                            )}
                            title={l.tw_Nazwa}
                          >
                            <span className="zd-est-product-name">{l.tw_Nazwa}</span>
                          </td>
                          {showPackagingColumn ? (
                            <td className="zd-estimate-pack-col whitespace-nowrap">
                              <ZdEstimatePackagingCell
                                qty={qty}
                                conflict={packagingConflict}
                                disabled={
                                  mutating || estimating || !packagingTrusted
                                }
                                pending={mutating}
                                onEdit={() => setPackagingCandidate(l)}
                              />
                            </td>
                          ) : null}
                          <td
                            className={cn(
                              "zd-estimate-dozd-col text-center",
                              isZdEstimatePendingReview({
                                qtyReview: l.salesTrackQtyReview,
                                accepted: acceptedReviewTwIds[l.tw_Id],
                                excluded,
                              })
                                ? "zd-estimate-dozd-col--review"
                                : doZdIdle
                                  ? "zd-estimate-dozd-col--idle"
                                  : null
                            )}
                          >
                            <ZdEstimateDoZdCell
                              qty={qty}
                              excluded={excluded}
                              individualExtraPieces={
                                individualExtra?.extraPieces ?? 0
                              }
                              overrideZdUnits={
                                allowsDoZdOverride
                                  ? qtyOverrideByTwId[l.tw_Id] ?? null
                                  : null
                              }
                              overrideDisabled={mutating || estimating}
                              onOverrideChange={
                                allowsDoZdOverride
                                  ? (next) => {
                                      setQtyOverrideByTwId((prev) => {
                                        const copy = { ...prev };
                                        if (
                                          next == null ||
                                          Math.trunc(next) === qty.zdUnits
                                        ) {
                                          delete copy[l.tw_Id];
                                        } else {
                                          copy[l.tw_Id] = Math.trunc(next);
                                        }
                                        return copy;
                                      });
                                    }
                                  : undefined
                              }
                              confidence={l.salesTrackConfidence}
                              qtyReview={l.salesTrackQtyReview}
                              reasons={l.salesTrackReasons}
                              accepted={Boolean(acceptedReviewTwIds[l.tw_Id])}
                              detailHint={salesTrackTitle}
                              onAccept={
                                isZdEstimatePendingReview({
                                  qtyReview: l.salesTrackQtyReview,
                                  accepted: acceptedReviewTwIds[l.tw_Id],
                                  excluded,
                                })
                                  ? () =>
                                      setAcceptedReviewTwIds((prev) => ({
                                        ...prev,
                                        [l.tw_Id]: true,
                                      }))
                                  : undefined
                              }
                            />
                          </td>
                          {visibleOptionalColumns.map((col) => {
                            const sectionCls = optionalColumnSectionStarts.has(
                              col
                            )
                              ? "zd-estimate-col--section"
                              : null;
                            const flowCls = flowColumnClass(col);
                            switch (col) {
                              case "packaging":
                                return null;
                              case "status":
                                return (
                                  <td
                                    key={col}
                                    className={cn(
                                      "zd-estimate-status-col",
                                      sectionCls
                                    )}
                                  >
                                    <ZdEstimateNameMetaStack
                                      pairMeta={pairMeta}
                                      packagingConflict={packagingConflict}
                                      bomMeta={bomMeta}
                                      individualExtra={individualExtra}
                                      extrasPolicy={extrasPolicy}
                                      doZdSuppressed={doZdSuppressed}
                                      excluded={excluded}
                                      sessionIncluded={sessionIncluded}
                                      nameHit={nameHit}
                                      softOnRequest={softOnRequest}
                                      liftedExtraOnly={liftedExtraOnly}
                                    />
                                  </td>
                                );
                              case "stock":
                                return (
                                  <Fragment key={col}>
                                    <td
                                      className={cn(
                                        "zd-estimate-num-col whitespace-nowrap",
                                        sectionCls
                                      )}
                                    >
                                      {pairMeta?.role === "pack" ? (
                                        <ZdEstimatePairPackStockCell
                                          value={l.tw_Stan}
                                          tier="d"
                                        />
                                      ) : (
                                        <ZdEstimateQtyValue
                                          value={l.tw_Stan}
                                          tier="d"
                                          unit="szt"
                                        />
                                      )}
                                    </td>
                                    <td className="zd-estimate-num-col whitespace-nowrap">
                                      {pairMeta?.role === "pack" ? (
                                        <ZdEstimatePairPackStockCell
                                          value={l.tw_StanRez}
                                          tier="d"
                                          tone={
                                            l.tw_StanRez > 0 ? "warn" : "muted"
                                          }
                                          zeroAsDash
                                        />
                                      ) : (
                                        <ZdEstimateQtyValue
                                          value={l.tw_StanRez}
                                          tier="d"
                                          unit="szt"
                                          zeroAsDash
                                          tone={
                                            l.tw_StanRez > 0 ? "warn" : "muted"
                                          }
                                        />
                                      )}
                                    </td>
                                  </Fragment>
                                );
                              case "available":
                                return (
                                  <td
                                    key={col}
                                    className={cn(
                                      "zd-estimate-num-col whitespace-nowrap",
                                      flowCls,
                                      sectionCls
                                    )}
                                  >
                                    {pairMeta?.role === "pack" ? (
                                      <ZdEstimatePairPackStockCell
                                        value={l.dostepne}
                                        tier="b"
                                        tone={
                                          l.dostepne <= 0 ? "warn" : "default"
                                        }
                                      />
                                    ) : (
                                      <ZdEstimateQtyValue
                                        value={l.dostepne}
                                        tier="b"
                                        unit="szt"
                                        tone={
                                          l.dostepne <= 0 ? "warn" : "default"
                                        }
                                      />
                                    )}
                                  </td>
                                );
                              case "sales":
                                return (
                                  <td
                                    key={col}
                                    className={cn(
                                      "zd-estimate-metric-col zd-estimate-metric-col--plan",
                                      flowCls,
                                      sectionCls
                                    )}
                                  >
                                    {pairMeta && !pairMeta.partnerMissing ? (
                                      <ZdEstimatePairSalesCell
                                        pair={pairMeta}
                                      />
                                    ) : (
                                      <ZdEstimatePiecesMetricCell
                                        pieces={l.sprzedazOkres}
                                        unitsPerPack={
                                          qty.hasPackaging
                                            ? qty.unitsPerPackage
                                            : null
                                        }
                                        tier="c"
                                        zeroAsDash
                                      />
                                    )}
                                  </td>
                                );
                              case "target":
                                return (
                                  <td
                                    key={col}
                                    className={cn(
                                      "zd-estimate-metric-col zd-estimate-metric-col--plan",
                                      flowCls,
                                      sectionCls
                                    )}
                                  >
                                    {pairMeta && !pairMeta.partnerMissing ? (
                                      <ZdEstimatePairPiecesCell
                                        pieces={celPieces}
                                        unitsPerPack={pairMeta.unitsPerPack}
                                        subline={salesTrackSubline}
                                      />
                                    ) : (
                                      <ZdEstimatePiecesMetricCell
                                        pieces={celPieces}
                                        unitsPerPack={metricPackUnits}
                                        tier="b"
                                        title={salesTrackTitle}
                                        subline={salesTrackSubline}
                                      />
                                    )}
                                  </td>
                                );
                              case "openZd":
                                return (
                                  <td
                                    key={col}
                                    className={cn(
                                      "zd-estimate-num-col whitespace-nowrap",
                                      flowCls,
                                      sectionCls
                                    )}
                                  >
                                    <ZdEstimateQtyValue
                                      value={l.otwarteZd}
                                      tier="c"
                                      unit={
                                        qty.hasPackaging &&
                                        !isPackagingPackagesMode(
                                          qty.documentUnitMode
                                        )
                                          ? "szt"
                                          : "jdok"
                                      }
                                      zeroAsDash
                                      title={
                                        qty.hasPackaging &&
                                        l.otwarteZd > 0 &&
                                        isPackagingPackagesMode(
                                          qty.documentUnitMode
                                        )
                                          ? `${formatQty(l.otwarteZd)} j.dok. = ${formatQty(l.otwarteZd * qty.unitsPerPackage)} szt (przeliczenie z kolumny Opak.)`
                                          : qty.hasPackaging &&
                                              l.otwarteZd > 0 &&
                                              !isPackagingPackagesMode(
                                                qty.documentUnitMode
                                              )
                                            ? `${formatQty(l.otwarteZd)} szt (otwarte ZD)`
                                            : `${formatQty(l.otwarteZd)} j.dok. (otwarte ZD)`
                                      }
                                    />
                                  </td>
                                );
                              case "zk":
                                return (
                                  <Fragment key={col}>
                                    <td
                                      className={cn(
                                        "zd-estimate-num-col whitespace-nowrap",
                                        sectionCls
                                      )}
                                    >
                                      <ZdEstimateQtyValue
                                        value={l.otwarteZkBezRez}
                                        tier="d"
                                        zeroAsDash
                                      />
                                    </td>
                                    <td className="zd-estimate-num-col whitespace-nowrap">
                                      <ZdEstimateQtyValue
                                        value={l.doZamowieniaApi}
                                        tier="d"
                                        zeroAsDash
                                      />
                                    </td>
                                  </Fragment>
                                );
                              default:
                                return null;
                            }
                          })}
                          <td className="zd-estimate-spacer-col" aria-hidden />
                          <td className="zd-estimate-actions-col text-center">
                            <div className="inline-flex justify-center py-0.5">
                              <ZdEstimateRowActions
                                symbol={l.tw_Symbol}
                                nameAutoExcluded={Boolean(nameHit)}
                                dbExcluded={Boolean(dbExcluded)}
                                onRequest={Boolean(dbOnRequest)}
                                sessionIncluded={sessionIncluded}
                                hideHardExclude={hidePairOrBomHardActions}
                                hideOnRequest={hideOnRequestAction}
                                packagingHint={
                                  qty.hasPackaging
                                    ? isPackagingPackagesMode(
                                        qty.documentUnitMode
                                      )
                                      ? `${qty.unitsPerPackage} szt / 1 ${qty.packageLabel}`
                                      : `dobij do ${qty.unitsPerPackage} szt`
                                    : null
                                }
                                disabled={mutating || estimating}
                                pending={mutatingTwId === l.tw_Id}
                                onPackaging={() => setPackagingCandidate(l)}
                                onExclude={() => {
                                  if (individualExtra) {
                                    const ok = window.confirm(
                                      "Ta pozycja ma prośbę handlowca.\n\nPo wykluczeniu prośba trafi do sekcji „Usługi” i do uwag ZD (bez ilości towaru) — nie zniknie z panelu Dziś do utworzenia ZD.\n\nKontynuować?"
                                    );
                                    if (!ok) return;
                                  }
                                  setExcludeCandidate(l);
                                }}
                                onRestore={() => restoreLine(l.tw_Id)}
                                onMarkOnRequest={
                                  exclusionsTrusted && onRequestTrusted
                                    ? () => markOnRequestLine(l)
                                    : undefined
                                }
                                onClearOnRequest={
                                  onRequestTrusted
                                    ? () =>
                                        clearOnRequestLine(onRequestCanonicalId)
                                    : undefined
                                }
                                onSessionInclude={() =>
                                  setSessionIncludeTwId(l.tw_Id, true)
                                }
                                onSessionIncludeClear={() =>
                                  setSessionIncludeTwId(l.tw_Id, false)
                                }
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
          </div>
        </Card>
        </div>
      ) : null}
      </div>

        </>
      ) : null}

      {showResultStickyActions && !showLaunchProgress && !showSessionResumeProgress && !sessionRestorePending ? (
        <div className="flex flex-col">
          <ZdEstimateSelectionToolsReveal
            open={selectionToolsOpen}
            id={ZD_ESTIMATE_SELECTION_TOOLS_ID}
          >
            {selectionBarSelectedCount > 0 ? (
            <ZdEstimateListToolsBar
              selectedCount={selectionBarSelectedCount}
              visibleSelectedCount={selectionBarVisibleSelectedCount}
              excludeEligibleCount={excludeEligibleLines.length}
              restoreEligibleCount={restoreEligibleLines.length}
              packagingClearEligibleCount={packagingClearEligibleLines.length}
              onRequestEligibleCount={onRequestEligibleLines.length}
              clearOnRequestEligibleCount={clearOnRequestEligibleLines.length}
              pairsTrusted={pairsTrusted}
              bomsTrusted={bomsTrusted}
              packagingTrusted={packagingTrusted}
              exclusionsTrusted={exclusionsTrusted}
              onRequestTrusted={onRequestTrusted}
              truncatedHint={bulkActionTruncationHint}
              disabled={mutating || estimating || !selectionToolsOpen}
              onClearSelection={clearSelection}
              onBulkExclude={() => {
                const withProsba = excludeEligibleLines.filter((l) =>
                  individualBundle.byTwId.has(l.tw_Id)
                );
                if (withProsba.length) {
                  const ok = window.confirm(
                    `${withProsba.length} z zaznaczonych pozycji ma prośbę handlowca.\n\nPo wykluczeniu prośba trafi do sekcji „Usługi” i do uwag ZD (bez ilości towaru) — nie zniknie z panelu Dziś do momentu utworzenia ZD.\n\nKontynuować?`
                  );
                  if (!ok) return;
                }
                setBulkExcludeOpen(true);
              }}
              onBulkRestore={() => {
                if (restoreEligibleLines.length === 1) {
                  confirmBulkRestore();
                  return;
                }
                setBulkRestoreOpen(true);
              }}
              reviewEligibleCount={reviewEligibleLines.length}
              onBulkReviewAccept={() => {
                setAcceptedReviewTwIds((prev) => {
                  const next = { ...prev };
                  for (const l of reviewEligibleLines) {
                    next[l.tw_Id] = true;
                  }
                  return next;
                });
              }}
              onBulkReviewZero={() => {
                const ids = reviewEligibleLines.map((l) => l.tw_Id);
                setQtyOverrideByTwId((prev) => {
                  const next = { ...prev };
                  for (const id of ids) next[id] = 0;
                  return next;
                });
                setAcceptedReviewTwIds((prev) => {
                  const next = { ...prev };
                  for (const id of ids) next[id] = true;
                  return next;
                });
              }}
              onBulkOnRequest={confirmBulkOnRequest}
              onBulkClearOnRequest={confirmBulkClearOnRequest}
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
            ) : null}
          </ZdEstimateSelectionToolsReveal>

          {/* Clearance w flow — pasek Create jest poza flow (h-0 dock). */}
          <div
            aria-hidden
            className={
              stickyCreateGateCaption
                ? zdEstimateStickyClearanceTallClass
                : zdEstimateStickyClearanceClass
            }
          />

          <div className={zdEstimateStickyDockClass}>
            <div
              id={ZD_ESTIMATE_STICKY_ACTIONS_ID}
              className={cn(zdEstimateStickyBarClass, "flex-col gap-1.5")}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className={zdEstimateDockButtonClass}
                  onClick={() => {
                    if (!createZdGate.ok) return;
                    openCreateZdModal();
                  }}
                  disabled={!createZdGate.ok}
                  aria-describedby={
                    stickyCreateGateCaption
                      ? "zd-estimate-sticky-create-gate"
                      : undefined
                  }
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
                {showExternalSessionActiveStatus ? (
                  <ZdEstimateExternalSessionActiveChip />
                ) : null}
                {canCancelExternalSession ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className={zdEstimateDockButtonClass}
                    onClick={() => {
                      const token = externalSessionTokenState;
                      if (!token) return;
                      cancelExternalSessionSessionIdRef.current =
                        token.sessionId;
                      setCancelExternalSessionOpen(true);
                    }}
                    disabled={mutating}
                    title="Anuluj zapis sesji kreatora ZD (przestanie działać przycisk „Wróć do kreatora”)."
                  >
                    {zdEstimateExternalSessionCancelButtonLabel}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={zdEstimateDockButtonClass}
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
                  className={zdEstimateDockButtonClass}
                  onClick={() => openLinkZdModal()}
                  disabled={
                    !lines?.length || !bootstrap.configured || !supplierId
                  }
                  title={
                    !bootstrap.configured
                      ? "Wymaga połączenia z Subiektem"
                      : !supplierId
                        ? "Wybierz dostawcę — historia jest per kontrahent"
                        : "Gdy ZD powstało poza OnTime — zapisz powiązanie w historii"
                  }
                >
                  Powiąż ZD
                </Button>
              </div>
              {stickyCreateGateCaption ? (
                <p
                  id="zd-estimate-sticky-create-gate"
                  className="text-[11px] leading-snug text-amber-800"
                >
                  {stickyCreateGateCaption}
                </p>
              ) : null}
            </div>
          </div>
          <div
            id={ZD_ESTIMATE_SCROLL_END_ID}
            aria-hidden
            className="pointer-events-none h-0 w-full shrink-0 overflow-hidden"
          />
        </div>
      ) : null}


      {createUndoVisible && createDoneDokNr && !postCreate ? (
        <UndoToast
          placement="floating"
          paused={linkZdOpen}
          className={
            showResultStickyActions &&
              !showLaunchProgress &&
              !showSessionResumeProgress &&
              !showQuietSessionRestore
              ? cn(
                  floatingToastAboveZdStickyClass,
                  stickyCreateGateCaption || selectedCount > 0
                    ? floatingToastAboveZdStickyTallClass
                    : undefined
                )
              : undefined
          }
          title={
            createUnconfirmedAttempt
              ? "Timeout tworzenia — sprawdź Subiekt"
              : `Utworzono ${createDoneDokNr}`
          }
          description={
            createUnconfirmedAttempt
              ? "Tworzenie ZD zablokowane na wypadek, że dokument już powstał. Odblokuj świadomie albo powiąż ZD."
              : "Odblokuj tworzenie ZD świadomie — dokument w Subiekcie zostaje (to nie anuluje ZD)."
          }
          undoLabel="Odblokuj tworzenie ZD"
          onUndo={() => {
            setCreateUnlockedAfterDone(true);
            setCreateUndoVisible(false);
          }}
          onDismiss={() => setCreateUndoVisible(false)}
        />
      ) : null}

      <ConfirmDialog
        open={externalSessionAutorunConflictOpen}
        title={zdEstimateExternalSessionAutorunConflictTitle}
        message={zdEstimateExternalSessionAutorunConflictMessage}
        confirmLabel={zdEstimateExternalSessionAutorunResumeLabel}
        cancelLabel={zdEstimateExternalSessionAutorunDiscardLabel}
        disableBackdropClose
        onCancel={() => {
          setExternalSessionAutorunConflictOpen(false);
          void (async () => {
            await endExternalSession();
            runPendingAutorunAfterSessionDiscard();
          })();
        }}
        onConfirm={() => {
          setExternalSessionAutorunConflictOpen(false);
          externalSessionAutorunBlockedRef.current = false;
          externalSessionAutorunPendingRef.current = null;
          if (launch?.launchKey) {
            launchedRef.current = true;
            markZdEstimateLaunchAutorunDone(launch.launchKey);
            setLaunchBlocking(false);
          }
          const token = peekZdEstimateExternalSessionToken();
          if (!token) return;
          skipPendingIndividualsFetchRef.current = true;
          void restoreExternalSession(token);
        }}
      />

      <ConfirmDialog
        open={externalSessionScopeChangeOpen}
        title={zdEstimateExternalSessionScopeChangeTitle}
        message={zdEstimateExternalSessionScopeChangeMessage}
        confirmLabel={zdEstimateExternalSessionScopeChangeConfirmLabel}
        cancelLabel={zdEstimateExternalSessionScopeChangeCancelLabel}
        onCancel={() => {
          scopeChangePendingActionRef.current = null;
          setExternalSessionScopeChangeOpen(false);
        }}
        onConfirm={() => {
          const action = scopeChangePendingActionRef.current;
          scopeChangePendingActionRef.current = null;
          setExternalSessionScopeChangeOpen(false);
          action?.();
        }}
      />

      <ConfirmDialog
        open={cancelExternalSessionOpen && canCancelExternalSession}
        title={zdEstimateExternalSessionCancelConfirmTitle}
        message={zdEstimateExternalSessionCancelConfirmMessage}
        confirmLabel={zdEstimateExternalSessionCancelConfirmLabel}
        cancelLabel={zdEstimateExternalSessionCancelDialogCancelLabel}
        pending={mutating && cancelExternalSessionOpen}
        onCancel={() => setCancelExternalSessionOpen(false)}
        onConfirm={() => {
          const sessionId = cancelExternalSessionSessionIdRef.current;
          cancelExternalSessionSessionIdRef.current = null;
          startMutate(async () => {
            setCancelExternalSessionOpen(false);
            clearEstimateResult();
            await endExternalSession({ sessionId });
          });
        }}
      />

      <ConfirmDialog
        open={bulkRestoreOpen && restoreEligibleLines.length > 0}
        title={`Przywróć ${Math.min(restoreEligibleLines.length, ZD_ESTIMATE_BULK_MAX)}${restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX ? ` z ${restoreEligibleLines.length}` : ""}?`}
        message={
          restoreEligibleLines.length > ZD_ESTIMATE_BULK_MAX
            ? `Zaznaczone wrócą na listę „Do ZD”. Limit ${ZD_ESTIMATE_BULK_MAX} na akcję — pierwsze ${ZD_ESTIMATE_BULK_MAX} zostaną przywrócone, reszta zostanie zaznaczona.`
            : `Przywrócić ${restoreEligibleLines.length} ${
                restoreEligibleLines.length === 1
                  ? "produkt"
                  : (() => {
                      const n = restoreEligibleLines.length;
                      const mod10 = n % 10;
                      const mod100 = n % 100;
                      return mod10 >= 2 &&
                        mod10 <= 4 &&
                        (mod100 < 10 || mod100 >= 20)
                        ? "produkty"
                        : "produktów";
                    })()
              } na listę „Do ZD”?`
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
        packPairTwIds={packPairTwIds}
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
        extraOnly={
          packagingCandidate
            ? extraOnlyTwIds.has(packagingCandidate.tw_Id)
            : false
        }
        extrasPolicy={extrasPolicy}
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
        packPairTwIds={packPairTwIds}
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

      <ZdEstimateOnRequestModal
        open={onRequestPanelOpen}
        onClose={() => setOnRequestPanelOpen(false)}
        onRequests={onRequests}
        onOnRequestsChange={applyOnRequestsLive}
        onError={reportError}
      />

      <ZdEstimateSupplierScopesModal
        open={scopesPanelOpen}
        onClose={() => setScopesPanelOpen(false)}
        suppliers={bootstrap.suppliers}
        configured={bootstrap.configured}
        onError={reportError}
        todayCoverage={todayCoverage}
        onMappedSupplierIdsChange={(ids) => {
          setTodayCoverage(
            zdEstimateScopeCoverage(
              collectTodayScheduleSuppliers({
                todayKey: bootstrap.todayKey,
                suppliers: bootstrap.suppliers,
              }),
              ids
            )
          );
        }}
      />

      <ZdEstimateSnapshotsModal
        open={snapshotsPanelOpen}
        onClose={() => setSnapshotsPanelOpen(false)}
        onError={reportError}
        onHistoryEligibilityChanged={() => {
          if (lines && lines.length > 0) {
            setHistoryNeedsRecount(true);
          }
        }}
      />

      <ZdEstimateLinkZdDialog
        open={linkZdOpen}
        supplierId={supplierId}
        scopeMode={scopeMode}
        grtId={selectedGroup?.grt_Id ?? null}
        cechaId={selectedCecha?.ctw_Id ?? null}
        initialNr={
          linkNrPrefill ??
          (postCreate && !postCreate.snapshotOk
            ? postCreate.linkNrPrefill ?? postCreate.dokNrPelny
            : null)
        }
        titleHint={
          postCreate &&
          (postCreate.kind === "timeout_recovery" || !postCreate.snapshotOk)
            ? ZD_ESTIMATE_UI.postCreateLinkRecoveryHint
            : undefined
        }
        lineMeta={
          postCreateLinkLineMeta(postCreate) ??
          (lines?.map((l) => ({
            twId: l.tw_Id,
            celAtLink: l.celZapasuTracked,
            deltaAtLink: l.salesTrackDelta,
          })) ?? null)
        }
        orderableTwIds={
          postCreateOrderableTwIds(postCreate) ?? confirmedTwIdsForSnapshot
        }
        implicitPieceSnapshotNotice={implicitPieceSnapshotNotice}
        onOpenPackaging={() => {
          setLinkZdOpen(false);
          openPackagingPanel();
        }}
        onOpenPairs={() => {
          setLinkZdOpen(false);
          openPairsPanel();
        }}
        onClose={() => {
          setLinkZdOpen(false);
          setLinkNrPrefill(null);
        }}
        onLinked={({ dokId, dokNrPelny, lineCount, createdLines }) => {
          setFeedback(null);
          setErrorMessage(null);
          setLinkNrPrefill(null);
          setLinkZdOpen(false);
          if (dokId > 0) {
            void endExternalSession();
            setCreateDoneDokId(dokId);
            setCreateDoneDokNr(dokNrPelny);
            setCreateUnconfirmedAttempt(false);
            setCreateUnlockedAfterDone(false);
            setCreateUndoVisible(true);
          }
          const shouldBumpOtwarte =
            !postCreate || postCreate.kind === "timeout_recovery";
          const markFreezeForLink =
            postCreate?.markFreeze ??
            timeoutRecoveryFreezeRef.current ??
            createMarkFreezeCaptureRef.current ??
            emptyZdPostCreateMarkFreeze();
          const nextSession = buildZdPostCreateSessionFromLink({
            supplierId: supplierId ?? "",
            supplierName:
              selectedSupplier?.name ||
              (createKhResolution?.ok
                ? createKhResolution.supplierName
                : null) ||
              supplierLabel ||
              "Dostawca",
            fromDaily: launch?.fromDaily === true,
            dokId,
            dokNrPelny,
            lineCount,
            previous: postCreate,
            previewLines: createZdPreview.lines,
            lineMeta:
              lines?.map((l) => ({
                twId: l.tw_Id,
                celAtLink: l.celZapasuTracked,
                deltaAtLink: l.salesTrackDelta,
              })) ?? null,
            createdLines,
            markFreeze: markFreezeForLink,
          });
          setPostCreate(nextSession);
          if (
            dokId > 0 &&
            nextSession.markFreeze.consumedOrderIds.length > 0
          ) {
            rememberConsumedOrderIds(nextSession.markFreeze.consumedOrderIds);
          }
          timeoutRecoveryFreezeRef.current = null;
          createMarkFreezeCaptureRef.current = null;
          setCreateMarkFreezeFrozen(null);
          if (shouldBumpOtwarte && linesBase?.length) {
            // Tylko qty z dokumentu Subiekta — bez fallbacku do preview
            // (false timeout + zły bump = under/over cover).
            const createdUnitsByTwId = aggregateCreatedZdLineQtys(createdLines);
            if (createdUnitsByTwId.size) {
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
                    salesTrackPolicy: appliedBoostPolicy,
                  },
                });
              setLines(nextLines);
              setMissingPartnerTwIds(missingPartnerTwIds);
              setMissingBomTwIds(missingBomTwIds);
            }
          }
        }}
        onError={reportError}
      />

      {supplierId && createKhResolution?.ok && (createZdOpen || createZdPreview.lineCount > 0) ? (
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
          preview={createDialogPreview}
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
          implicitPieceSnapshotNotice={implicitPieceSnapshotNotice}
          onOpenPackaging={() => {
            closeCreateZdModal();
            openPackagingPanel();
          }}
          onOpenPairs={() => {
            closeCreateZdModal();
            openPairsPanel();
          }}
          initialUwagi={createBaseUwagi.slice(0, Math.max(1, createUwagiBaseMaxLen))}
          uwagiBaseMaxLen={createUwagiBaseMaxLen}
          individualCatalogOrderIds={createCatalogOrderIds}
          serviceLinesForCompose={individualBundle.serviceLines}
          consumedOrderIds={extrasConsumedOrderIds}
          markFreeze={createMarkFreezeFrozen ?? createMarkFreeze}
          excludedWithIndividualCount={excludedRoutedToServicesCount}
          pendingReviewCount={pendingReviewOnCreateCount}
          ordersIsLive={bootstrap.ordersIsLive}
          ordersPort={bootstrap.ordersPort ?? bootstrap.testPort}
          ordersHostLabel={bootstrap.ordersHostLabel}
          host={{
            configured: bootstrap.configured,
            isLive: bootstrap.ordersIsLive,
            port: bootstrap.ordersPort ?? bootstrap.testPort,
            salesEndFromFs: bootstrap.salesEndFromFs,
            salesEndKeyFormatted: bootstrap.salesEndFromFs
              ? formatPlDate(bootstrap.salesEndKey)
              : null,
          }}
          extrasPolicy={extrasPolicy}
          onClose={closeCreateZdModal}
          onSubmitStart={(snap) => {
            createPreviewCaptureRef.current = createZdPreview;
            setCreatePreviewFrozen(createZdPreview);
            createLineMetaCaptureRef.current =
              lines?.map((l) => ({
                twId: l.tw_Id,
                celAtLink: l.celZapasuTracked,
                deltaAtLink: l.salesTrackDelta,
              })) ?? [];
            const freezeSnap = buildZdPostCreateMarkFreeze({
              catalogOrderIds: snap.individualCatalogOrderIds,
              includedServiceOrderIds: snap.includedServiceOrderIds,
              omittedServiceCount: snap.omittedServiceCount,
              serviceLines: individualBundle.serviceLines,
              catalogByTwId: individualBundle.byTwId,
            });
            createMarkFreezeCaptureRef.current = freezeSnap;
            setCreateMarkFreezeFrozen(freezeSnap);
            setCreatingZd(true);
          }}
          onCreated={({
            dokId,
            dokNrPelny,
            lineCount,
            snapshotOk,
            snapshotMessage,
            createdUnitsByTwId,
            createdLines,
            bumped,
            composedUwagi,
            omittedServiceCount,
            includedServiceOrderIds,
            acceptedCatalogOrderIds,
          }) => {
            void endExternalSession();
            const previewSnap =
              createPreviewCaptureRef.current ?? createZdPreview;
            const freezeBase =
              createMarkFreezeCaptureRef.current ?? createMarkFreeze;
            const reconciled = reconcileMarkFreezeWithAcceptedIds(freezeBase, {
              acceptedCatalogOrderIds,
              includedServiceOrderIds,
            });
            const freezeFinal: ZdPostCreateMarkFreeze = {
              ...reconciled,
              omittedServiceCount: Math.max(
                freezeBase.omittedServiceCount,
                Math.max(0, Math.trunc(Number(omittedServiceCount) || 0))
              ),
              teethServiceCount: reconciled.teethServiceCount,
            };
            setCreatingZd(false);
            setCreateZdOpen(false);
            setLinkZdOpen(false);
            setFeedback(null);
            setErrorMessage(null);
            setCreateDoneDokId(dokId);
            setCreateDoneDokNr(dokNrPelny);
            setCreateUnconfirmedAttempt(false);
            setCreateUnlockedAfterDone(false);
            setCreateUndoVisible(true);
            timeoutRecoveryFreezeRef.current = null;
            setPostCreate(
              buildZdPostCreateSessionFromCreate({
                supplierId,
                supplierName:
                  createKhResolution.supplierName ||
                  selectedSupplier?.name ||
                  "Dostawca",
                fromDaily: launch?.fromDaily === true,
                dokId,
                dokNrPelny,
                lineCount,
                snapshotOk,
                snapshotMessage,
                previewLines: previewSnap.lines,
                lineMeta: createLineMetaCaptureRef.current,
                createdLines,
                markFreeze: freezeFinal,
                bumped,
                composedUwagi,
              })
            );
            rememberConsumedOrderIds(freezeFinal.consumedOrderIds);
            createPreviewCaptureRef.current = null;
            setCreatePreviewFrozen(null);
            createLineMetaCaptureRef.current = null;
            createMarkFreezeCaptureRef.current = null;
            setCreateMarkFreezeFrozen(null);

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
                    salesTrackPolicy: appliedBoostPolicy,
                  },
                });
              setLines(nextLines);
              setMissingPartnerTwIds(missingPartnerTwIds);
              setMissingBomTwIds(missingBomTwIds);
            }
          }}
          onError={(message, opts) => {
            setCreatingZd(false);
            reportError(message);
            const timeoutKh = opts?.timeoutKhId;
            if (timeoutKh != null && timeoutKh > 0) {
              setCreateZdOpen(false);
              setLinkZdOpen(false);
              setLinkNrPrefill(null);
              const previewSnap =
                createPreviewCaptureRef.current ?? createZdPreview;
              const lineMetaSnap = createLineMetaCaptureRef.current;
              const freezeSnap =
                createMarkFreezeCaptureRef.current ?? createMarkFreeze;
              setCreateDoneDokId(null);
              setCreateDoneDokNr(ZD_ESTIMATE_UI.postCreateTimeoutLockLabel);
              setCreateUnconfirmedAttempt(true);
              setCreateUnlockedAfterDone(false);
              setCreateUndoVisible(true);
              setPostCreate(
                buildZdPostCreateSessionFromTimeout({
                  supplierId: supplierId ?? "",
                  supplierName:
                    createKhResolution.supplierName ||
                    selectedSupplier?.name ||
                    "Dostawca",
                  fromDaily: launch?.fromDaily === true,
                  previewLines: previewSnap.lines,
                  lineMeta: lineMetaSnap,
                  markFreeze: freezeSnap,
                })
              );
              // Przeżywa dismiss panelu — link po zamknięciu nadal ma submit freeze.
              timeoutRecoveryFreezeRef.current = freezeSnap;
              createPreviewCaptureRef.current = null;
              setCreatePreviewFrozen(null);
              createLineMetaCaptureRef.current = null;
              createMarkFreezeCaptureRef.current = null;
              setCreateMarkFreezeFrozen(null);
              void (async () => {
                const found = await actionFindRecentZdAfterCreateAttempt({
                  supplierKhId: timeoutKh,
                });
                if (!found.ok) return;
                const first = found.documents[0];
                setPostCreate((prev) => {
                  if (!prev || prev.kind !== "timeout_recovery") return prev;
                  return patchZdPostCreateTimeoutCandidates(prev, {
                    linkNrPrefill: first?.dokNrPelny ?? null,
                    recentCandidateCount: found.documents.length,
                  });
                });
              })();
              return;
            }
            // Soft error — odblokuj freeze UI; dialog zostaje otwarty do retry.
            createPreviewCaptureRef.current = null;
            setCreatePreviewFrozen(null);
            createLineMetaCaptureRef.current = null;
            createMarkFreezeCaptureRef.current = null;
            setCreateMarkFreezeFrozen(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ZdEstimateSortHeaderButton({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
  hint,
  density = "default",
}: {
  label: string;
  field: ZdEstimateListSortKey;
  sortKey: ZdEstimateListSortKey;
  sortDir: ZdEstimateListSortDir;
  onSort: (field: ZdEstimateListSortKey) => void;
  hint?: string;
  density?: "default" | "compact";
}) {
  const isActive = sortKey === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-pressed={isActive}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 text-left transition-colors hover:text-slate-900",
        density === "compact"
          ? "text-[10px] font-semibold uppercase tracking-wide leading-none"
          : "text-sm font-semibold",
        isActive ? "text-slate-900" : "text-slate-600"
      )}
      title={
        isActive
          ? `Sortowanie po „${label}”: ${
              sortDir === "asc" ? "rosnąco" : "malejąco"
            } — kliknij, aby odwrócić`
          : hint
            ? `${hint} — kliknij, aby sortować`
            : `Sortuj po: ${label}`
      }
    >
      <span className="min-w-0 truncate">{label}</span>
      {isActive ? (
        <span className="shrink-0 text-[10px] leading-none" aria-hidden>
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      ) : (
        <span
          className="shrink-0 text-[10px] leading-none text-slate-300"
          aria-hidden
        >
          ↕
        </span>
      )}
    </button>
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
  density = "default",
}: {
  label: string;
  field: ZdEstimateListSortKey;
  sortKey: ZdEstimateListSortKey;
  sortDir: ZdEstimateListSortDir;
  onSort: (field: ZdEstimateListSortKey) => void;
  className?: string;
  align?: "left" | "right" | "center";
  /** Opis kolumny (tooltip), niezależny od sortowania */
  hint?: string;
  density?: "default" | "compact";
}) {
  const isActive = sortKey === field;
  const ariaSort =
    isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className={className} aria-sort={ariaSort} scope="col" title={hint}>
      <div
        className={cn(
          "flex",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
          align === "left" && "justify-start"
        )}
      >
        <ZdEstimateSortHeaderButton
          label={label}
          field={field}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          hint={hint}
          density={density}
        />
      </div>
    </th>
  );
}
