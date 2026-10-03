"use client";

import dynamic from "next/dynamic";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import {
  actionDeleteZdEstimatePackaging,
  actionDeleteZdEstimatePackagingBulk,
  actionDeleteZdEstimateMinStock,
  actionExcludeZdEstimateProduct,
  actionExcludeZdEstimateProducts,
  actionFindRecentZdAfterCreateAttempt,
  actionListZdEstimateExclusions,
  actionListZdEstimateOnRequests,
  actionListZdEstimateTeethTwIds,
  actionListZdEstimatePackaging,
  actionListZdEstimateMinStock,
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
  actionPollZdEstimateRunProgress,
  actionFetchZdEstimatePendingIndividuals,
  actionFetchZdEstimateProsbaReservationOverlap,
  actionGetZdBoostPowerPreset,
  actionSetZdBoostPowerPreset,
  actionSaveZdEstimateUiPrefs,
  actionSetZdEstimateExtrasPolicy,
  actionSearchZdEstimateCechy,
  actionSearchZdEstimateGroups,
  actionUpsertZdEstimatePackaging,
  actionUpsertZdEstimatePackagingBulk,
  actionUpsertZdEstimateMinStock,
  actionUpsertZdEstimateSupplierScope,
  actionCreateZdEstimateUiSession,
  actionUpsertZdEstimateUiSessionSnapshot,
  type ZdEstimateCechaOption,
  type ZdEstimateGroupOption,
  type ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import {
  policyForBoostPreset,
  ZD_BOOST_POWER_DEFAULT,
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
  isZdEstimateFavorite,
  toggleZdEstimateColumnVisibility,
  toggleZdEstimateFavorite,
  zdEstimateColumnOrderEqual,
  zdEstimateColumnVisibilityEqual,
  type ZdEstimateColumnVisibility,
  type ZdEstimateFavoriteRef,
  type ZdEstimateListFilter,
  type ZdEstimateOptionalColumn,
  type ZdEstimateUiPrefs,
} from "@/lib/orders/zd-estimate-prefs";
import {
  resolveZdEstimateFavoriteCechaChips,
  resolveZdEstimateFavoriteGroupChips,
} from "@/lib/orders/zd-estimate-scope-favorites";
import {
  collectTodayScheduleSuppliers,
  zdEstimateScopeCoverage,
  type ZdEstimateScopeCoverage,
} from "@/lib/orders/zd-estimate-scope-coverage";
import type { ZdEstimateExclusionRow } from "@/lib/data/zd-estimate-exclusions";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ZdEstimateMinStockRow } from "@/lib/data/zd-estimate-min-stock";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdProductBomRow } from "@/lib/data/zd-product-boms";
import {
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
  readZdEstimatePrepFormSession,
  writeZdEstimatePrepFormSession,
  type ZdEstimatePrepFormSession,
} from "@/lib/orders/zd-estimate-prep-form-session";
import { decideZdEstimateAutorunVsExternalSession } from "@/lib/orders/zd-estimate-external-session-autorun";
import {
  zdEstimateStickyToastClass,
  zdEstimateStickyToastStackIndices,
} from "@/lib/orders/zd-estimate-sticky-toast-stack";
import {
  buildZdEstimateUiSessionSnapshot,
  historyEntriesFromMap,
  historyMapFromEntries,
  parseZdEstimateUiSessionSnapshot,
  type ZdEstimateUiSessionSnapshot,
} from "@/lib/orders/zd-estimate-ui-session-snapshot";
import { bomRowsToRefs, bomRowHidesHardExclude, bomRowHidesOnRequest, hasUnresolvedExplodeBomNodes, zdEstimateLineSalesDemandSignal } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import {
  ZD_ESTIMATE_UI,
  zdEstimateBlockedDailyCtaMessage,
  zdEstimateBlockedOrdersAlertBody,
  zdEstimateEmptyListDescription,
  zdEstimatePageHint,
  zdEstimateProsbaWord,
  zdEstimateProsbaWordAccusative,
  zdEstimateLaunchReadyToastDescription,
  zdEstimateLaunchReadyToastTitle,
  zdEstimateRecountListStatus,
  zdEstimateRecountClosedPreviousSessionPrefix,
  zdEstimateRecountOverlayHint,
  zdEstimateRecountOverlayMessage,
  zdEstimateRunPhaseStatusHint,
  zdEstimateTruncatedListStatusNote,
  formatZdEstimateOrderableStatusNote,
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
import { applyGroupStockWindow, resolveSupplierForScopeSelection } from "@/lib/orders/zd-estimate-group-stock";
import {
  resolveZdScopeSupplierMapping,
} from "@/lib/orders/zd-estimate-supplier-scope";
import type { ZdEstimateSupplierScopeRow } from "@/lib/data/zd-estimate-supplier-scopes";
import type {
  ZdOrderAssignedElsewhere,
  ZdOrderScopeIncluded,
} from "@/lib/orders/zd-order-engine";
import { formatZdHorizonBreakdown, type ZdOrderHorizon } from "@/lib/orders/zd-order-horizon";
import {
  formatZdSalesSmoothingSummary,
  type ZdSalesSmoothingSummary,
} from "@/lib/orders/zd-sales-profile";
import {
  resolveZdEstimateActiveScopeLabel,
  resolveZdEstimateActiveSupplierName,
} from "@/lib/orders/zd-estimate-active-scope";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  DEFAULT_DNI_ZAPASU,
  salesWindowFromDniZapasu,
} from "@/lib/orders/zd-estimate-manual";
import {
  nextDataOdAfterDataDoChange,
  resolveLaunchDniZapasu,
  shouldApplyStockSalesWindow,
  type ZdEstimateSalesWindowSource,
} from "@/lib/orders/zd-estimate-sales-window";
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
  piecesArrivingForZdUnitsFromQty,
  resolveOrderQtyForLine,
  orderableLinesToTsv,
  pruneZdDocumentUnitOverrides,
} from "@/lib/orders/zd-estimate-packaging";
import {
  buildIndividualEstimateExtras,
  buildMikranByTwFromEstimateLines,
  collectIndividualOrderIdsForZdCreate,
  composeZdCreateUwagiWithServices,
  countExcludedWithIndividualRequests,
  expandPresentTwIdsWithPairPartners,
  individualExtraPiecesMap,
  reclassifyExcludedTwExtrasToServices,
  reclassifyMissingTwExtrasToServices,
  zdCreateUwagiBaseBudgetForServices,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import {
  collectTwIdsNeedingProsbaReservationOverlap,
  mapProsbaReservedOverlapDto,
  resolveProsbaReservationDedupeMaps,
  type ZdEstimateReservedOverlapSlice,
} from "@/lib/orders/zd-estimate-prosba-reservation-overlap";
import {
  applyCreatedZdUnitsToOtwarteZd,
  buildZdCreatePreviewFromOrderable,
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
} from "@/lib/orders/zd-estimate-post-create";
import {
  buildPairRatioByTwId,
  collectImplicitPieceSnapshotLines,
} from "@/lib/orders/zd-estimate-snapshot-lines";
import { refreshZdEstimateLinesWithPairs } from "@/lib/orders/zd-estimate-live-refresh";
import { coerceZdEstimateLinesBase } from "@/lib/orders/zd-estimate-lines-base";
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
import { ZdEstimateNotice } from "@/components/zakupy/ZdEstimateNotice";
import {
  ZdEstimateNoticeTrayBar,
  ZdEstimateNoticeTrayProvider,
} from "@/components/zakupy/ZdEstimateNoticeTray";
import { ZdEstimateDepartmentSettingsMenu } from "@/components/zakupy/ZdEstimateDepartmentSettingsMenu";
import { ZdEstimateSuppliersMenu } from "@/components/zakupy/ZdEstimateSuppliersMenu";
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
import { ZdEstimateIndividualServicesSection } from "@/components/zakupy/ZdEstimateIndividualServicesSection";
import { ZdEstimateBulkExcludeDialog } from "@/components/zakupy/ZdEstimateBulkExcludeDialog";
import { ZdEstimateBulkPackagingDialog } from "@/components/zakupy/ZdEstimateBulkPackagingDialog";
import { ZdEstimateExcludeDialog } from "@/components/zakupy/ZdEstimateExcludeDialog";
import { ZdEstimateLinkZdDialog } from "@/components/zakupy/ZdEstimateLinkZdDialog";
import { ZdEstimateCreateZdDialog } from "@/components/zakupy/ZdEstimateCreateZdDialog";
import { ZdEstimatePostCreatePanel } from "@/components/zakupy/ZdEstimatePostCreatePanel";
import { ZdEstimatePackagingDialog } from "@/components/zakupy/ZdEstimatePackagingDialog";
import { ZdEstimateMinStockDialog } from "@/components/zakupy/ZdEstimateMinStockDialog";
import type { ZdPairSeedProduct } from "@/components/zakupy/ZdEstimatePairsModal";
import type { ZdBomSeedProduct } from "@/components/zakupy/ZdEstimateBomsModal";
import {
  ZdEstimateTableRow,
  zdEstimateFlowColumnClass,
} from "@/components/zakupy/ZdEstimateTableRow";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useZdEstimateSelection } from "@/hooks/useZdEstimateSelection";
import {
  useZdEstimateCreateZdFlow,
  useZdEstimateCreateZdGate,
} from "@/hooks/useZdEstimateCreateZdFlow";
import {
  useZdEstimateRulesData,
  useZdEstimateRulesLiveApply,
} from "@/hooks/useZdEstimateRules";
import {
  ZdEstimateLaunchProgressPanel,
} from "@/components/zakupy/ZdEstimateLaunchProgress";
import { ZdEstimateSessionResumeProgressPanel } from "@/components/zakupy/ZdEstimateSessionResumeProgressPanel";
import { ZdEstimateExternalSessionActiveChip } from "@/components/zakupy/ZdEstimateExternalSessionActiveChip";
import { ZdEstimatePageIntro } from "@/components/zakupy/ZdEstimatePageIntro";
import { ZdEstimatePrepScopeFacts } from "@/components/zakupy/ZdEstimatePrepScopeFacts";
import { ZdEstimatePrepForm } from "@/components/zakupy/ZdEstimatePrepForm";
import { ZdEstimateScopeCatalogDialog } from "@/components/zakupy/ZdEstimateScopeCatalogDialog";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import {
  formatZdCreateSferaUserMessage,
  humanizeSferaCreateError,
} from "@/lib/subiekt/sfera-create-error";
import { ZdEstimateRecountOverlay } from "@/components/zakupy/ZdEstimateRecountOverlay";
import {
  formatLaunchProgressPagesLabel,
  launchProgressMinRevealWaitMs,
  launchProgressPctFromRun,
  ZD_ESTIMATE_LAUNCH_PROGRESS_MISS_FALLBACK,
  ZD_ESTIMATE_SESSION_RESUME_COMPLETE_TAIL_MS,
  ZD_ESTIMATE_SESSION_RESUME_MIN_VISIBLE_MS,
} from "@/lib/orders/zd-estimate-launch-progress";
import {
  shouldClearRunProgressOnMiss,
  type ZdEstimateRunProgressSnapshot,
} from "@/lib/orders/zd-estimate-run-progress";
import {
  clearZdEstimateExternalSessionResumeQueryParam,
  isZdEstimateExternalSessionReturnNavigation,
  shouldShowZdEstimateSessionResumeLoading,
} from "@/lib/orders/zd-estimate-external-session-resume";
import {
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
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { useZdEstimateTableVirtualizer } from "@/hooks/useZdEstimateTableVirtualizer";
import {
  countZdEstimateTableColumns,
  registerZdEstimateVirtualScrollToTwId,
} from "@/lib/orders/zd-estimate-table-virtual";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
} from "@/components/ui/OverflowMenu";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconAlertCircle,
  IconChartTrend,
  IconChevronDown,
  IconClipboardList,
  IconInfoCircle,
  IconLayers,
  IconTarget,
} from "@/components/icons/StrokeIcons";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  floatingToastAboveZdStickyClass,
  floatingToastAboveZdStickyTallClass,
} from "@/lib/ui/sales-mobile-chrome";
import {
  checkboxBrandClass,
  zdEstimateCardSurfaceClass,
  zdEstimateDockButtonClass,
  zdEstimateListBodyInsetClass,
  zdEstimateListBodyPadClass,
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
  /** Start z zaznaczoną opcją „Do kolejnej dostawy” (link z panelu Braki). */
  leadTimeHorizon?: boolean;
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
  quickCechy: ZdEstimateCechaOption[];
  exclusions: ZdEstimateExclusionRow[];
  exclusionsError: string | null;
  onRequests: ZdEstimateOnRequestRow[];
  onRequestsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
  minStock: ZdEstimateMinStockRow[];
  minStockError: string | null;
  productPairs: ZdProductPairRow[];
  productPairsError: string | null;
  productBoms: ZdProductBomRow[];
  productBomsError: string | null;
  teethTwIds: number[];
  teethProductsError: string | null;
  uiPrefs?: ZdEstimateUiPrefs;
  extrasPolicy?: ZdEstimateExtrasPolicy;
  todayScopeCoverage?: ZdEstimateScopeCoverage;
  supplierScopes?: import("@/lib/data/zd-estimate-supplier-scopes").ZdEstimateSupplierScopeRow[];
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

/** Renderuje dzieci dopiero od pierwszego `open` i trzyma je potem zamontowane (stan okna przetrwa zamknięcie). */
function MountAfterOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return mounted ? children : null;
}

/** Okna ustawień (setki linii każde) ładowane dopiero przy pierwszym otwarciu — lżejszy start kreatora. */
const ZdEstimatePackagingModal = dynamic(
  () => import("@/components/zakupy/ZdEstimatePackagingModal").then((mod) => ({ default: mod.ZdEstimatePackagingModal })),
  { ssr: false }
);
const ZdEstimateMinStockModal = dynamic(
  () => import("@/components/zakupy/ZdEstimateMinStockModal").then((mod) => ({ default: mod.ZdEstimateMinStockModal })),
  { ssr: false }
);
const ZdEstimatePairsModal = dynamic(
  () => import("@/components/zakupy/ZdEstimatePairsModal").then((mod) => ({ default: mod.ZdEstimatePairsModal })),
  { ssr: false }
);
const ZdEstimateBomsModal = dynamic(
  () => import("@/components/zakupy/ZdEstimateBomsModal").then((mod) => ({ default: mod.ZdEstimateBomsModal })),
  { ssr: false }
);
const ZdEstimateExclusionsModal = dynamic(
  () => import("@/components/zakupy/ZdEstimateExclusionsModal").then((mod) => ({ default: mod.ZdEstimateExclusionsModal })),
  { ssr: false }
);
const ZdEstimateOnRequestModal = dynamic(
  () => import("@/components/zakupy/ZdEstimateOnRequestModal").then((mod) => ({ default: mod.ZdEstimateOnRequestModal })),
  { ssr: false }
);
const ZdEstimateSupplierScopesModal = dynamic(
  () => import("@/components/zakupy/ZdEstimateSupplierScopesModal").then((mod) => ({ default: mod.ZdEstimateSupplierScopesModal })),
  { ssr: false }
);
const ZdEstimateSnapshotsModal = dynamic(
  () => import("@/components/zakupy/ZdEstimateSnapshotsModal").then((mod) => ({ default: mod.ZdEstimateSnapshotsModal })),
  { ssr: false }
);

function resolveWindowForGroup(
  group: ZdEstimateGroupOption,
  suppliers: ZdEstimateSupplierOption[],
  salesEndKey: string
) {
  if (group.supplierId) {
    const card = suppliers.find((s) => s.id === group.supplierId);
    const rawDni = group.dniZapasu ?? card?.dniZapasu ?? null;
    const dniZapasu =
      rawDni != null && rawDni > 0 ? rawDni : DEFAULT_DNI_ZAPASU;
    const window = salesWindowFromDniZapasu(dniZapasu, salesEndKey);
    return {
      dniZapasu,
      dataOd: window.dataOd,
      dataDo: window.dataDo,
      supplierId: group.supplierId,
      supplierName: group.supplierName ?? card?.name ?? null,
      stockLabel: group.stockLabel ?? card?.stockLabel ?? null,
      matched: true as const,
      matchSource: group.supplierMatchSource ?? null,
    };
  }
  const applied = applyGroupStockWindow({
    groupName: group.grt_Nazwa,
    suppliers,
    salesEndKey,
    fallbackDniZapasu: DEFAULT_DNI_ZAPASU,
    salesWindowFromDniZapasu,
  });
  return { ...applied, matchSource: applied.matched ? ("name" as const) : null };
}

function resolveWindowForCecha(
  cecha: ZdEstimateCechaOption,
  suppliers: ZdEstimateSupplierOption[],
  salesEndKey: string
) {
  if (cecha.supplierId) {
    const card = suppliers.find((s) => s.id === cecha.supplierId);
    const rawDni = cecha.dniZapasu ?? card?.dniZapasu ?? null;
    const dniZapasu =
      rawDni != null && rawDni > 0 ? rawDni : DEFAULT_DNI_ZAPASU;
    const window = salesWindowFromDniZapasu(dniZapasu, salesEndKey);
    return {
      dniZapasu,
      dataOd: window.dataOd,
      dataDo: window.dataDo,
      supplierId: cecha.supplierId,
      supplierName: cecha.supplierName ?? card?.name ?? null,
      stockLabel: cecha.stockLabel ?? card?.stockLabel ?? null,
      matched: true as const,
      matchSource: cecha.supplierMatchSource ?? null,
    };
  }
  const applied = applyGroupStockWindow({
    groupName: cecha.ctw_Nazwa,
    suppliers,
    salesEndKey,
    fallbackDniZapasu: DEFAULT_DNI_ZAPASU,
    salesWindowFromDniZapasu,
  });
  return { ...applied, matchSource: applied.matched ? ("name" as const) : null };
}

function mappingNoticeForSelection(input: {
  matchSource: "mapping" | "name" | null | undefined;
  supplierName: string | null | undefined;
  scopeLabel: string;
}): string | null {
  if (input.matchSource !== "mapping" || !input.supplierName?.trim()) return null;
  return ZD_ESTIMATE_UI.supplierFromMappingNotice(
    input.supplierName.trim(),
    input.scopeLabel
  );
}

function enrichLaunchGroupOption(
  launch: NonNullable<ZdEstimateLaunchProps>,
  suppliers: ZdEstimateSupplierOption[],
  scopes: readonly ZdEstimateSupplierScopeRow[]
): ZdEstimateGroupOption | null {
  if (launch.mode !== "grupa" || !launch.grupaId) return null;
  const label = launch.label?.trim() || `Grupa ${launch.grupaId}`;
  // Wspólny zakres: dostawca z linku wygrywa (Polkard BIS ≠ Polkard).
  const mapping = resolveZdScopeSupplierMapping(scopes, "grupa", launch.grupaId, launch.supplierId);
  const mappedId = mapping.mappedSupplierId;
  const resolved = resolveSupplierForScopeSelection({
    scopeName: label,
    suppliers,
    mappedSupplierId: mappedId,
    nameMatchSupplierIds: mapping.candidateSupplierIds,
  });
  if (resolved.supplier) {
    return {
      grt_Id: launch.grupaId,
      grt_Nazwa: label,
      supplierId: resolved.supplier.id,
      supplierName: resolved.supplier.name,
      dniZapasu: resolved.supplier.dniZapasu ?? null,
      stockLabel: resolved.supplier.stockLabel ?? null,
      subiektKhId: resolved.supplier.subiektKhId ?? null,
      additionalSubiektKhIds: resolved.supplier.additionalSubiektKhIds ?? [],
      supplierMatchSource: resolved.source,
      supplierMappingUnresolved: false,
    };
  }
  if (resolved.mappingUnresolved) {
    const keepLaunch =
      Boolean(mappedId) && launch.supplierId != null && launch.supplierId === mappedId;
    return {
      grt_Id: launch.grupaId,
      grt_Nazwa: label,
      supplierId: keepLaunch ? launch.supplierId : null,
      supplierName: keepLaunch ? (launch.supplierName ?? null) : null,
      dniZapasu: null,
      stockLabel: null,
      subiektKhId: null,
      additionalSubiektKhIds: [],
      supplierMatchSource: null,
      supplierMappingUnresolved: true,
    };
  }
  const fromLaunch = launch.supplierId
    ? suppliers.find((s) => s.id === launch.supplierId) ?? null
    : null;
  return {
    grt_Id: launch.grupaId,
    grt_Nazwa: label,
    supplierId: fromLaunch?.id ?? launch.supplierId ?? null,
    supplierName: fromLaunch?.name ?? launch.supplierName ?? null,
    dniZapasu: fromLaunch?.dniZapasu ?? null,
    stockLabel: fromLaunch?.stockLabel ?? null,
    subiektKhId: fromLaunch?.subiektKhId ?? null,
    additionalSubiektKhIds: fromLaunch?.additionalSubiektKhIds ?? [],
    supplierMatchSource: null,
    supplierMappingUnresolved: false,
  };
}

function enrichLaunchCechaOption(
  launch: NonNullable<ZdEstimateLaunchProps>,
  suppliers: ZdEstimateSupplierOption[],
  scopes: readonly ZdEstimateSupplierScopeRow[]
): ZdEstimateCechaOption | null {
  if (launch.mode !== "cecha" || !launch.cechaId) return null;
  const label = launch.label?.trim() || `Cecha ${launch.cechaId}`;
  // Wspólny zakres: dostawca z linku wygrywa (Polkard BIS ≠ Polkard).
  const mapping = resolveZdScopeSupplierMapping(scopes, "cecha", launch.cechaId, launch.supplierId);
  const mappedId = mapping.mappedSupplierId;
  const resolved = resolveSupplierForScopeSelection({
    scopeName: label,
    suppliers,
    mappedSupplierId: mappedId,
    nameMatchSupplierIds: mapping.candidateSupplierIds,
  });
  if (resolved.supplier) {
    return {
      ctw_Id: launch.cechaId,
      ctw_Nazwa: label,
      supplierId: resolved.supplier.id,
      supplierName: resolved.supplier.name,
      dniZapasu: resolved.supplier.dniZapasu ?? null,
      stockLabel: resolved.supplier.stockLabel ?? null,
      subiektKhId: resolved.supplier.subiektKhId ?? null,
      additionalSubiektKhIds: resolved.supplier.additionalSubiektKhIds ?? [],
      supplierMatchSource: resolved.source,
      supplierMappingUnresolved: false,
    };
  }
  if (resolved.mappingUnresolved) {
    const keepLaunch =
      Boolean(mappedId) && launch.supplierId != null && launch.supplierId === mappedId;
    return {
      ctw_Id: launch.cechaId,
      ctw_Nazwa: label,
      supplierId: keepLaunch ? launch.supplierId : null,
      supplierName: keepLaunch ? (launch.supplierName ?? null) : null,
      dniZapasu: null,
      stockLabel: null,
      subiektKhId: null,
      additionalSubiektKhIds: [],
      supplierMatchSource: null,
      supplierMappingUnresolved: true,
    };
  }
  const fromLaunch = launch.supplierId
    ? suppliers.find((s) => s.id === launch.supplierId) ?? null
    : null;
  return {
    ctw_Id: launch.cechaId,
    ctw_Nazwa: label,
    supplierId: fromLaunch?.id ?? launch.supplierId ?? null,
    supplierName: fromLaunch?.name ?? launch.supplierName ?? null,
    dniZapasu: fromLaunch?.dniZapasu ?? null,
    stockLabel: fromLaunch?.stockLabel ?? null,
    subiektKhId: fromLaunch?.subiektKhId ?? null,
    additionalSubiektKhIds: fromLaunch?.additionalSubiektKhIds ?? [],
    supplierMatchSource: null,
    supplierMappingUnresolved: false,
  };
}

function applyScopeSupplierFields<
  T extends {
    supplierId?: string | null;
    supplierName?: string | null;
    dniZapasu?: number | null;
    stockLabel?: string | null;
    subiektKhId?: number | null;
    additionalSubiektKhIds?: number[];
    supplierMatchSource?: "mapping" | "name" | null;
    supplierMappingUnresolved?: boolean;
  },
>(
  base: T,
  resolved: {
    supplier: ZdEstimateSupplierOption | null;
    source: "mapping" | "name" | null;
    mappingUnresolved?: boolean;
  }
): T {
  return {
    ...base,
    supplierId: resolved.supplier?.id ?? null,
    supplierName: resolved.supplier?.name ?? null,
    dniZapasu: resolved.supplier?.dniZapasu ?? null,
    stockLabel: resolved.supplier?.stockLabel ?? null,
    subiektKhId: resolved.supplier?.subiektKhId ?? null,
    additionalSubiektKhIds: resolved.supplier?.additionalSubiektKhIds ?? [],
    supplierMatchSource: resolved.source,
    supplierMappingUnresolved: resolved.mappingUnresolved === true,
  };
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
  const [rematting, startRemat] = useTransition();
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

  /**
   * Ephemeral prep-form state (sessionStorage) — odtwarza wybór zakresu
   * i parametry Policz po nawigacji do /podsumowanie i z powrotem,
   * gdy nie ma aktywnej sesji zewnętrznej (post-Policz).
   * Sesja zewnętrzna (DB) nadpisuje te wartości po restore.
   */
  const [prepFormSession] = useState<ZdEstimatePrepFormSession | null>(() =>
    readZdEstimatePrepFormSession()
  );
  const [scopeMode, setScopeMode] = useState<ZdEstimateRunMode>(
    () => launch?.mode ?? prepFormSession?.scopeMode ?? "grupa"
  );
  const [groupQuery, setGroupQuery] = useState(() =>
    launch?.mode === "grupa"
      ? launch.label?.trim() ?? ""
      : prepFormSession?.scopeMode === "grupa"
        ? prepFormSession.groupQuery
        : ""
  );
  const [groupHits, setGroupHits] = useState<ZdEstimateGroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ZdEstimateGroupOption | null>(
    () =>
      launch
        ? enrichLaunchGroupOption(
            launch,
            bootstrap.suppliers,
            bootstrap.supplierScopes ?? []
          )
        : prepFormSession?.selectedGroup ?? null
  );
  const [cechaQuery, setCechaQuery] = useState(() =>
    launch?.mode === "cecha"
      ? launch.label?.trim() ?? ""
      : prepFormSession?.scopeMode === "cecha"
        ? prepFormSession.cechaQuery
        : ""
  );
  const [cechaHits, setCechaHits] = useState<ZdEstimateCechaOption[]>([]);
  const [selectedCecha, setSelectedCecha] = useState<ZdEstimateCechaOption | null>(
    () =>
      launch
        ? enrichLaunchCechaOption(
            launch,
            bootstrap.suppliers,
            bootstrap.supplierScopes ?? []
          )
        : prepFormSession?.selectedCecha ?? null
  );
  const [supplierId, setSupplierId] = useState<string | null>(() => {
    if (launch) {
      if (launch.mode === "grupa") {
        return (
          enrichLaunchGroupOption(
            launch,
            bootstrap.suppliers,
            bootstrap.supplierScopes ?? []
          )?.supplierId ??
          launch.supplierId ??
          null
        );
      }
      if (launch.mode === "cecha") {
        return (
          enrichLaunchCechaOption(
            launch,
            bootstrap.suppliers,
            bootstrap.supplierScopes ?? []
          )?.supplierId ??
          launch.supplierId ??
          null
        );
      }
      return launch.supplierId ?? null;
    }
    return prepFormSession?.supplierId ?? null;
  });
  /** Komunikat: dostawca przypisany z mapowania zakresów. */
  const [supplierFromMappingNotice, setSupplierFromMappingNotice] = useState<
    string | null
  >(() => {
    if (launch) {
      if (launch.mode === "grupa") {
        const g = enrichLaunchGroupOption(
          launch,
          bootstrap.suppliers,
          bootstrap.supplierScopes ?? []
        );
        return mappingNoticeForSelection({
          matchSource: g?.supplierMatchSource,
          supplierName: g?.supplierName,
          scopeLabel: g?.grt_Nazwa ?? "",
        });
      }
      if (launch.mode === "cecha") {
        const c = enrichLaunchCechaOption(
          launch,
          bootstrap.suppliers,
          bootstrap.supplierScopes ?? []
        );
        return mappingNoticeForSelection({
          matchSource: c?.supplierMatchSource,
          supplierName: c?.supplierName,
          scopeLabel: c?.ctw_Nazwa ?? "",
        });
      }
      return null;
    }
    // Brak launchu — odtwórz notice z prep-form session (jeśli zapisany).
    if (prepFormSession?.scopeMode === "grupa" && prepFormSession.selectedGroup) {
      const g = prepFormSession.selectedGroup;
      return mappingNoticeForSelection({
        matchSource: g.supplierMatchSource ?? null,
        supplierName: g.supplierName,
        scopeLabel: g.grt_Nazwa ?? "",
      });
    }
    if (prepFormSession?.scopeMode === "cecha" && prepFormSession.selectedCecha) {
      const c = prepFormSession.selectedCecha;
      return mappingNoticeForSelection({
        matchSource: c.supplierMatchSource ?? null,
        supplierName: c.supplierName,
        scopeLabel: c.ctw_Nazwa ?? "",
      });
    }
    return null;
  });
  const [dniZapasu, setDniZapasu] = useState(() => {
    if (!launch && prepFormSession?.dniZapasu) {
      return prepFormSession.dniZapasu;
    }
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
    if (!launch && prepFormSession?.dataOd) {
      return prepFormSession.dataOd;
    }
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
  const [dataDo, setDataDo] = useState(
    () =>
      !launch && prepFormSession?.dataDo
        ? prepFormSession.dataDo
        : bootstrap.defaultWindow.dataDo
  );
  /**
   * manual = użytkownik ustawił Data od/do — nie nadpisuj z zapasu dostawcy/grupy.
   * Zmiana „Dni zapasu” wraca do stock (świadome przeliczenie okna).
   */
  const [salesWindowSource, setSalesWindowSource] =
    useState<ZdEstimateSalesWindowSource>(
      () =>
        !launch && prepFormSession?.salesWindowSource
          ? prepFormSession.salesWindowSource
          : "stock"
    );
  const [zapasMin, setZapasMin] = useState(
    () =>
      !launch && prepFormSession?.zapasMin != null
        ? prepFormSession.zapasMin
        : String(uiPrefs.zapasMin)
  );
  const [showAdvanced, setShowAdvanced] = useState(
    () =>
      !launch && prepFormSession?.showAdvanced != null
        ? prepFormSession.showAdvanced
        : uiPrefs.showAdvanced
  );
  const [favoriteGroups, setFavoriteGroups] = useState<ZdEstimateFavoriteRef[]>(
    () => uiPrefs.favoriteGroups.map((f) => ({ ...f }))
  );
  const [favoriteCechy, setFavoriteCechy] = useState<ZdEstimateFavoriteRef[]>(
    () => uiPrefs.favoriteCechy.map((f) => ({ ...f }))
  );
  const [groupEnrichById, setGroupEnrichById] = useState(
    () => new Map(bootstrap.quickGroups.map((g) => [g.grt_Id, g] as const))
  );
  const [cechaEnrichById, setCechaEnrichById] = useState(() => {
    return new Map(
      (bootstrap.quickCechy ?? []).map((c) => [c.ctw_Id, c] as const)
    );
  });
  const [scopeCatalogOpen, setScopeCatalogOpen] = useState(false);
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
  /**
   * Opcja „Uwzględnij czas dostawy” — domyślnie wyłączona: bez niej Kreator
   * liczy dokładnie jak wcześniej (dni zapasu z karty).
   */
  /** tw → cena netto za sztukę z ostatniego ZD (kolumna „Wartość”, suma ZD). */
  const [unitPriceByTwId, setUnitPriceByTwId] = useState<Record<number, number>>({});
  const [leadTimeHorizon, setLeadTimeHorizon] = useState(() =>
    Boolean(launch?.leadTimeHorizon)
  );
  const [horizonNeedsRecount, setHorizonNeedsRecount] = useState(false);
  /** Opcja „Wygładź skoki” (domyślnie wyłączona) — jak czas dostawy: zmiana = przeliczenie. */
  const [salesSmoothing, setSalesSmoothing] = useState(false);
  /** Kwalifikacja snapshotów do history cut zmieniona — lista Do ZD nieaktualna. */
  const [historyNeedsRecount, setHistoryNeedsRecount] = useState(false);
  /** Fetch historii przy Policz rzucił — cięcia mogły nie wejść. */
  const [historyFetchFailed, setHistoryFetchFailed] = useState(false);
  /** Z ostatniego Policz: zakresy dostawcy, towary przypisane innym, podpowiedzi ZD. */
  const [policzScopeInfo, setPoliczScopeInfo] = useState<{
    scopesIncluded: ZdOrderScopeIncluded[];
    assignedElsewhere: ZdOrderAssignedElsewhere[];
    otherSupplierHintByTwId: Record<number, string>;
    /** Rozbicie horyzontu, gdy Policz liczył z czasem dostawy. */
    horizon: ZdOrderHorizon | null;
    /** Ile pozycji zmieniło wygładzenie (null = opcja wyłączona). */
    salesSmoothing?: ZdSalesSmoothingSummary | null;
  } | null>(null);
  const [extrasPolicy, setExtrasPolicy] = useState<ZdEstimateExtrasPolicy>(
    () =>
      !launch && prepFormSession?.extrasPolicy
        ? prepFormSession.extrasPolicy
        : bootstrap.extrasPolicy ?? "sum"
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
    () =>
      !launch && prepFormSession?.boostPreset
        ? prepFormSession.boostPreset
        : ZD_BOOST_POWER_DEFAULT
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
  /** Toast po re-Policz (floating — nie zabiera wysokości tabeli). */
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
  /** Live postęp Policz (poll) — Launch + Recount. */
  const [runProgressSnapshot, setRunProgressSnapshot] =
    useState<ZdEstimateRunProgressSnapshot | null>(null);
  const runProgressPollRef = useRef<number | null>(null);
  const runProgressMissesRef = useRef(0);
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

  const stopRunProgressPoll = useCallback(() => {
    if (runProgressPollRef.current != null) {
      window.clearInterval(runProgressPollRef.current);
      runProgressPollRef.current = null;
    }
  }, []);

  const startRunProgressPoll = useCallback(
    (progressId: string, estimateGen: number) => {
      stopRunProgressPoll();
      runProgressMissesRef.current = 0;
      setRunProgressSnapshot(null);
      let inFlight = false;
      let hadLive = false;
      const tick = async () => {
        if (inFlight) return;
        if (estimateGen !== estimateGenRef.current) {
          stopRunProgressPoll();
          return;
        }
        inFlight = true;
        try {
          const res = await actionPollZdEstimateRunProgress(progressId);
          if (estimateGen !== estimateGenRef.current) return;
          if (res.found) {
            runProgressMissesRef.current = 0;
            hadLive = true;
            setRunProgressSnapshot(res.snapshot);
            return;
          }
          runProgressMissesRef.current += 1;
          if (
            shouldClearRunProgressOnMiss({
              consecutiveMisses: runProgressMissesRef.current,
              hadLiveSnapshot: hadLive,
              missFallback: ZD_ESTIMATE_LAUNCH_PROGRESS_MISS_FALLBACK,
            })
          ) {
            setRunProgressSnapshot(null);
          }
        } catch {
          runProgressMissesRef.current += 1;
        } finally {
          inFlight = false;
        }
      };
      void tick();
      runProgressPollRef.current = window.setInterval(() => {
        void tick();
      }, 400);
    },
    [stopRunProgressPoll]
  );

  useEffect(() => {
    return () => {
      stopRunProgressPoll();
    };
  }, [stopRunProgressPoll]);

  const [columns, setColumns] = useState<ZdEstimateColumnVisibility>(
    () => ({ ...uiPrefs.columns })
  );
  const [columnOrder, setColumnOrder] = useState<ZdEstimateOptionalColumn[]>(
    () => [...uiPrefs.columnOrder]
  );
  const showZkColumn = columns.zk;
  const showPackagingColumn = columns.packaging;
  const visibleOptionalColumns = useMemo(
    () => resolveZdEstimateScrollableColumnOrder(columns, columnOrder),
    [columns, columnOrder]
  );
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
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
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
  const {
    setListComputedAtMs,
    createListAgeMinutes,
    postCreate,
    setPostCreate,
    createZdOpen,
    setCreateZdOpen,
    createDoneDokId,
    setCreateDoneDokId,
    createDoneDokNr,
    setCreateDoneDokNr,
    createUnconfirmedAttempt,
    setCreateUnconfirmedAttempt,
    creatingZd,
    setCreatingZd,
    createPreviewCaptureRef,
    createPreviewFrozen,
    setCreatePreviewFrozen,
    createLineMetaCaptureRef,
    createMarkFreezeCaptureRef,
    timeoutRecoveryFreezeRef,
    createMarkFreezeFrozen,
    setCreateMarkFreezeFrozen,
    consumedOnThisZdIds,
    glowneRemovedForUndoRef,
    glowneUndoOrderIdsRef,
    rememberConsumedOrderIds,
    linkNrPrefill,
    setLinkNrPrefill,
    linkZdOpen,
    setLinkZdOpen,
    createUnlockedAfterDone,
    setCreateUnlockedAfterDone,
    createTimeoutUnlockConfirmOpen,
    setCreateTimeoutUnlockConfirmOpen,
    createUndoVisible,
    setCreateUndoVisible,
    openCreateZdModal,
    closeCreateZdModal,
    openLinkZdModal,
    resetCreateZdFlow,
  } = useZdEstimateCreateZdFlow();
  const [copyOk, setCopyOk] = useState(false);
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
  /** Zarezerwowane ZK per tw — null = jeszcze nie dociągnięte (fail-open). */
  const [prosbaReservedByTwId, setProsbaReservedByTwId] = useState<Map<
    number,
    ZdEstimateReservedOverlapSlice[]
  > | null>(null);
  /**
   * Po udanym resolve z Policz: pomiń jednorazowo refetch dla tej listy tw.
   * Nie ustawiać gdy Policz nie rozwiązał overlap (resolved=false).
   */
  const skipProsbaOverlapFetchKeyRef = useRef<string | null>(null);
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [onRequestPanelOpen, setOnRequestPanelOpen] = useState(false);
  const [minStockOpen, setMinStockOpen] = useState(false);
  const rulesState = useZdEstimateRulesData(bootstrap);
  const {
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
    dbExcludedIds,
    onRequestTwIds,
    teethTwIdSet,
    packagingByTwIdForRefresh,
    minStockByTwIdForRefresh,
    packagingMap,
    packPairTwIds,
    packagingLookup,
  } = rulesState;
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
  const [qtyOverrideByTwId, setQtyOverrideByTwId] = useState<Record<number, number>>({});
  const [sessionIncludeTwIds, setSessionIncludeTwIds] = useState<Record<number, true>>({});
  const [packagingOpen, setPackagingOpen] = useState(false);
  const [minStockCandidate, setMinStockCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [packagingCandidate, setPackagingCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [excludeCandidate, setExcludeCandidate] =
    useState<ManualZdEstimateLine | null>(null);
  const [mutatingTwId, setMutatingTwId] = useState<number | null>(null);
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
  /** Daily „Przygotuj ZD” zamyka starą sesję i odpala autorun (bez dialogu). */
  const [externalSessionAutorunReplacePending, setExternalSessionAutorunReplacePending] =
    useState(false);
  const autorunReplaceMetaRef = useRef<{
    supplierChanged: boolean;
    nextSupplierName: string | null;
  } | null>(null);
  /** sessionId z momentu decyzji — nie polegaj na tokenie po async gap. */
  const autorunReplaceSessionIdRef = useRef<string | null>(null);
  const [externalSessionScopeChangeOpen, setExternalSessionScopeChangeOpen] =
    useState(false);
  const sessionResumeStartedAtMsRef = useRef(0);
  const [sessionResumeStartedAtMs, setSessionResumeStartedAtMs] = useState(0);
  const sessionResumeRevealTimerRef = useRef<number | null>(null);
  const pendingRestoredToastRef = useRef<string | null>(null);
  /** Blokuje formularz zakresu do czasu restore (także cichego refreshu z tokenem). */
  // Start zawsze false (jak SSR) — token z localStorage czyta useLayoutEffect
  // (restoreExternalSession) przed paint; inaczej hydracja się rozjeżdża.
  const [sessionRestorePending, setSessionRestorePending] = useState(false);
  const [sessionResumeBlocking, setSessionResumeBlocking] = useState(false);
  const [sessionResumeForceComplete, setSessionResumeForceComplete] =
    useState(false);
  const [sessionResumeReturningFromAway, setSessionResumeReturningFromAway] =
    useState(false);
  const busy = estimating || searching || mutating || rematting;

  const reportError = useCallback(
    (message: string, opts?: { title?: string }) => {
      setFeedback(null);
      // Siatka bezpieczeństwa: stary build serwera / surowy HRESULT z ORDERS.
      const sfera = humanizeSferaCreateError(message);
      if (sfera) {
        setErrorTitle(sfera.title);
        setErrorMessage(sfera.message);
        return;
      }
      if (/HRESULT|0x[0-9a-fA-F]{8}/i.test(message)) {
        const formatted = formatZdCreateSferaUserMessage(message);
        setErrorTitle(opts?.title?.trim() || formatted.title);
        setErrorMessage(formatted.message);
        return;
      }
      setErrorTitle(opts?.title?.trim() || null);
      setErrorMessage(userFacingErrorTextFromMessage(message));
    },
    []
  );

  // Gdy ktoś czyści errorMessage bez tytułu — nie zostawiaj starego nagłówka Alert.
  // Pochodna zamiast effect — errorTitle żyje tylko gdy errorMessage żyje.
  const effectiveErrorTitle = errorMessage ? errorTitle : null;

  const flashSettingsLive = useCallback((message: string) => {
    setSettingsLiveMessage(message);
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
    favoriteGroups: ZdEstimateFavoriteRef[];
    favoriteCechy: ZdEstimateFavoriteRef[];
  }>({
    zapasMin: Number(zapasMin) || 0,
    showAdvanced,
    columns,
    columnOrder,
    listFilter,
    sortKey,
    sortDir,
    favoriteGroups,
    favoriteCechy,
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
      favoriteGroups: uiPrefs.favoriteGroups,
      favoriteCechy: uiPrefs.favoriteCechy,
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
      favoriteGroups: prefsPayloadRef.current.favoriteGroups.map((f) => ({
        ...f,
      })),
      favoriteCechy: prefsPayloadRef.current.favoriteCechy.map((f) => ({
        ...f,
      })),
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
      favoriteGroups: patch.favoriteGroups,
      favoriteCechy: patch.favoriteCechy,
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
          res.message || "Nie udało się zapisać preferencji kreatora."
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
      favoriteGroups: favoriteGroups.map((f) => ({ ...f })),
      favoriteCechy: favoriteCechy.map((f) => ({ ...f })),
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
    favoriteGroups,
    favoriteCechy,
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

  // ---------------------------------------------------------------------------
  // Prep-form session (sessionStorage) — debounced write + flush na unmount.
  // Odtwarza wybór zakresu i parametry Policz po nawigacji do /podsumowanie
  // i z powrotem, gdy nie ma aktywnej sesji zewnętrznej (post-Policz).
  // ---------------------------------------------------------------------------
  const prepFormSessionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prepFormSessionTimerRef.current != null) {
      window.clearTimeout(prepFormSessionTimerRef.current);
    }
    prepFormSessionTimerRef.current = window.setTimeout(() => {
      prepFormSessionTimerRef.current = null;
      writeZdEstimatePrepFormSession({
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
        boostPreset,
        extrasPolicy,
      });
    }, 400);
    return () => {
      if (prepFormSessionTimerRef.current != null) {
        window.clearTimeout(prepFormSessionTimerRef.current);
        prepFormSessionTimerRef.current = null;
      }
    };
  }, [
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
    boostPreset,
    extrasPolicy,
  ]);

  // Flush na unmount / page hide — nie zgub ostatnich zmian.
  useEffect(() => {
    const flushPrepFormSession = () => {
      if (prepFormSessionTimerRef.current != null) {
        window.clearTimeout(prepFormSessionTimerRef.current);
        prepFormSessionTimerRef.current = null;
      }
      writeZdEstimatePrepFormSession({
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
        boostPreset,
        extrasPolicy,
      });
    };
    const onHide = () => flushPrepFormSession();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPrepFormSession();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushPrepFormSession();
    };
  }, [
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
    boostPreset,
    extrasPolicy,
  ]);

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

  const canAutoRecount =
    Boolean(linesBase?.length) &&
    ((scopeMode === "grupa" && selectedGroup?.grt_Id) ||
      (scopeMode === "cecha" && selectedCecha?.ctw_Id));

  const {
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
  } = useZdEstimateRulesLiveApply({
    rules: rulesState,
    linesBase,
    sessionIncludeTwIds,
    dniZapasu,
    paramInfo,
    zapasMin,
    historyByTwId,
    appliedBoostPolicy,
    canAutoRecount: Boolean(canAutoRecount),
    startRemat,
    setLines,
    setMissingPartnerTwIds,
    setMissingBomTwIds,
    flashSettingsLive,
    runEstimateRef,
  });

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
    const presentTwIds = expandPresentTwIdsWithPairPartners(
      new Set((lines ?? []).map((l) => l.tw_Id)),
      productPairs
    );
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

  /**
   * Lift on-request: zawsze RAW extras (istnienie prośby), nie po overlap.
   * Inaczej pełny overlap zdejmuje lift → reclassify → pętla clear/refetch.
   */
  const catalogRawExtraByTwId = useMemo(
    () => individualExtraPiecesMap(catalogExtrasBundle),
    [catalogExtrasBundle]
  );

  const extraOnlyTwIds = useMemo(() => {
    if (!pendingIndividualsTrusted) return new Set<number>();
    return buildExtraOnlyTwIds(
      onRequestTwIds,
      catalogRawExtraByTwId,
      productPairs
    );
  }, [
    pendingIndividualsTrusted,
    onRequestTwIds,
    catalogRawExtraByTwId,
    productPairs,
  ]);

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

  /** Kandydaci overlap z katalogu (przed reclassify) — stabilne vs on-request. */
  const prosbaOverlapCandidateTwIds = useMemo(() => {
    if (!lines?.length) return [] as number[];
    if (!catalogExtrasBundle.byTwId.size) return [] as number[];
    return collectTwIdsNeedingProsbaReservationOverlap({
      extraTwIds: catalogRawExtraByTwId.keys(),
      lines,
      byTwId: catalogExtrasBundle.byTwId,
    });
  }, [lines, catalogRawExtraByTwId, catalogExtrasBundle.byTwId]);

  const prosbaOverlapCandidateKey = prosbaOverlapCandidateTwIds.join(",");

  if (!prosbaOverlapCandidateTwIds.length && prosbaReservedByTwId != null) {
    setProsbaReservedByTwId(null);
  }

  useEffect(() => {
    if (!prosbaOverlapCandidateTwIds.length) {
      skipProsbaOverlapFetchKeyRef.current = null;
      return;
    }
    if (skipProsbaOverlapFetchKeyRef.current === prosbaOverlapCandidateKey) {
      skipProsbaOverlapFetchKeyRef.current = null;
      return;
    }
    let cancelled = false;
    const twIds = [...prosbaOverlapCandidateTwIds];
    void (async () => {
      const res = await actionFetchZdEstimateProsbaReservationOverlap({ twIds });
      if (cancelled) return;
      if (!res.ok) {
        // Fail-open: pusta mapa = resolve OK bez ZK.
        // Nie null (null = nieznane = pending na zawsze).
        setProsbaReservedByTwId(new Map());
        return;
      }
      // Pusta mapa = resolve OK bez ZK — nie null (null = nieznane).
      setProsbaReservedByTwId(mapProsbaReservedOverlapDto(res.reservedByTwId));
    })();
    return () => {
      cancelled = true;
    };
    // Key stabilizuje listę tw; sam array jest nowy co render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prosbaOverlapCandidateKey
  }, [prosbaOverlapCandidateKey]);

  const kitOnlyBlockedAlertCount = useMemo(() => {
    if (!lines?.length && individualBundle.serviceLines.length === 0) return 0;
    const byTw = new Map((lines ?? []).map((l) => [l.tw_Id, l]));
    const blockedTwIds = new Set<number>();
    for (const l of lines ?? []) {
      if (l.bom?.purchaseBlocked !== true) continue;
      const parents = l.bom.parentTwIds ?? [];
      // Przy „komplet ze składników” popyt idzie na kit — bez alertu „bez ścieżki”.
      if (
        parents.length > 0 &&
        !parents.some(
          (pid) => byTw.get(pid)?.bom?.purchaseTarget === "kit_only"
        )
      ) {
        continue;
      }
      if (zdEstimateLineSalesDemandSignal(l) > 0) blockedTwIds.add(l.tw_Id);
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

  const prosbaDedupeMaps = useMemo(
    () =>
      resolveProsbaReservationDedupeMaps(
        individualBundle.byTwId,
        prosbaReservedByTwId
      ),
    [individualBundle.byTwId, prosbaReservedByTwId]
  );
  const individualExtraByTwId = prosbaDedupeMaps.extraByTwId;
  const stockNeedReliefByTwId = prosbaDedupeMaps.stockNeedReliefByTwId;
  const extraOverlapByTwId = prosbaDedupeMaps.extraOverlapByTwId;

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
      extrasPolicy,
      stockNeedReliefByTwId,
      extraOverlapByTwId,
      minStockByTwIdForRefresh
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
      extrasPolicy,
      catalogRawExtraByTwId,
      stockNeedReliefByTwId,
      extraOverlapByTwId,
      minStockByTwIdForRefresh
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
    catalogRawExtraByTwId,
    stockNeedReliefByTwId,
    extraOverlapByTwId,
    minStockByTwIdForRefresh,
  ]);

  /** Podsumowanie listy „Do ZD” (z nadpisaniami): pozycje, sztuki, wartość z cen ZD. */
  const orderSummary = useMemo(() => {
    let count = 0;
    let pieces = 0;
    let value = 0;
    let unpriced = 0;
    for (const l of orderableLines) {
      const qty = resolveOrderQtyForLine(
        l,
        packagingLookup.get(l.tw_Id) ?? null,
        individualExtraPiecesForTw(l.tw_Id, individualExtraByTwId),
        extraOnlyTwIds.has(l.tw_Id),
        extrasPolicy,
        individualExtraPiecesForTw(l.tw_Id, stockNeedReliefByTwId),
        individualExtraPiecesForTw(l.tw_Id, extraOverlapByTwId),
        individualExtraPiecesForTw(l.tw_Id, minStockByTwIdForRefresh)
      );
      const override = qtyOverrideMap.get(l.tw_Id);
      const units =
        override != null && Number.isFinite(override) ? Math.trunc(override) : qty.zdUnits;
      if (units <= 0) continue;
      count += 1;
      const linePieces = piecesArrivingForZdUnitsFromQty(units, qty);
      pieces += linePieces;
      const price = unitPriceByTwId[l.tw_Id];
      if (price != null && price > 0) value += linePieces * price;
      else unpriced += 1;
    }
    return { count, pieces, value, unpriced };
  }, [
    orderableLines,
    packagingLookup,
    individualExtraByTwId,
    extraOnlyTwIds,
    extrasPolicy,
    stockNeedReliefByTwId,
    extraOverlapByTwId,
    minStockByTwIdForRefresh,
    qtyOverrideMap,
    unitPriceByTwId,
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
    // Ten sam wynik co orderableLines — bez drugiego przebiegu filtra.
    return orderableLines;
  }, [
    lines,
    listFilter,
    orderExcludedTwIds,
    settingsTrusted,
    nameAutoByTwId,
    acceptedReviewTwIds,
    orderableLines,
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
      extrasPolicy,
      stockNeedReliefByTwId,
      extraOverlapByTwId,
      minStockByTwIdForRefresh
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
    stockNeedReliefByTwId,
    extraOverlapByTwId,
    minStockByTwIdForRefresh,
  ]);

  const {
    selected,
    selectAnchorTwIdRef,
    headerCheckboxRef,
    resetSelectionQuiet,
    clearSucceededFromSelection,
    clearBulkOnRequestSelection,
    selectedLines,
    selectedCount,
    selectionToolsOpen,
    selectionBarSelectedCount,
    selectionBarVisibleSelectedCount,
    allVisibleSelected,
    toggleRowSelected,
    selectAllVisible,
    toggleSelectAllVisible,
  } = useZdEstimateSelection({ lines, visibleLines, productPairs });
  /** „Odznacz” z UI — bez skoku viewportu (jak programmatic clear). */
  const clearSelection = resetSelectionQuiet;

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
        extrasPolicy,
        stockNeedReliefByTwId,
        extraOverlapByTwId,
        minStockByTwIdForRefresh
      ),
    [
      orderableLines,
      packagingLookup,
      individualExtraByTwId,
      qtyOverrideMap,
      extraOnlyTwIds,
      extrasPolicy,
      stockNeedReliefByTwId,
      extraOverlapByTwId,
      minStockByTwIdForRefresh,
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

  const createZdGate = useZdEstimateCreateZdGate({
    configured: bootstrap.configured,
    settingsTrusted,
    orderableCount: createZdPreview.lineCount,
    supplierId,
    khResolution: createKhResolution,
    estimating: estimating || rematting,
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
    prosbaOverlapPending:
      prosbaOverlapCandidateTwIds.length > 0 &&
      prosbaReservedByTwId === null,
  });

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
        minStock,
        productPairs,
        productBoms,
        teethTwIds,
        boostPreset,
        appliedBoostPreset,
        leadTimeHorizon,
        horizon: policzScopeInfo?.horizon ?? null,
        salesSmoothingEnabled: salesSmoothing,
        salesSmoothing: policzScopeInfo?.salesSmoothing ?? null,
        unitPriceByTwId,
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
      minStock,
      productPairs,
      productBoms,
      teethTwIds,
      appliedBoostPreset,
      leadTimeHorizon,
      salesSmoothing,
      policzScopeInfo,
      unitPriceByTwId,
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
            console.warn(
              "Sesja UI kreatora: usuwam recreate — ID już nieaktualne.",
              created.sessionId
            );
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

  useEffect(() => {
    flushExternalSessionPersistRef.current = flushExternalSessionPersist;
    scheduleExternalSessionPersistRef.current = scheduleExternalSessionPersist;
  });

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
    [hasActiveExternalSessionWork, setExternalSessionScopeChangeOpen]
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
      setSupplierFromMappingNotice(
        payload.scopeMode === "cecha"
          ? mappingNoticeForSelection({
              matchSource: payload.selectedCecha?.supplierMatchSource,
              supplierName: payload.selectedCecha?.supplierName,
              scopeLabel: payload.selectedCecha?.ctw_Nazwa ?? "",
            })
          : mappingNoticeForSelection({
              matchSource: payload.selectedGroup?.supplierMatchSource,
              supplierName: payload.selectedGroup?.supplierName,
              scopeLabel: payload.selectedGroup?.grt_Nazwa ?? "",
            })
      );
      setDniZapasu(String(payload.dniZapasu ?? ""));
      setDataOd(payload.dataOd);
      setDataDo(payload.dataDo);
      setZapasMin(String(payload.zapasMin ?? ""));
      setShowAdvanced(Boolean(payload.showAdvanced));
      setSalesWindowSource(payload.salesWindowSource ?? "stock");

      setLinesBase(coerceZdEstimateLinesBase(payload.linesBase ?? []));
      setLines(payload.lines);
      setHistoryByTwId(historyMapFromEntries(payload.historyByTwId));
      setHistoryFetchFailed(Boolean(payload.historyFetchFailed));
      // Z sesji: tylko horyzont (zakresy / podpowiedzi ZD wrócą przy kolejnym Policz).
      setPoliczScopeInfo(
        payload.horizon || payload.salesSmoothing
          ? {
              scopesIncluded: [],
              assignedElsewhere: [],
              otherSupplierHintByTwId: {},
              horizon: payload.horizon ?? null,
              salesSmoothing: payload.salesSmoothingEnabled ? payload.salesSmoothing ?? null : null,
            }
          : null
      );

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
      {
        const computedAt = Date.parse(payload.createdAt ?? "");
        setListComputedAtMs(Number.isFinite(computedAt) && computedAt > 0 ? computedAt : null);
      }

      // Opcja czasu dostawy z sesji — lista była liczona z tym horyzontem.
      setLeadTimeHorizon(Boolean(payload.leadTimeHorizon));
      setSalesSmoothing(Boolean(payload.salesSmoothingEnabled));
      setUnitPriceByTwId(payload.unitPriceByTwId ?? {});
      setHorizonNeedsRecount(false);

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
      resetCreateZdFlow();
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
    [
      columnOrder,
      columns,
      resetSelectionQuiet,
      resetCreateZdFlow,
      setListComputedAtMs,
      setExclusions,
      setExclusionsError,
      setOnRequests,
      setOnRequestsError,
      setPackaging,
      setPackagingError,
      setProductBoms,
      setProductBomsError,
      setProductPairs,
      setProductPairsError,
      setTeethProductsError,
      setTeethTwIds,
    ]
  );

  const restoreExternalSession = useCallback(
    async (token: NonNullable<ReturnType<typeof peekZdEstimateExternalSessionToken>>) => {
      sessionResumeStartedAtMsRef.current = Date.now();
      setSessionResumeStartedAtMs(sessionResumeStartedAtMsRef.current);
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
    resetCreateZdFlow();
    selectAnchorTwIdRef.current = null;
    setCopyOk(false);
    setLaunchReadyMessage(null);
    setRecountStatusMessage(null);
    // Brak listy → dirty boosta / historii nieaktualne; applied = aktualne radio.
    setBoostNeedsRecount(false);
    setHistoryNeedsRecount(false);
    setHistoryFetchFailed(false);
    setPoliczScopeInfo(null);
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
      setSupplierFromMappingNotice(null);
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
      // Nie czyść groupHits — 1 wynik wyszukiwania musi zostać z gwiazdką (plan ulubionych).
      setFeedback(null);
      setErrorMessage(null);

      if (affectsScope) {
        clearEstimateResult({ fromScopeChange: lines != null });
      } else setCopyOk(false);

      setSupplierId(applied.supplierId);
      setDniZapasu(String(applied.dniZapasu));
      setSupplierFromMappingNotice(
        mappingNoticeForSelection({
          matchSource: applied.matchSource,
          supplierName: applied.supplierName,
          scopeLabel: group.grt_Nazwa,
        })
      );
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
      // Nie czyść cechaHits — 1 wynik wyszukiwania musi zostać z gwiazdką.
      setFeedback(null);
      setErrorMessage(null);

      if (affectsScope) {
        clearEstimateResult({ fromScopeChange: lines != null });
      } else setCopyOk(false);

      setSupplierId(applied.supplierId);
      setDniZapasu(String(applied.dniZapasu));
      setSupplierFromMappingNotice(
        mappingNoticeForSelection({
          matchSource: applied.matchSource,
          supplierName: applied.supplierName,
          scopeLabel: cecha.ctw_Nazwa,
        })
      );
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

  const handleSupplierScopesChange = useCallback(
    (
      scopes: ZdEstimateSupplierScopeRow[],
      meta: { reason: "load" | "mutate" }
    ) => {
      setTodayCoverage(
        zdEstimateScopeCoverage(
          collectTodayScheduleSuppliers({
            todayKey: bootstrap.todayKey,
            suppliers: bootstrap.suppliers,
          }),
          scopes.map((s) => s.supplierId)
        )
      );
      if (meta.reason !== "mutate") return;

      setGroupHits([]);
      setCechaHits([]);

      if (scopeMode === "grupa" && selectedGroup) {
        const next = applyScopeSupplierFields(
          selectedGroup,
          resolveSupplierForScopeSelection({
            scopeName: selectedGroup.grt_Nazwa,
            suppliers: bootstrap.suppliers,
            ...(() => {
              const m = resolveZdScopeSupplierMapping(scopes, "grupa", selectedGroup.grt_Id, supplierId);
              return { mappedSupplierId: m.mappedSupplierId, nameMatchSupplierIds: m.candidateSupplierIds };
            })(),
          })
        );
        setSelectedGroup(next);
        const applied = resolveWindowForGroup(
          next,
          bootstrap.suppliers,
          bootstrap.salesEndKey
        );
        if (applied.supplierId !== supplierId) {
          clearEstimateResult({ fromScopeChange: lines != null });
        }
        setSupplierId(applied.supplierId);
        setDniZapasu(String(applied.dniZapasu));
        setSupplierFromMappingNotice(
          mappingNoticeForSelection({
            matchSource: applied.matchSource,
            supplierName: applied.supplierName,
            scopeLabel: next.grt_Nazwa,
          })
        );
        if (shouldApplyStockSalesWindow(salesWindowSource)) {
          setDataOd(applied.dataOd);
          setDataDo(applied.dataDo);
        }
        return;
      }

      if (scopeMode === "cecha" && selectedCecha) {
        const next = applyScopeSupplierFields(
          selectedCecha,
          resolveSupplierForScopeSelection({
            scopeName: selectedCecha.ctw_Nazwa,
            suppliers: bootstrap.suppliers,
            ...(() => {
              const m = resolveZdScopeSupplierMapping(scopes, "cecha", selectedCecha.ctw_Id, supplierId);
              return { mappedSupplierId: m.mappedSupplierId, nameMatchSupplierIds: m.candidateSupplierIds };
            })(),
          })
        );
        setSelectedCecha(next);
        const applied = resolveWindowForCecha(
          next,
          bootstrap.suppliers,
          bootstrap.salesEndKey
        );
        if (applied.supplierId !== supplierId) {
          clearEstimateResult({ fromScopeChange: lines != null });
        }
        setSupplierId(applied.supplierId);
        setDniZapasu(String(applied.dniZapasu));
        setSupplierFromMappingNotice(
          mappingNoticeForSelection({
            matchSource: applied.matchSource,
            supplierName: applied.supplierName,
            scopeLabel: next.ctw_Nazwa,
          })
        );
        if (shouldApplyStockSalesWindow(salesWindowSource)) {
          setDataOd(applied.dataOd);
          setDataDo(applied.dataDo);
        }
      }
    },
    // clearEstimateResult jest stabilne (tylko stabilne settery) — pomijane w deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      bootstrap.salesEndKey,
      bootstrap.suppliers,
      bootstrap.todayKey,
      lines,
      salesWindowSource,
      scopeMode,
      selectedCecha,
      selectedGroup,
      supplierId,
    ]
  );

  const onSupplierOverride = (id: string) => {
    if (id === (supplierId ?? "")) return;

    const affectsScope = lines != null;

    const applyChange = () => {
      setSupplierFromMappingNotice(null);
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

  const quickGroupsLive = useMemo(
    () => resolveZdEstimateFavoriteGroupChips(favoriteGroups, groupEnrichById),
    [favoriteGroups, groupEnrichById]
  );
  const quickCechyLive = useMemo(
    () => resolveZdEstimateFavoriteCechaChips(favoriteCechy, cechaEnrichById),
    [favoriteCechy, cechaEnrichById]
  );

  const rememberGroupEnrich = useCallback((group: ZdEstimateGroupOption) => {
    setGroupEnrichById((prev) => {
      const next = new Map(prev);
      next.set(group.grt_Id, group);
      return next;
    });
    const label = group.grt_Nazwa.trim();
    if (!label) return;
    setFavoriteGroups((prev) => {
      const i = prev.findIndex((f) => f.id === group.grt_Id);
      if (i < 0 || prev[i]!.label === label) return prev;
      const next = [...prev];
      next[i] = { id: group.grt_Id, label };
      return next;
    });
  }, []);

  const rememberCechaEnrich = useCallback((cecha: ZdEstimateCechaOption) => {
    setCechaEnrichById((prev) => {
      const next = new Map(prev);
      next.set(cecha.ctw_Id, cecha);
      return next;
    });
    const label = cecha.ctw_Nazwa.trim();
    if (!label) return;
    setFavoriteCechy((prev) => {
      const i = prev.findIndex((f) => f.id === cecha.ctw_Id);
      if (i < 0 || prev[i]!.label === label) return prev;
      const next = [...prev];
      next[i] = { id: cecha.ctw_Id, label };
      return next;
    });
  }, []);

  const toggleGroupFavorite = useCallback(
    (group: ZdEstimateGroupOption) => {
      rememberGroupEnrich(group);
      setFavoriteGroups((prev) => {
        const res = toggleZdEstimateFavorite(prev, {
          id: group.grt_Id,
          label: group.grt_Nazwa,
        });
        if (!res.ok) {
          flashSettingsLive(ZD_ESTIMATE_UI.prepFavoriteCapFlash);
          return prev;
        }
        return res.next;
      });
    },
    [flashSettingsLive, rememberGroupEnrich]
  );

  const toggleCechaFavorite = useCallback(
    (cecha: ZdEstimateCechaOption) => {
      rememberCechaEnrich(cecha);
      setFavoriteCechy((prev) => {
        const res = toggleZdEstimateFavorite(prev, {
          id: cecha.ctw_Id,
          label: cecha.ctw_Nazwa,
        });
        if (!res.ok) {
          flashSettingsLive(ZD_ESTIMATE_UI.prepFavoriteCapFlash);
          return prev;
        }
        return res.next;
      });
    },
    [flashSettingsLive, rememberCechaEnrich]
  );

  const isGroupFavoriteCb = useCallback(
    (grtId: number) => isZdEstimateFavorite(favoriteGroups, grtId),
    [favoriteGroups]
  );
  const isCechaFavoriteCb = useCallback(
    (ctwId: number) => isZdEstimateFavorite(favoriteCechy, ctwId),
    [favoriteCechy]
  );

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
      if (res.groups.length > 0) {
        setGroupEnrichById((prev) => {
          const next = new Map(prev);
          for (const g of res.groups) next.set(g.grt_Id, g);
          return next;
        });
      }
      if (res.groups.length === 1) {
        selectGroup(res.groups[0]!);
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
      if (res.cechy.length > 0) {
        setCechaEnrichById((prev) => {
          const next = new Map(prev);
          for (const c of res.cechy) next.set(c.ctw_Id, c);
          return next;
        });
      }
      if (res.cechy.length === 1) {
        selectCecha(res.cechy[0]!);
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
    /** Przełączenie opcji czasu dostawy z komunikatu (stan jeszcze nieustawiony). */
    leadTimeHorizon?: boolean;
    salesSmoothing?: boolean;
  }) => {
    const useLeadTimeHorizon = opts?.leadTimeHorizon ?? leadTimeHorizon;
    const useSalesSmoothing = opts?.salesSmoothing ?? salesSmoothing;
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
    // Trzymaj UI scope w sync z faktycznym Policz (autorun / override opts).
    if (mode !== scopeMode) setScopeMode(mode);
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
    const progressId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
            const n = Math.floor(Math.random() * 16);
            const v = ch === "x" ? n : (n & 0x3) | 0x8;
            return v.toString(16);
          });
    startRunProgressPoll(progressId, estimateGen);
    const scopeLabelForRun =
      mode === "cecha"
        ? selectedCecha?.ctw_Nazwa ?? (cechaQuery.trim() || null)
        : selectedGroup?.grt_Nazwa ?? (groupQuery.trim() || null);
    startEstimate(async () => {
      try {
      const res = await actionRunZdEstimateManual({
        mode,
        ...(mode === "grupa" ? { grupaId } : { cechaId }),
        scopeLabel: scopeLabelForRun,
        supplierId: supplierId ?? null,
        dniZapasu: Number(dniZapasu),
        dataOd,
        dataDo,
        zapasMin: Number(zapasMin) || 0,
        progressId,
        leadTimeHorizon: useLeadTimeHorizon,
        salesSmoothing: useSalesSmoothing,
        uiSessionSeed: {
          selectedGroup: mode === "grupa" ? selectedGroup : null,
          selectedCecha: mode === "cecha" ? selectedCecha : null,
          groupQuery,
          cechaQuery,
          showAdvanced,
          salesWindowSource,
          sortKey,
          sortDir,
          columns,
          columnOrder,
        },
      });
      if (estimateGen !== estimateGenRef.current) {
        // Serwer mógł już skasować poprzednią active i/lub utworzyć nową —
        // nie zostawiaj orphan DB ani tokenu wskazującego na skasowaną sesję.
        if (res.ok && res.uiSessionRotated) {
          externalSessionIdRef.current = null;
          externalSessionCreatedAtRef.current = null;
          clearZdEstimateExternalSessionToken();
          syncExternalSessionTokenState();
        }
        if (
          res.ok &&
          typeof res.uiSessionId === "string" &&
          res.uiSessionId.trim()
        ) {
          console.warn(
            "Sesja UI kreatora: usuwam sesję serwerową — Policz unieważniony przed apply (estimateGen).",
            res.uiSessionId
          );
          void deleteZdEstimateExternalSessionRecord(res.uiSessionId.trim());
        }
        return;
      }
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
        autorunReplaceMetaRef.current = null;
        setScopeNeedsRecount(false);
        setBoostNeedsRecount(false);
        setHistoryNeedsRecount(false);
        setHistoryFetchFailed(false);
        setPoliczScopeInfo(null);
        setPendingIndividualsLoading(false);
        setAppliedBoostPreset(boostPreset);
        setAppliedBoostPolicy(policyForBoostPreset(boostPreset));
        setRecountStatusMessage(null);
        // Lista nieważna — zdejmij handoff/lock z poprzedniej sesji (jak przy clearEstimateResult).
        resetCreateZdFlow();
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
        setLinesBase(
          coerceZdEstimateLinesBase(
            res.result.pozycjeBase ?? res.result.pozycje
          )
        );
        setLines(res.result.pozycje);
        setPoliczScopeInfo({
          scopesIncluded: res.scopesIncluded ?? [],
          assignedElsewhere: res.assignedElsewhere ?? [],
          otherSupplierHintByTwId: res.otherSupplierHintByTwId ?? {},
          horizon: res.horizon ?? null,
          salesSmoothing: res.salesSmoothingEnabled ? res.salesSmoothing ?? null : null,
        });
        setUnitPriceByTwId(res.unitPriceByTwId ?? {});
        setHorizonNeedsRecount(false);
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
        resetCreateZdFlow();
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
        {
          const resolved = res.prosbaOverlapResolved === true;
          setProsbaReservedByTwId(
            resolved
              ? mapProsbaReservedOverlapDto(res.prosbaReservedByTwId)
              : new Map()
          );
          skipProsbaOverlapFetchKeyRef.current = resolved
            ? (res.prosbaOverlapCandidateTwIds ?? []).join(",")
            : null;
        }
        resetSelectionQuiet();
        setListSearch("");
        setParamInfo(res.result.parametry as Record<string, unknown>);
        setListComputedAtMs(Date.now());
        setMeta({
          pagesFetched: res.meta.pagesFetched,
          totalCountApi: res.meta.totalCountApi,
          truncated: res.meta.truncated,
          ordersBaseUrl: res.meta.ordersBaseUrl,
          durationMs: res.meta.durationMs,
          totalFromSubiekt: res.meta.totalFromSubiekt,
        });
        setListFilter("order");
        setExclusions(res.exclusions ?? []);
        setExclusionsError(null);
        setPackaging(res.packaging ?? []);
        setPackagingError(null);
        setOnRequests(res.onRequests ?? []);
        setOnRequestsError(null);
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
          const closed = autorunReplaceMetaRef.current;
          autorunReplaceMetaRef.current = null;
          setLaunchReadyMessage(
            zdEstimateLaunchReadyToastDescription({
              doZamowieniaCount: res.meta.doZamowieniaCount,
              pendingIndividualsCount: res.pendingIndividuals?.length ?? 0,
              isLive: bootstrap.ordersIsLive,
              closedPreviousSession: Boolean(closed),
              previousSessionSupplierChanged: closed?.supplierChanged,
              nextSupplierName: closed?.nextSupplierName ?? null,
            })
          );
          setLaunchForceComplete(false);
          setLaunchBlocking(false);
          setRecountStatusMessage(null);
        } else {
          const closed = autorunReplaceMetaRef.current;
          autorunReplaceMetaRef.current = null;
          const recount = zdEstimateRecountListStatus({
            doZamowieniaCount: res.meta.doZamowieniaCount,
            durationMs: res.meta.durationMs,
          });
          setRecountStatusMessage(
            closed
              ? `${zdEstimateRecountClosedPreviousSessionPrefix({
                  supplierChanged: closed.supplierChanged,
                  nextSupplierName: closed.nextSupplierName,
                })}${recount}`
              : recount
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

      // Po sukcesie „Policz”: sesja UI. Preferuj zapis z serwera (ten sam request co Policz) —
      // duże cechy (Ivoclar) nie muszą ponownie uploadować ~tysięcy linii.
      try {
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

        const tokenScopeMode = mode as "grupa" | "cecha";
        const tokenGrupaId =
          tokenScopeMode === "grupa" &&
          typeof grupaId === "number" &&
          grupaId > 0
            ? grupaId
            : null;
        const tokenCechaId =
          tokenScopeMode === "cecha" &&
          typeof cechaId === "number" &&
          cechaId > 0
            ? cechaId
            : null;

        let sessionId: string | null =
          typeof res.uiSessionId === "string" && res.uiSessionId.trim()
            ? res.uiSessionId.trim()
            : null;
        let createdAt: string | null =
          typeof res.uiSessionCreatedAt === "string" &&
          res.uiSessionCreatedAt.trim()
            ? res.uiSessionCreatedAt.trim()
            : null;

        if (!sessionId) {
          const pendingIndividualsOk = res.pendingIndividuals != null;
          const fallbackGroup =
            tokenScopeMode === "grupa"
              ? (selectedGroup ??
                (tokenGrupaId != null && tokenGrupaId > 0
                  ? {
                      grt_Id: tokenGrupaId,
                      grt_Nazwa:
                        scopeLabelForRun || `Grupa ${tokenGrupaId}`,
                      supplierId,
                      supplierName: null,
                      dniZapasu: null,
                      stockLabel: null,
                      subiektKhId: null,
                      additionalSubiektKhIds: [],
                      supplierMatchSource: null,
                      supplierMappingUnresolved: false,
                    }
                  : null))
              : null;
          const fallbackCecha =
            tokenScopeMode === "cecha"
              ? (selectedCecha ??
                (tokenCechaId != null && tokenCechaId > 0
                  ? {
                      ctw_Id: tokenCechaId,
                      ctw_Nazwa:
                        scopeLabelForRun || `Cecha ${tokenCechaId}`,
                      supplierId,
                      supplierName: null,
                      dniZapasu: null,
                      stockLabel: null,
                      subiektKhId: null,
                      additionalSubiektKhIds: [],
                      supplierMatchSource: null,
                      supplierMappingUnresolved: false,
                    }
                  : null))
              : null;
          const snapshotPayload = buildZdEstimateUiSessionSnapshot({
            linesBase: coerceZdEstimateLinesBase(
              res.result.pozycjeBase ?? res.result.pozycje
            ),
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
            exclusions: res.exclusions ?? [],
            onRequests: res.onRequests ?? [],
            packaging: res.packaging ?? [],
            minStock: res.minStock ?? [],
            productPairs: res.productPairs ?? [],
            productBoms: res.productBoms ?? [],
            teethTwIds: res.teethTwIds ?? [],
            boostPreset: res.boostPreset ?? boostPreset,
            appliedBoostPreset: res.boostPreset ?? appliedBoostPreset,
            boostNeedsRecount: false,
            scopeMode: tokenScopeMode,
            selectedGroup: fallbackGroup,
            selectedCecha: fallbackCecha,
            groupQuery:
              tokenScopeMode === "grupa"
                ? groupQuery || fallbackGroup?.grt_Nazwa || ""
                : groupQuery,
            cechaQuery:
              tokenScopeMode === "cecha"
                ? cechaQuery || fallbackCecha?.ctw_Nazwa || ""
                : cechaQuery,
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

          const persist = await actionCreateZdEstimateUiSession({
            payload: snapshotPayload,
            schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
          });

          if (estimateGen !== estimateGenRef.current) {
            if (persist.ok) {
              console.warn(
                "Sesja UI kreatora: usuwam świeżo utworzoną sesję — Policz unieważniony (estimateGen).",
                persist.sessionId
              );
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

          sessionId = persist.sessionId;
          createdAt = snapshotPayload.createdAt;
        } else if (estimateGen !== estimateGenRef.current) {
          console.warn(
            "Sesja UI kreatora: usuwam świeżo utworzoną sesję serwerową — Policz unieważniony (estimateGen).",
            sessionId
          );
          void deleteZdEstimateExternalSessionRecord(sessionId);
          return;
        }

        externalSessionIdRef.current = sessionId;
        externalSessionCreatedAtRef.current =
          createdAt ?? new Date().toISOString();
        externalSessionPersistSkipRef.current = false;
        externalSessionPersistQueuedRef.current = false;
        setExternalSessionPersistFailedAlert(false);
        setExternalSessionRestoredToast(null);
        externalSessionRestoredRef.current = false;

        const token = createZdEstimateExternalSessionToken({
          sessionId,
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
          supplierId,
          scopeMode: tokenScopeMode,
          grupaId: tokenGrupaId,
          cechaId: tokenCechaId,
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
      } finally {
        if (estimateGen === estimateGenRef.current) {
          stopRunProgressPoll();
        }
      }
    });
  };

  useEffect(() => {
    runEstimateRef.current = runEstimate;
  });

  // Sesja zewnętrzna: restore, auto-replace (daily Przygotuj ZD) albo konflikt z autorun.
  useLayoutEffect(() => {
    // Token w localStorage → stan React (zewnętrzne źródło); setState w layoucie przed paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tokenu sesji UI
    syncExternalSessionTokenState();

    const token = peekZdEstimateExternalSessionToken();
    const decision = decideZdEstimateAutorunVsExternalSession({
      hasActiveToken: Boolean(token),
      tokenSupplierId: token?.supplierId,
      fromDaily: Boolean(launch?.fromDaily),
      autorun: Boolean(launch?.autorun),
      needsAssign: Boolean(launch?.needsAssign),
      supplierId: launch?.supplierId,
      hasRunnableScope: launchHasRunnableScope(launch),
      hasLaunchKey: Boolean(launch?.launchKey),
      bootstrapConfigured: bootstrap.configured,
    });

    if (decision.action === "replace_and_autorun" && token && launch?.launchKey) {
      externalSessionAutorunBlockedRef.current = true;
      externalSessionAutorunPendingRef.current = {
        mode: launch.mode!,
        grupaId: launch.grupaId ?? undefined,
        cechaId: launch.cechaId ?? undefined,
        launchKey: launch.launchKey,
      };
      autorunReplaceMetaRef.current = {
        supplierChanged: decision.supplierChanged,
        nextSupplierName: launch?.supplierName ?? null,
      };
      autorunReplaceSessionIdRef.current = token.sessionId;
      setSessionResumeBlocking(false);
      setSessionRestorePending(false);
      setSessionResumeReturningFromAway(false);
      setExternalSessionAutorunReplacePending(true);
      return;
    }

    if (decision.action === "conflict_dialog" && launch?.launchKey) {
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

  // Daily „Przygotuj ZD”: zamknij poprzednią sesję (token + DB), potem odblokuj
  // zwykły autorun (claim/markDone) — bez runPending, żeby Strict Mode remount
  // mógł ponowić Policz gdy ten effect zostanie anulowany po clear tokena.
  useEffect(() => {
    if (!externalSessionAutorunReplacePending) return;
    let cancelled = false;
    const sessionId = autorunReplaceSessionIdRef.current;
    void (async () => {
      await endExternalSession({ sessionId });
      if (cancelled) {
        // Token już skasowany; nie markDone — remount wejdzie w zwykły autorun.
        return;
      }
      // Meta zostaje do toastu „Lista gotowa” — nie kasuj tu (unikaj 2 nakładających się toastów).
      autorunReplaceSessionIdRef.current = null;
      // Odblokuj autorun effect (claim + Policz), nie odpalaj estimate tutaj.
      externalSessionAutorunPendingRef.current = null;
      externalSessionAutorunBlockedRef.current = false;
      setExternalSessionAutorunReplacePending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [externalSessionAutorunReplacePending, endExternalSession]);

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
    if (externalSessionAutorunReplacePending) return;
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
  }, [
    launch,
    bootstrap.configured,
    settingsTrusted,
    externalSessionAutorunReplacePending,
  ]);

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
    minStock,
    productPairs,
    productBoms,
    teethTwIds,
    boostPreset,
    appliedBoostPreset,
    leadTimeHorizon,
    salesSmoothing,
    policzScopeInfo,
    unitPriceByTwId,
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
      externalSessionAutorunReplacePending ||
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
      !externalSessionAutorunConflictOpen &&
      !externalSessionAutorunReplacePending
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
  const servicesOnlyBlockerVisible =
    individualBundle.serviceLines.length > 0 && orderableLines.length === 0;

  /**
   * Caption sticky — bez `estimating` (info jest na blurze listy). Pokazywany także przy
   * blokadach z komunikatem: komunikaty siedzą w zwiniętym pasku „Uwagi”, więc bez tego
   * wyłączony „Utwórz ZD” nie mówiłby dlaczego.
   */
  const stickyCreateGateCaption =
    !createZdGate.ok && !servicesOnlyBlockerVisible && !estimating
      ? createZdGate
      : null;
  /** Blokada usuwana przeliczeniem — przycisk „Przelicz” od razu przy powodzie w pasku akcji. */
  const stickyCreateGateRecount =
    Boolean(lines) && (boostNeedsRecount || historyNeedsRecount || historyFetchFailed);

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

  /** Pozycje na ZD z ręcznie zmienioną ilością (podsumowanie w oknie tworzenia). */
  const manualOverrideOrderableCount = useMemo(
    () => orderableLines.filter((l) => qtyOverrideByTwId[l.tw_Id] != null).length,
    [orderableLines, qtyOverrideByTwId]
  );

  /** Pozycje „Do ZD” ukryte filtrem listy albo wyszukiwaniem — trafią na ZD, choć ich nie widać. */
  const hiddenOrderableCount = useMemo(() => {
    if (!orderableLines.length) return 0;
    const visibleIds = new Set(visibleLines.map((l) => l.tw_Id));
    return orderableLines.filter((l) => !visibleIds.has(l.tw_Id)).length;
  }, [orderableLines, visibleLines]);

  const tableOptionalColumns = visibleOptionalColumns;
  const tableColumnSectionStarts = useMemo(
    () => resolveZdEstimateColumnSectionStarts(tableOptionalColumns),
    [tableOptionalColumns]
  );
  const tableColSpan = useMemo(
    () =>
      countZdEstimateTableColumns({
        showPackagingColumn,
        visibleOptionalColumns: tableOptionalColumns,
      }),
    [showPackagingColumn, tableOptionalColumns]
  );

  const tableVirtualLayoutKey = `${visibleLines.length}\0${listFilter}\0${listSearch}\0${sortKey}\0${sortDir}\0${tableColSpan}\0${showPackagingColumn}`;
  const tableVirtual = useZdEstimateTableVirtualizer({
    rowCount: visibleLines.length,
    layoutKey: tableVirtualLayoutKey,
  });
  const tableVirtualScrollToIndexRef = useRef(tableVirtual.scrollToIndex);
  useEffect(() => {
    tableVirtualScrollToIndexRef.current = tableVirtual.scrollToIndex;
  });

  useEffect(() => {
    if (!tableVirtual.enabled) {
      registerZdEstimateVirtualScrollToTwId(null);
      return;
    }
    registerZdEstimateVirtualScrollToTwId((twId) => {
      const index = visibleLines.findIndex((row) => row.tw_Id === twId);
      if (index < 0) return false;
      tableVirtualScrollToIndexRef.current?.(index, { align: "auto" });
      return true;
    });
    return () => registerZdEstimateVirtualScrollToTwId(null);
  }, [tableVirtual.enabled, visibleLines]);

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
    let mql: MediaQueryList | null = null;
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
    const onViewportMode = () => runAll();
    // Tabela potrafi zamontować się później niż ten efekt (wznowienie sesji, panel postępu) —
    // obserwatory podpinamy przy każdym przebiegu, bez dublowania. Obserwujemy też nagłówek
    // Nazwy: jego szerokość wyznacza sticky left Opak. / Do ZD (nieaktualna = kolumny nachodzą).
    const observed = new WeakSet<Element>();
    const attachObservers = () => {
      if (!ro) return;
      const nodes = [
        document.getElementById(ZD_ESTIMATE_TABLE_SCROLL_ID),
        document.querySelector("table.data-table.zd-estimate-table"),
        document.querySelector("table.data-table.zd-estimate-table thead th.zd-estimate-product-name-col"),
      ];
      for (const node of nodes) {
        if (node && !observed.has(node)) {
          observed.add(node);
          ro.observe(node);
        }
      }
    };
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        attachObservers();
        runTableOnly();
      });
    }
    const runAndAttach = () => {
      attachObservers();
      runAll();
    };
    const t0 = window.setTimeout(runAndAttach, 0);
    const t1 = window.setTimeout(runAndAttach, 120);
    const t2 = window.setTimeout(runAndAttach, 320);
    window.addEventListener("resize", onViewportMode);
    // Przejście desktop ↔ compact sticky — natychmiastowy re-sync offsetów.
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("(max-width: 767px)");
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onViewportMode);
      } else {
        mql.addListener(onViewportMode);
      }
    }
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onViewportMode);
      if (mql) {
        if (typeof mql.removeEventListener === "function") {
          mql.removeEventListener("change", onViewportMode);
        } else {
          mql.removeListener(onViewportMode);
        }
      }
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

  const stickyToastTallDock = Boolean(
    stickyCreateGateCaption || selectedCount > 0
  );
  const stickyToastStack = zdEstimateStickyToastStackIndices({
    launchReady: Boolean(launchReadyMessage),
    sessionRestored: Boolean(externalSessionRestoredToast),
    recount: Boolean(recountStatusMessage),
    settingsLive: Boolean(settingsLiveMessage),
  });

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
    orderMultiple: number | null;
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
        orderMultiple: input.orderMultiple,
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
      const [ex, onReq, pack, minSt, pairs, boms, teeth] = await Promise.all([
        actionListZdEstimateExclusions(),
        actionListZdEstimateOnRequests(),
        actionListZdEstimatePackaging(),
        actionListZdEstimateMinStock(),
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
      if (minSt.ok) applyMinStockLive(minSt.minStock);
      else setMinStockError(userFacingErrorTextFromMessage(minSt.message));
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

  const retryLoadMinStock = useCallback(async () => {
    setMinStockError(null);
    try {
      const res = await actionListZdEstimateMinStock();
      if (!res.ok) {
        setMinStockError(res.message);
        return;
      }
      setMinStock(res.minStock);
    } catch (e) {
      setMinStockError(
        e instanceof Error ? e.message : "Nie udało się wczytać minimum stanów."
      );
    }
  }, [setMinStock, setMinStockError]);

  const openMinStockPanel = () => {
    setMinStockOpen(true);
    retryLoadMinStock();
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
    orderMultiple: number | null;
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
          orderMultiple: input.orderMultiple,
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

  const saveMinStock = (value: number, note: string) => {
    const line = minStockCandidate;
    if (!line) return;
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionUpsertZdEstimateMinStock({
          subiektTwId: line.tw_Id,
          twSymbol: line.tw_Symbol,
          twNazwa: line.tw_Nazwa,
          grtId: selectedGroup?.grt_Id ?? line.tw_IdGrupa,
          grtNazwa: selectedGroup?.grt_Nazwa ?? line.grt_Nazwa,
          minStockSzt: value,
          note,
        });
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyMinStockLive(res.minStock);
        setMinStockCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  const clearMinStock = () => {
    const line = minStockCandidate;
    if (!line) return;
    setMutatingTwId(line.tw_Id);
    startMutate(async () => {
      try {
        const res = await actionDeleteZdEstimateMinStock(line.tw_Id);
        if (!res.ok) {
          reportError(res.message);
          return;
        }
        applyMinStockLive(res.minStock);
        setMinStockCandidate(null);
      } finally {
        setMutatingTwId(null);
      }
    });
  };

  // Stabilne handlery wierszy — `ZdEstimateTableRow` (memo) nie renderuje się przy niezwiązanych zmianach.
  const handleRowToggleSelected = useStableCallback(toggleRowSelected);
  const handleRowRestore = useStableCallback(restoreLine);
  const handleRowMarkOnRequest = useStableCallback(markOnRequestLine);
  const handleRowClearOnRequest = useStableCallback(clearOnRequestLine);
  const handleRowSessionInclude = useStableCallback(setSessionIncludeTwId);
  const handleRowOverrideChange = useCallback(
    (twId: number, next: number | null, computedZdUnits: number) => {
      setQtyOverrideByTwId((prev) => {
        const copy = { ...prev };
        if (next == null || Math.trunc(next) === computedZdUnits) {
          delete copy[twId];
        } else {
          copy[twId] = Math.trunc(next);
        }
        return copy;
      });
    },
    []
  );
  const handleRowAcceptReview = useCallback((twId: number) => {
    setAcceptedReviewTwIds((prev) => ({
      ...prev,
      [twId]: true,
    }));
  }, []);

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
          extrasPolicy,
          stockNeedReliefByTwId,
          extraOverlapByTwId,
          minStockByTwIdForRefresh
        )
      );
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      reportError("Nie udało się skopiować do schowka.");
    }
  };

  return (
    <ZdEstimateNoticeTrayProvider>
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
          runProgress={runProgressSnapshot}
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
            key={sessionResumeStartedAtMs}
            startedAtMs={sessionResumeStartedAtMs}
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
              density={prepFormOpen && scopeSelected ? "short" : "full"}
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
                  disabled={busy}
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
                      disabled={busy}
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
              disabled={busy}
              compact
              triggerClassName={zdEstimateToolbarMenuClass}
            />
            <ZdEstimateDepartmentSettingsMenu
              exclusionsCount={exclusions.length}
              onRequestsCount={onRequests.length}
              packagingCount={packaging.length}
              minStockCount={minStock.length}
              pairsCount={productPairs.length}
              bomsCount={productBoms.length}
              onOpenExclusions={openExclusionsPanel}
              onOpenOnRequest={openOnRequestPanel}
              onOpenPackaging={openPackagingPanel}
              onOpenMinStock={openMinStockPanel}
              onOpenPairs={openPairsPanel}
              onOpenBoms={openBomsPanel}
              disabled={busy}
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
          className={zdEstimateStickyToastClass({
            stackIndex: stickyToastStack.launchReady ?? 0,
            tallDock: stickyToastTallDock,
          })}
        />
      ) : null}

      {externalSessionRestoredToast ? (
        <Toast
          tone="success"
          title={zdEstimateExternalSessionRestoredToastTitle}
          description={externalSessionRestoredToast}
          durationMs={8000}
          onDismiss={() => setExternalSessionRestoredToast(null)}
          className={zdEstimateStickyToastClass({
            stackIndex: stickyToastStack.sessionRestored ?? 0,
            tallDock: stickyToastTallDock,
          })}
        />
      ) : null}

      {recountStatusMessage ? (
        <Toast
          key={`recount:${recountStatusMessage}`}
          tone="success"
          title="Lista przeliczona"
          description={recountStatusMessage}
          durationMs={4200}
          onDismiss={() => setRecountStatusMessage(null)}
          className={zdEstimateStickyToastClass({
            stackIndex: stickyToastStack.recount ?? 0,
            tallDock: stickyToastTallDock,
          })}
        />
      ) : null}

      {settingsLiveMessage ? (
        <Toast
          key={`live:${settingsLiveMessage}`}
          tone="success"
          title="Lista na bieżąco"
          description={settingsLiveMessage}
          durationMs={3200}
          onDismiss={() => setSettingsLiveMessage(null)}
          className={zdEstimateStickyToastClass({
            stackIndex: stickyToastStack.settingsLive ?? 0,
            tallDock: stickyToastTallDock,
          })}
        />
      ) : null}

      <ZdEstimateNoticeTrayBar />

      <div className="flex shrink-0 flex-col gap-1.5">
      {externalSessionExpiredAlert ? (
        <ZdEstimateNotice tray tone="warning" title={zdEstimateExternalSessionExpiredAlertTitle}>
          {zdEstimateExternalSessionExpiredAlertBody}
        </ZdEstimateNotice>
      ) : null}

      {externalSessionRestoreFailedAlert ? (
        <ZdEstimateNotice
          tray
          tone="warning"
          title={zdEstimateExternalSessionRestoreFailedAlertTitle}
        >
          {zdEstimateExternalSessionRestoreFailedAlertBody}
        </ZdEstimateNotice>
      ) : null}

      {externalSessionPersistFailedAlert && lines ? (
        <ZdEstimateNotice
          tray
          tone="warning"
          title={zdEstimateExternalSessionPersistFailedAlertTitle}
        >
          {zdEstimateExternalSessionPersistFailedAlertBody}
        </ZdEstimateNotice>
      ) : null}

      {/* Status LIVE/test jest w ZdEstimatePageIntro — tu tylko blokada. */}
      {!bootstrap.configured ? (
        <ZdEstimateNotice tone="error" title="Kreator ZD zablokowany">
          {zdEstimateBlockedOrdersAlertBody(bootstrap.ordersMessage)}
        </ZdEstimateNotice>
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
            if (createUnconfirmedAttempt) {
              setCreateTimeoutUnlockConfirmOpen(true);
              return;
            }
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
        <ZdEstimateNotice tray tone="error" title="Nie wczytano próśb">
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
        </ZdEstimateNotice>
      ) : null}

      {pendingIndividualsTruncated ? (
        <ZdEstimateNotice tray tone="warning" title="Limit 500 próśb">
          Wczytano pierwsze 500 próśb Nowe — możliwe, że część nie weszła do
          szacunku. {ZD_ESTIMATE_UI.createGatePendingIndividualsTruncated}
        </ZdEstimateNotice>
      ) : null}

      {createDoneDokNr && lines && lines.length > 0 && !postCreate ? (
        <ZdEstimateNotice
          tray
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
                if (createUnconfirmedAttempt) {
                  setCreateTimeoutUnlockConfirmOpen(true);
                  return;
                }
                setCreateUnlockedAfterDone(true);
                setCreateUndoVisible(false);
              }}
            >
              {createUnconfirmedAttempt
                ? "Sprawdziłem Subiekt — odblokuj Create"
                : "Odblokuj tworzenie ZD (świadomie)"}
            </Button>
          ) : null}
        </ZdEstimateNotice>
      ) : null}

      {assignHint ? (
        <div id={ZD_ESTIMATE_ASSIGN_FOCUS_ID} className="scroll-mt-4">
          <ZdEstimateNotice tone="warning" title={ZD_ESTIMATE_UI.assignSupplierScopeTitle} defaultExpanded dismissible={false}>
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
          </ZdEstimateNotice>
        </div>
      ) : null}

      {scopeRemapActive && !assignHint ? (
        <div id={ZD_ESTIMATE_ASSIGN_FOCUS_ID} className="scroll-mt-4">
          <ZdEstimateNotice tone="warning" title={ZD_ESTIMATE_UI.changeSupplierScopeTitle} defaultExpanded dismissible={false}>
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
                disabled={busy}
              >
                {ZD_ESTIMATE_UI.changeSupplierScopeCancelCta}
              </Button>
            </div>
          </ZdEstimateNotice>
        </div>
      ) : null}

      {launch?.fromDaily &&
      !bootstrap.configured &&
      !assignHint &&
      !launchReadyMessage ? (
        <ZdEstimateNotice tone="error" title="Nie przygotuję ZD">
          {zdEstimateBlockedDailyCtaMessage()}
        </ZdEstimateNotice>
      ) : null}
      </div>

      {/* Blokery z akcjami idą do paska „Uwagi”; nad tabelą zostaje tylko błąd ostatniej akcji. */}
      <>{[
          exclusionsError ||
          onRequestsError ||
          packagingError ||
          minStockError ||
          productPairsError ||
          productBomsError ||
          teethProductsError ? (
          <ZdEstimateSettingsTrustBanner
            key="settings-trust"
            tray
            parts={{
              exclusions: exclusionsError,
              onRequest: onRequestsError,
              packaging: packagingError,
              minStock: minStockError,
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
              else if (key === "minStock") retryLoadMinStock();
              else if (key === "pairs") retryLoadPairs();
              else if (key === "boms") retryLoadBoms();
              else retryLoadTeeth();
            }}
          />
          ) : null,
          boostNeedsRecount && lines ? (
            <ZdEstimateNotice
              tray
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
                  busy ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                onClick={() => runEstimate()}
              >
                {ZD_ESTIMATE_UI.boostNeedsRecountCta}
              </Button>
            </ZdEstimateNotice>
          ) : null,
          historyNeedsRecount && lines ? (
            <ZdEstimateNotice
              tray
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
                  busy ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                onClick={() => runEstimate()}
              >
                {ZD_ESTIMATE_UI.historyNeedsRecountCta}
              </Button>
            </ZdEstimateNotice>
          ) : null,
          lines && policzScopeInfo?.horizon ? (
            <ZdEstimateNotice
              tray
              key="policz-horizon"
              tone={policzScopeInfo.horizon.extendedByDays > 0 ? "warning" : "info"}
              title={
                policzScopeInfo.horizon.extendedByDays > 0
                  ? `Liczone z czasem dostawy: ${policzScopeInfo.horizon.horizonDays} dni zamiast ${policzScopeInfo.horizon.stockDays}`
                  : "Czas dostawy uwzględniony — zapas z karty wystarcza"
              }
            >
              <p className="text-sm leading-snug">
                {formatZdHorizonBreakdown(policzScopeInfo.horizon)}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                disabled={busy || !scopeSelected || !settingsTrusted}
                onClick={() => {
                  setLeadTimeHorizon(false);
                  runEstimate({ leadTimeHorizon: false });
                }}
              >
                Przelicz bez czasu dostawy
              </Button>
            </ZdEstimateNotice>
          ) : null,
          lines && policzScopeInfo?.salesSmoothing ? (
            <ZdEstimateNotice
              tray
              key="policz-sales-smoothing"
              tone={policzScopeInfo.salesSmoothing.failed ? "warning" : "info"}
              title={
                policzScopeInfo.salesSmoothing.failed
                  ? "Wygładzenie niedostępne — brak profilu sprzedaży"
                  : "Nietypowa sprzedaż wygładzona"
              }
            >
              <p className="text-sm leading-snug">
                {policzScopeInfo.salesSmoothing.failed
                  ? "Nie udało się pobrać sprzedaży z 12 miesięcy — lista liczona jak dotąd. Spróbuj przeliczyć ponownie."
                  : formatZdSalesSmoothingSummary(policzScopeInfo.salesSmoothing)}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                disabled={busy || !scopeSelected || !settingsTrusted}
                onClick={() => {
                  setSalesSmoothing(false);
                  runEstimate({ salesSmoothing: false });
                }}
              >
                Przelicz bez wygładzenia
              </Button>
            </ZdEstimateNotice>
          ) : null,
          lines &&
          policzScopeInfo &&
          (policzScopeInfo.scopesIncluded.length > 1 ||
            policzScopeInfo.assignedElsewhere.length > 0) ? (
            <ZdEstimateNotice
              tray
              key="policz-scope-info"
              tone="info"
              title="Zakresy dostawcy w tej liście"
            >
              {policzScopeInfo.scopesIncluded.length > 1 ? (
                <p className="text-sm leading-snug">
                  Lista łączy {policzScopeInfo.scopesIncluded.length} zakresy:{" "}
                  {policzScopeInfo.scopesIncluded
                    .map((s) => `${s.mode === "cecha" ? "cecha" : "grupa"} ${s.label || `#${s.id}`}`)
                    .join(", ")}
                  .
                </p>
              ) : null}
              {policzScopeInfo.assignedElsewhere.length > 0 ? (
                <p className="mt-1 text-sm leading-snug">
                  Ukryto {policzScopeInfo.assignedElsewhere.length}{" "}
                  {policzScopeInfo.assignedElsewhere.length === 1 ? "towar" : "towarów"} przypisanych
                  innym dostawcom (wspólny zakres):{" "}
                  {policzScopeInfo.assignedElsewhere
                    .slice(0, 6)
                    .map((a) => a.twSymbol ?? a.twNazwa)
                    .join(", ")}
                  {policzScopeInfo.assignedElsewhere.length > 6 ? "…" : ""}. Zmiana: Dostawcy → Zakresy.
                </p>
              ) : null}
            </ZdEstimateNotice>
          ) : null,
          historyFetchFailed && lines ? (
            <ZdEstimateNotice
              tray
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
                  busy ||
                  !bootstrap.configured ||
                  !scopeSelected ||
                  !settingsTrusted
                }
                onClick={() => runEstimate()}
              >
                {ZD_ESTIMATE_UI.historyFetchFailedCta}
              </Button>
            </ZdEstimateNotice>
          ) : null,
          packagingPairConflicts.length > 0 ? (
            <ZdEstimateNotice
              tray
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
                disabled={busy}
                onClick={unifyPackagingWithPairs}
              >
                Ujednolić opakowanie z parą
              </Button>
            </ZdEstimateNotice>
          ) : null,
          explodeBomIncomplete ? (
            <ZdEstimateNotice
              tray
              key="explode-bom"
              tone="warning"
              title={ZD_BOM_UI.alertExplodeIncompleteTitle}
            >
              <p className="text-sm leading-snug">
                {ZD_BOM_UI.alertExplodeIncompleteBody}
              </p>
            </ZdEstimateNotice>
          ) : null,
          feedback ? (
            <div key="feedback" id={ZD_ESTIMATE_ERROR_FOCUS_ID} className="scroll-mt-4">
              <SubiektFeedbackAlert feedback={feedback} />
            </div>
          ) : errorMessage ? (
            <div key="error" id={ZD_ESTIMATE_ERROR_FOCUS_ID} className="scroll-mt-4">
              <ZdEstimateNotice tone="error" title={effectiveErrorTitle ?? "Błąd"}>
                {errorMessage}
              </ZdEstimateNotice>
            </div>
          ) : null,
        ]}</>

        </>
      ) : null}

      {!showLaunchProgress && !showSessionResumeProgress && prepFormOpen ? (
        <>
        <ZdEstimatePrepForm
          configured={bootstrap.configured}
          busy={busy}
          searching={searching}
          mutating={mutating}
          estimating={estimating}
          scopeMode={scopeMode}
          onScopeModeChange={changeScopeMode}
          quickGroups={quickGroupsLive}
          quickCechy={quickCechyLive}
          isGroupFavorite={isGroupFavoriteCb}
          isCechaFavorite={isCechaFavoriteCb}
          onToggleGroupFavorite={toggleGroupFavorite}
          onToggleCechaFavorite={toggleCechaFavorite}
          onBrowseCatalog={() => setScopeCatalogOpen(true)}
          selectedGroup={selectedGroup}
          onSelectGroup={(g) => {
            rememberGroupEnrich(g);
            setGroupHits([]);
            selectGroup(g);
          }}
          onSelectGroupHit={(g) => {
            rememberGroupEnrich(g);
            selectGroup(g);
          }}
          groupQuery={groupQuery}
          onGroupQueryChange={setGroupQuery}
          onSearchGroups={searchGroups}
          groupHits={groupHits}
          onClearGroupHits={() => setGroupHits([])}
          selectedCecha={selectedCecha}
          onSelectCecha={(c) => {
            rememberCechaEnrich(c);
            setCechaHits([]);
            selectCecha(c);
          }}
          onSelectCechaHit={(c) => {
            rememberCechaEnrich(c);
            selectCecha(c);
          }}
          cechaQuery={cechaQuery}
          onCechaQueryChange={setCechaQuery}
          onSearchCechy={searchCechy}
          cechaHits={cechaHits}
          onClearCechaHits={() => setCechaHits([])}
          scopeSelected={scopeSelected}
          settingsTrusted={settingsTrusted}
          scopeNeedsRecount={scopeNeedsRecount}
          canPolicz={canPolicz}
          boostPreset={boostPreset}
          onBoostPresetChange={onBoostPresetChange}
          extrasPolicy={extrasPolicy}
          onExtrasPolicyChange={onExtrasPolicyChange}
          dniZapasu={dniZapasu}
          onDniZapasuChange={onDniZapasuChange}
          dataOd={dataOd}
          dataDo={dataDo}
          onManualDataOdChange={onManualDataOdChange}
          onManualDataDoChange={onManualDataDoChange}
          salesWindowSource={salesWindowSource}
          onRestoreSalesWindowFromStock={restoreSalesWindowFromStock}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          supplierId={supplierId}
          onSupplierOverride={onSupplierOverride}
          suppliers={bootstrap.suppliers}
          selectedSupplier={selectedSupplier}
          supplierFromMappingNotice={supplierFromMappingNotice}
          zapasMin={zapasMin}
          onZapasMinChange={setZapasMin}
          leadTimeHorizon={leadTimeHorizon}
          onLeadTimeHorizonChange={(next) => {
            setLeadTimeHorizon(next);
            if (lines) setHorizonNeedsRecount(true);
          }}
          salesSmoothing={salesSmoothing}
          onSalesSmoothingChange={(next) => {
            setSalesSmoothing(next);
            if (lines) setHorizonNeedsRecount(true);
          }}
          onPolicz={() => runEstimate()}
          hasList={Boolean(lines)}
          recountNeeded={
            Boolean(lines) && (boostNeedsRecount || historyNeedsRecount || horizonNeedsRecount)
          }
          showAssignAndRun={Boolean(assignHint && launch?.supplierId)}
          showRemapAndRun={Boolean(
            scopeRemapActive && !assignHint && launch?.supplierId
          )}
          onAssignAndRun={confirmAssignAndRun}
        />
        <ZdEstimateScopeCatalogDialog
          open={scopeCatalogOpen}
          onClose={() => setScopeCatalogOpen(false)}
          mode={scopeMode}
          configured={bootstrap.configured}
          favoriteGroups={favoriteGroups}
          favoriteCechy={favoriteCechy}
          groupEnrichById={groupEnrichById}
          cechaEnrichById={cechaEnrichById}
          isGroupFavorite={isGroupFavoriteCb}
          isCechaFavorite={isCechaFavoriteCb}
          onToggleGroupFavorite={toggleGroupFavorite}
          onToggleCechaFavorite={toggleCechaFavorite}
          onSelectGroup={(g) => {
            rememberGroupEnrich(g);
            setGroupHits([]);
            selectGroup(g);
          }}
          onSelectCecha={(c) => {
            rememberCechaEnrich(c);
            setCechaHits([]);
            selectCecha(c);
          }}
          onRememberGroup={rememberGroupEnrich}
          onRememberCecha={rememberCechaEnrich}
        />
        </>
      ) : null}

      {!showLaunchProgress && !showSessionResumeProgress && !sessionRestorePending ? (
        <>

      {kitOnlyBlockedAlertCount > 0 ||
      pairPartnerMissingCount > 0 ||
      (bomMissingCount > 0 && !explodeBomIncomplete) ||
      (Boolean(lines) &&
        excludedWithIndividualCount > 0 &&
        excludedRoutedToServicesCount === 0) ? (
      <>
      {kitOnlyBlockedAlertCount > 0 ? (
        <ZdEstimateNotice tray tone="warning" title={ZD_BOM_UI.alertKitOnlySalesTitle}>
          <p className="text-sm leading-snug">
            {ZD_BOM_UI.alertKitOnlySalesBody(kitOnlyBlockedAlertCount)}
          </p>
        </ZdEstimateNotice>
      ) : null}
      {[
          pairPartnerMissingCount > 0 ? (
            <ZdEstimateNotice key="pair-partner-missing" tray tone="warning" title="Brak partnera pary w szacunku">
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
                  disabled={busy}
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
            </ZdEstimateNotice>
          ) : null,
          /* Soft only — blocking explode incomplete jest pełnym alertem powyżej. */
          bomMissingCount > 0 && !explodeBomIncomplete ? (
            <ZdEstimateNotice key="bom-missing" tray tone="warning" title={ZD_BOM_UI.alertMissingTitle}>
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
                  disabled={busy}
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
            </ZdEstimateNotice>
          ) : null,
          lines &&
          excludedWithIndividualCount > 0 &&
          excludedRoutedToServicesCount === 0 ? (
            <ZdEstimateNotice key="excluded-requests" tray tone="warning" title="Prośby na wykluczonych pozycjach">
              {excludedWithIndividualCount}{" "}
              {zdEstimateProsbaWord(excludedWithIndividualCount)}{" "}
              {excludedWithIndividualCount === 1
                ? "nadal na wykluczonej pozycji"
                : "nadal na wykluczonych pozycjach"}{" "}
              — sprawdź listę.
            </ZdEstimateNotice>
          ) : null,
        ]}
      </>
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
              hint={zdEstimateRecountOverlayHint(
                bootstrap.ordersIsLive,
                runProgressSnapshot
                  ? zdEstimateRunPhaseStatusHint({
                      phase: runProgressSnapshot.phase,
                      isLive: bootstrap.ordersIsLive,
                      pagesLabel: formatLaunchProgressPagesLabel(
                        runProgressSnapshot
                      ),
                    })
                  : null
              )}
              progressPct={
                runProgressSnapshot
                  ? launchProgressPctFromRun(runProgressSnapshot)
                  : null
              }
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
              meta?.truncated
                ? zdEstimateTruncatedListStatusNote()
                : visibleLines.length > 0 || orderableLines.length > 0
                  ? formatZdEstimateOrderableStatusNote({
                      orderable: orderableLines.length,
                      hiddenOrderable: hiddenOrderableCount,
                    })
                  : null
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
            onSortByMinStock={() => {
              setSortKey("minStock");
              setSortDir("desc");
            }}
            sortKeyIsMinStock={sortKey === "minStock"}
            visibleCount={visibleLines.length}
            allVisibleSelected={allVisibleSelected}
            selectedCount={selectedCount}
            onSelectAllVisible={selectAllVisible}
            disabled={busy}
            leadTimeHorizon={leadTimeHorizon}
            onLeadTimeHorizonToggle={
              scopeSelected && settingsTrusted
                ? (next) => {
                    setLeadTimeHorizon(next);
                    runEstimate({ leadTimeHorizon: next });
                  }
                : undefined
            }
            salesSmoothing={salesSmoothing}
            onSalesSmoothingToggle={
              scopeSelected && settingsTrusted
                ? (next) => {
                    setSalesSmoothing(next);
                    runEstimate({ salesSmoothing: next });
                  }
                : undefined
            }
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
                  ) : (!settingsTrusted || !minStockTrusted) &&
                    listFilter === "order" ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onClick={retryLoadAllSettings}
                      >
                        Wczytaj wszystko
                      </Button>
                      <span className="flex items-center px-1 text-xs text-slate-400" aria-hidden>
                        lub
                      </span>
                      {!exclusionsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
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
                          disabled={busy}
                          onClick={retryLoadPackaging}
                        >
                          Wczytaj opakowania
                        </Button>
                      ) : null}
                      {!minStockTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={retryLoadMinStock}
                        >
                          Wczytaj minimum stanów
                        </Button>
                      ) : null}
                      {!pairsTrusted ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
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
                          disabled={busy}
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
                          disabled={busy}
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
                          disabled={busy}
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
                    showZkColumn && "zd-estimate-table--zk",
                    // Kolumna Status wycofana — jej miejsce zawsze dostaje Nazwa (znaczniki pod nazwą).
                    "zd-estimate-table--no-status"
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
                            visibleLines.length === 0 || busy
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
                          scope="col"
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
                      {tableOptionalColumns.map((col) => {
                        const sectionCls = tableColumnSectionStarts.has(col)
                          ? "zd-estimate-col--section"
                          : null;
                        const flowCls = zdEstimateFlowColumnClass(col);
                        switch (col) {
                          case "packaging":
                            return null;
                          case "cover":
                            return (
                              <ZdEstimateSortableTh
                                key={col}
                                label="Starczy"
                                field="cover"
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onSort={handleSort}
                                className={cn("zd-estimate-num-col zd-estimate-cover-col", sectionCls)}
                                align="right"
                                hint="Dni do wyczerpania: dostępne ÷ sprzedaż dziennie. Sortowanie rosnąco = najpilniejsze."
                                density="compact"
                              />
                            );
                          case "value":
                            return (
                              <th
                                key={col}
                                className={cn("zd-estimate-num-col zd-estimate-value-col", sectionCls)}
                                scope="col"
                                title="Wartość pozycji: sztuki po dostawie × ostatnia cena z ZD (netto)."
                              >
                                Wartość
                              </th>
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
                                title="Dostępne w sztukach (stan − rezerwacje); rezerwacje pod liczbą — klik pokazuje ZK. Przy SKU paczki z pary — jednostki karty (op.)."
                              >
                                Dost.
                              </th>
                            );
                          case "sales":
                            return (
                              <th
                                key={col}
                                className={cn(
                                  "zd-estimate-metric-col zd-estimate-metric-col--sales",
                                  flowCls,
                                  sectionCls
                                )}
                                title="Sprzedaż w oknie (FS + PA + WZ niepowiązane) — sztuki. Breakdown WZ w dopisku pod liczbą, gdy > 0. Przybliżenie w opakowaniach — w podpowiedzi (hover)."
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
                                  "zd-estimate-metric-col zd-estimate-metric-col--target",
                                  flowCls,
                                  sectionCls
                                )}
                                title="Cel zapasu — planowana ilość na stanie (sztuki). Przybliżenie w opakowaniach — w podpowiedzi (hover)."
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
                                title="W drodze — otwarte ZD w jednostkach dokumentu (przy paczkach: przeliczenie na sztuki w podpowiedzi)."
                              >
                                W drodze
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
                      <th className="zd-estimate-actions-col text-center" scope="col">
                        <span className="sr-only">Akcje</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableVirtual.enabled && tableVirtual.paddingTop > 0 ? (
                      <tr aria-hidden>
                        <td
                          colSpan={tableColSpan}
                          style={{
                            height: tableVirtual.paddingTop,
                            padding: 0,
                            border: 0,
                          }}
                        />
                      </tr>
                    ) : null}
                    {(tableVirtual.enabled
                      ? tableVirtual.virtualRows.map((vr) => vr.index)
                      : visibleLines.map((_, index) => index)
                    ).map((rowIndex) => {
                      const l = visibleLines[rowIndex]!;
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
                      return (
                        <ZdEstimateTableRow
                          key={l.tw_Id}
                          line={l}
                          rowIndex={rowIndex}
                          virtualized={tableVirtual.enabled}
                          measureElement={tableVirtual.measureElement}
                          showPackagingColumn={showPackagingColumn}
                          optionalColumns={tableOptionalColumns}
                          columnSectionStarts={tableColumnSectionStarts}
                          busy={busy}
                          mutating={mutating}
                          rowPending={mutatingTwId === l.tw_Id}
                          packagingTrusted={packagingTrusted}
                          exclusionsTrusted={exclusionsTrusted}
                          onRequestTrusted={onRequestTrusted}
                          isSelected={Boolean(selected[l.tw_Id])}
                          excluded={orderExcludedTwIds.has(l.tw_Id)}
                          dbExcluded={
                            exclusionsTrusted && dbExcludedIds.has(l.tw_Id)
                          }
                          dbOnRequest={dbOnRequest}
                          softOnRequest={
                            dbOnRequest &&
                            orderExcludedTwIds.has(onRequestCanonicalId) &&
                            !liftedExtraOnly
                          }
                          liftedExtraOnly={liftedExtraOnly}
                          sessionIncluded={Boolean(sessionIncludeTwIds[l.tw_Id])}
                          onRequestCanonicalId={onRequestCanonicalId}
                          nameHit={nameAutoByTwId.get(l.tw_Id)}
                          packRow={packagingMap.get(l.tw_Id) ?? null}
                          packLookup={packagingLookup.get(l.tw_Id) ?? null}
                          individualExtra={
                            individualBundle.byTwId.get(l.tw_Id) ?? null
                          }
                          individualExtraPieces={individualExtraPiecesForTw(
                            l.tw_Id,
                            individualExtraByTwId
                          )}
                          stockNeedReliefPieces={individualExtraPiecesForTw(
                            l.tw_Id,
                            stockNeedReliefByTwId
                          )}
                          extraOverlapPieces={individualExtraPiecesForTw(
                            l.tw_Id,
                            extraOverlapByTwId
                          )}
                          minStockSzt={minStockByTwIdForRefresh.get(l.tw_Id)}
                          extrasPolicy={extrasPolicy}
                          overrideZdUnits={qtyOverrideByTwId[l.tw_Id]}
                          reviewAccepted={Boolean(acceptedReviewTwIds[l.tw_Id])}
                          onToggleSelected={handleRowToggleSelected}
                          onEditPackaging={setPackagingCandidate}
                          onEditMinStock={setMinStockCandidate}
                          onExclude={setExcludeCandidate}
                          onRestore={handleRowRestore}
                          onMarkOnRequest={handleRowMarkOnRequest}
                          onClearOnRequest={handleRowClearOnRequest}
                          onSessionInclude={handleRowSessionInclude}
                          onOverrideChange={handleRowOverrideChange}
                          onAcceptReview={handleRowAcceptReview}
                          otherSupplierHint={policzScopeInfo?.otherSupplierHintByTwId[l.tw_Id] ?? null}
                          unitPriceNet={unitPriceByTwId[l.tw_Id] ?? null}
                        />
                      );
                    })}
                    {tableVirtual.enabled && tableVirtual.paddingBottom > 0 ? (
                      <tr aria-hidden>
                        <td
                          colSpan={tableColSpan}
                          style={{
                            height: tableVirtual.paddingBottom,
                            padding: 0,
                            border: 0,
                          }}
                        />
                      </tr>
                    ) : null}
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
              disabled={busy || !selectionToolsOpen}
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
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
                {orderSummary.count > 0 ? (
                  <span
                    className="ml-1 inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12px] tabular-nums text-slate-600"
                    title="Suma pozycji „Do ZD” z Twoimi zmianami ilości; wartość = sztuki po dostawie × ostatnia cena z ZD (netto)"
                    role="status"
                  >
                    <strong className="font-semibold text-slate-900">{orderSummary.count}</strong>
                    {plPozycja(orderSummary.count)}
                    <span aria-hidden>·</span>
                    {orderSummary.pieces.toLocaleString("pl-PL")} szt
                    {orderSummary.value > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <strong className="font-semibold text-slate-900">
                          ok. {Math.round(orderSummary.value).toLocaleString("pl-PL")} zł
                        </strong>
                      </>
                    ) : null}
                    {orderSummary.unpriced > 0 ? (
                      <span className="text-slate-500">· {orderSummary.unpriced} bez ceny</span>
                    ) : null}
                  </span>
                ) : null}
                {/* Sesja kreatora — z dala od „Utwórz ZD” (anulowanie jest nieodwracalne). */}
                {showExternalSessionActiveStatus || canCancelExternalSession ? (
                  <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5">
                  {showExternalSessionActiveStatus ? (
                    <ZdEstimateExternalSessionActiveChip />
                  ) : null}
                  {canCancelExternalSession ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(zdEstimateDockButtonClass, "text-slate-500 hover:text-red-700")}
                      onClick={() => {
                        const token = externalSessionTokenState;
                        if (!token) return;
                        cancelExternalSessionSessionIdRef.current =
                          token.sessionId;
                        setCancelExternalSessionOpen(true);
                      }}
                      disabled={busy}
                      title="Anuluj zapis sesji kreatora ZD (przestanie działać przycisk „Wróć do kreatora”)."
                    >
                      {zdEstimateExternalSessionCancelButtonLabel}
                    </Button>
                  ) : null}
                  </div>
                ) : null}
              </div>
              {stickyCreateGateCaption ? (
                <div
                  id="zd-estimate-sticky-create-gate"
                  role="status"
                  className={cn(
                    "flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug",
                    stickyCreateGateCaption.tone === "loading"
                      ? "border-indigo-200/80 bg-indigo-50/70 text-indigo-900"
                      : stickyCreateGateCaption.tone === "error"
                        ? "border-red-200/80 bg-red-50/70 text-red-900"
                        : "border-amber-200/80 bg-amber-50/70 text-amber-900"
                  )}
                >
                  {stickyCreateGateCaption.tone === "loading" ? (
                    <Spinner
                      size="sm"
                      className="mt-px h-3 w-3 border-[1.5px] border-indigo-200 border-t-indigo-600"
                    />
                  ) : stickyCreateGateCaption.tone === "error" ? (
                    <IconAlertCircle
                      size={13}
                      strokeWidth={2}
                      className="mt-px shrink-0 text-red-600"
                      aria-hidden
                    />
                  ) : (
                    <IconInfoCircle
                      size={13}
                      strokeWidth={2}
                      className="mt-px shrink-0 text-amber-600"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    {stickyCreateGateCaption.reason}
                  </span>
                  {stickyCreateGateRecount ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="-my-1 h-6 shrink-0 px-2 text-[11px]"
                      disabled={
                        busy || !bootstrap.configured || !scopeSelected || !settingsTrusted
                      }
                      onClick={() => runEstimate()}
                    >
                      Przelicz
                    </Button>
                  ) : null}
                </div>
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
          undoLabel={
            createUnconfirmedAttempt
              ? "Sprawdziłem Subiekt — odblokuj"
              : "Odblokuj tworzenie ZD"
          }
          onUndo={() => {
            if (createUnconfirmedAttempt) {
              setCreateTimeoutUnlockConfirmOpen(true);
              return;
            }
            setCreateUnlockedAfterDone(true);
            setCreateUndoVisible(false);
          }}
          onDismiss={() => setCreateUndoVisible(false)}
        />
      ) : null}

      <ConfirmDialog
        open={createTimeoutUnlockConfirmOpen}
        title={ZD_ESTIMATE_UI.postCreateTimeoutUnlockConfirmTitle}
        message={ZD_ESTIMATE_UI.postCreateTimeoutUnlockConfirmMessage}
        confirmLabel={ZD_ESTIMATE_UI.postCreateTimeoutUnlockConfirmLabel}
        cancelLabel="Anuluj"
        onCancel={() => setCreateTimeoutUnlockConfirmOpen(false)}
        onConfirm={() => {
          setCreateTimeoutUnlockConfirmOpen(false);
          if (!createUnconfirmedAttempt) return;
          setCreateUnlockedAfterDone(true);
          setCreateUndoVisible(false);
        }}
      />

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
        stockNeedReliefPieces={
          packagingCandidate
            ? individualExtraPiecesForTw(
                packagingCandidate.tw_Id,
                stockNeedReliefByTwId
              )
            : 0
        }
        extraOverlapPieces={
          packagingCandidate
            ? individualExtraPiecesForTw(
                packagingCandidate.tw_Id,
                extraOverlapByTwId
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

      <ZdEstimateMinStockDialog
        open={minStockCandidate != null}
        line={minStockCandidate}
        existingMinSzt={
          minStockCandidate
            ? minStockByTwIdForRefresh.get(minStockCandidate.tw_Id) ?? 0
            : 0
        }
        pending={mutating && minStockCandidate != null}
        onCancel={() => {
          if (!mutating) setMinStockCandidate(null);
        }}
        onSave={saveMinStock}
        onClear={clearMinStock}
      />

      <MountAfterOpen open={packagingOpen}>
        <ZdEstimatePackagingModal
          open={packagingOpen}
          onClose={() => setPackagingOpen(false)}
          packaging={packaging}
          packPairTwIds={packPairTwIds}
          onPackagingChange={applyPackagingLive}
          onError={reportError}
        />
      </MountAfterOpen>

      <MountAfterOpen open={minStockOpen}>
        <ZdEstimateMinStockModal
          open={minStockOpen}
          onClose={() => setMinStockOpen(false)}
          minStock={minStock}
          onMinStockChange={applyMinStockLive}
          onError={reportError}
        />
      </MountAfterOpen>

      <MountAfterOpen open={pairsOpen}>
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
      </MountAfterOpen>

      <MountAfterOpen open={bomsOpen}>
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
      </MountAfterOpen>

      <ZdEstimateExcludeDialog
        open={excludeCandidate != null}
        line={excludeCandidate}
        pending={mutating && excludeCandidate != null}
        onCancel={() => {
          if (!mutating) setExcludeCandidate(null);
        }}
        onConfirm={confirmExclude}
      />

      <MountAfterOpen open={exclusionsOpen}>
        <ZdEstimateExclusionsModal
          open={exclusionsOpen}
          onClose={() => setExclusionsOpen(false)}
          exclusions={exclusions}
          onExclusionsChange={applyExclusionsLive}
          onError={reportError}
        />
      </MountAfterOpen>

      <MountAfterOpen open={onRequestPanelOpen}>
        <ZdEstimateOnRequestModal
          open={onRequestPanelOpen}
          onClose={() => setOnRequestPanelOpen(false)}
          onRequests={onRequests}
          onOnRequestsChange={applyOnRequestsLive}
          onError={reportError}
        />
      </MountAfterOpen>

      <MountAfterOpen open={scopesPanelOpen}>
        <ZdEstimateSupplierScopesModal
          open={scopesPanelOpen}
          onClose={() => setScopesPanelOpen(false)}
          suppliers={bootstrap.suppliers}
          configured={bootstrap.configured}
          onError={reportError}
          todayCoverage={todayCoverage}
          onScopesChange={handleSupplierScopesChange}
        />
      </MountAfterOpen>

      <MountAfterOpen open={snapshotsPanelOpen}>
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
      </MountAfterOpen>

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
            setCreateTimeoutUnlockConfirmOpen(false);
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
                packagingLookup,
                minStockByTwIdForRefresh
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
                    minStockByTwId: minStockByTwIdForRefresh,
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
          listAgeMinutes={createListAgeMinutes}
          manualOverrideCount={manualOverrideOrderableCount}
          onRecountRequest={() => {
            setCreateZdOpen(false);
            runEstimate();
          }}
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
            setCreateTimeoutUnlockConfirmOpen(false);
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
                packagingLookup,
                minStockByTwIdForRefresh
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
                    minStockByTwId: minStockByTwIdForRefresh,
                  },
                });
              setLines(nextLines);
              setMissingPartnerTwIds(missingPartnerTwIds);
              setMissingBomTwIds(missingBomTwIds);
            }
          }}
          onError={(message, opts) => {
            setCreatingZd(false);
            reportError(message, { title: opts?.title });
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
    </ZdEstimateNoticeTrayProvider>
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
