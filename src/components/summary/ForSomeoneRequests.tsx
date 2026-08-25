"use client";

import { useMemo, useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type {
  SummaryForSomeoneEnriched,
  SupplierSummaryMeta,
  WeekDayPlan,
} from "@/lib/orders/summary-workspace";
import { PlannedOrderDateMeta } from "@/components/orders/PlannedOrderDateMeta";
import { parseDateOnly } from "@/lib/orders/dates";
import { enrichForSomeoneGroup, enrichStockOutSignalGroup, plannedOrderDateForSupplier, sortForSomeoneGroups } from "@/lib/orders/procurement-daily-ui";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { useProcurementSupplierCollapse } from "@/components/summary/useProcurementSupplierCollapse";
import {
  buildProcurementSupplierBlocks,
  filterNavigableProcurementGroups,
  procurementMoreProductsLabel,
  procurementProductCountLabel,
  showProcurementSupplierBlockHeader,
  procurementSupplierBlockScopeKey,
  type ProcurementSupplierBlock,
} from "@/lib/orders/procurement-supplier-groups";
import { ProcurementSupplierBlockBar } from "@/components/summary/ProcurementSupplierBlockBar";
import { actionMarkProcurementRequestsSeen, actionProcessIndividual, actionSetProcurementRequestFlags } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProcurementCancelDialog } from "@/components/procurement/ProcurementCancelDialog";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { formatSupplierLeadTimeBrief } from "@/lib/orders/delivery-eta";
import {
  ProcurementRequestLine,
  ProcurementRequestLineInline,
  ProcurementRequestClientMeta,
  procurementGroupRequestNote,
} from "@/components/summary/ProcurementRequestLine";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import {
  EditIndividualRequestModal,
  type EditIndividualRequestInitial,
} from "@/components/orders/EditIndividualRequestModal";
import { editInitialFromForSomeoneGroup } from "@/lib/orders/individual-request-edit-ui";
import { IndividualRequestActionBar } from "@/components/summary/IndividualRequestActionBar";
import {
  ProcurementRequestFlagChip,
  ProcurementRequestFlagGroupChip,
} from "@/components/summary/ProcurementRequestFlagChip";
import { ProcurementRequestLaneNav } from "@/components/summary/ProcurementRequestLaneNav";
import {
  ProcurementRequestFlagEditModal,
  type ProcurementRequestFlagEditResult,
} from "@/components/summary/ProcurementRequestFlagEditModal";
import {
  buildFlagSortOrderMap,
  summarizeGroupProcurementFlags,
  type ProcurementFlagDefinition,
  type ProcurementRequestFlag,
} from "@/lib/orders/procurement-request-flag";
import {
  type SupplierOnVacationWindow,
} from "@/lib/orders/procurement-supplier-vacation";
import { SupplierVacationNowChip } from "@/components/summary/SupplierVacationNowChip";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { ProcurementFlagDefinitionsManageModal } from "@/components/summary/ProcurementFlagDefinitionsManageModal";
import {
  dailyPanelUnseenBadgeClass,
  panelTextLinkClass,
  panelTypography,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
import {
  procurementRequestLaneContentClass,
  procurementRequestLanesBodyClass,
  procurementRequestLaneShellClass,
  procurementRequestLaneSupplierInnerListClass,
  procurementRequestLaneSupplierShellClass,
  resolveProcurementRequestLaneTone,
} from "@/lib/ui/procurement-request-lane-ui";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import { cn } from "@/lib/cn";
import { panelRowClearFocusOnLeave } from "@/lib/ui/panel-row-actions-reveal";
import {
  ProcurementRequestCardHeader,
  ProcurementRequestContextBlock,
  ProcurementRequestContextMetaItem,
  ProcurementRequestOrderBody,
} from "@/components/summary/ProcurementRequestCardZones";
import { ProcurementRequestActionsFooter } from "@/components/summary/ProcurementRequestActionsFooter";
import {
  procurementNestedRowMeta,
  procurementRequestCardBodyClass,
  procurementRequestCardBodyNestedClass,
  procurementRequestCardFooterClass,
  procurementRequestCardFooterNestedClass,
  procurementRequestExpandProductsClass,
  procurementRequestRowClassName,
  procurementSupplierNameLinkClass,
} from "@/components/summary/procurement-request-row-styles";
import { shouldSuppressProcurementLineClient, shouldSuppressProcurementLineRequestNote, shouldSuppressProcurementGroupPlannedOrderDate } from "@/components/summary/procurement-request-client-ui";
import { dailyPanelQueueSectionScrollClass } from "@/lib/orders/daily-panel-section-anchors";
import {
  INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT,
} from "@/lib/orders/informacja-flow-copy";
import {
  ForSomeoneRequestsSectionHelp,
  StockOutSectionHelp,
} from "@/components/summary/ForSomeoneRequestsHelp";
import { InformacjaViaPanelProcurementCallout } from "@/components/orders/InformacjaFlowLegend";
import { clientNamesSummaryFromLines } from "@/lib/orders/sales-client-label";
import { PROCUREMENT_GLOWNE_ON_DEMAND_HINT } from "@/lib/orders/glowne-action-ui";
import { requestNotesProcurementSublineSuffix } from "@/lib/orders/sales-request-note";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  assignProcurementRequestLane,
  partitionForSomeoneGroups,
  procurementLaneAnchorId,
  procurementRequestGroupKey,
  type ProcurementRequestLaneId,
  type ProcurementRequestLaneVariant,
} from "@/lib/orders/procurement-request-lanes";
import {
  countProcurementBlockGroups,
  isProcurementLaneExpanded,
  isProcurementLanePeekPartialSupplier,
  procurementLaneDisplayBlocks,
  resolveProcurementLaneChrome,
} from "@/lib/orders/procurement-request-lane-collapse";
import { PROCUREMENT_REQUEST_LANE_COPY } from "@/lib/orders/procurement-request-lane-copy";
import {
  actionReorderProcurementFlagsAndLaneOrder,
  actionSetProcurementLaneOrder,
} from "@/app/actions/procurement-flag-defs";
import {
  canMoveVisibleLane,
  moveVisibleLaneInOrder,
  normalizeProcurementLaneOrder,
  replaceActiveFlagSequenceInLaneOrder,
  serializeProcurementLaneOrder,
} from "@/lib/orders/procurement-request-lane-order";
import { reorderActiveFlagDefinitions } from "@/lib/orders/procurement-flag-definition-order";
import {
  applyProcurementFlagPatchesToGroups,
  buildProcurementFlagPatchesForOrderIds,
  getProcurementFlagOptimisticEpoch,
  getProcurementFlagOptimisticEpochServerSnapshot,
  mergeProcurementFlagPatchMaps,
  omitProcurementFlagPatches,
  pruneSyncedProcurementFlagPatches,
  subscribeProcurementFlagOptimisticInvalidate,
  type ProcurementFlagLinePatch,
} from "@/lib/orders/procurement-flag-optimistic";
import {
  ProcurementRequestLaneHeader,
  procurementRequestLaneHint,
} from "@/components/summary/ProcurementRequestLaneHeader";
import { ProcurementRequestLaneCollapse } from "@/components/summary/ProcurementRequestLaneCollapse";

function groupHasInformacjaFlow(g: SummaryForSomeoneEnriched): boolean {
  return g.lines.some((l) => l.informacjaViaPanel);
}

const MARK_SEEN_DELAY_MS = 1500;
const MARK_SEEN_BATCH_MS = 400;

function useProcurementSeenTracker(variant: ProcurementRequestLaneVariant) {
  const groupKey = useCallback(
    (g: SummaryForSomeoneEnriched) => procurementRequestGroupKey(g, variant),
    [variant]
  );
  const [locallySeenKeys, setLocallySeenKeys] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Klucze, dla których wysłano już zapis do API (poza cyklem renderu). */
  const persistSeenRef = useRef<Set<string>>(new Set());
  const locallySeenRef = useRef(locallySeenKeys);
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingGroupKeysRef = useRef<Set<string>>(new Set());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    locallySeenRef.current = locallySeenKeys;
  }, [locallySeenKeys]);

  useEffect(() => {
    const pendingOrderIds = pendingOrderIdsRef;
    const pendingGroupKeys = pendingGroupKeysRef;
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      const ids = [...pendingOrderIds.current];
      if (ids.length) {
        pendingOrderIds.current.clear();
        pendingGroupKeys.current.clear();
        void actionMarkProcurementRequestsSeen(ids).catch(() => {
          /* best effort przy opuszczeniu widoku */
        });
      }
    };
  }, []);

  const flushPendingSeen = useCallback(() => {
    batchTimerRef.current = null;
    const ids = [...pendingOrderIdsRef.current];
    const groupKeys = [...pendingGroupKeysRef.current];
    pendingOrderIdsRef.current.clear();
    pendingGroupKeysRef.current.clear();
    if (!ids.length) return;

    void actionMarkProcurementRequestsSeen(ids).catch(() => {
      for (const id of ids) {
        persistSeenRef.current.delete(`order:${id}`);
      }
      for (const key of groupKeys) {
        persistSeenRef.current.delete(key);
      }
      setLocallySeenKeys((prev) => {
        const next = new Set(prev);
        for (const key of groupKeys) next.delete(key);
        return next.size === prev.size ? prev : next;
      });
    });
  }, []);

  const isGroupUnseen = useCallback(
    (group: SummaryForSomeoneEnriched) =>
      group.hasUnseen && !locallySeenKeys.has(groupKey(group)),
    [locallySeenKeys, groupKey]
  );

  const markGroupSeen = useCallback(
    (group: SummaryForSomeoneEnriched) => {
      if (!group.hasUnseen) return;
      const key = groupKey(group);
      if (locallySeenRef.current.has(key)) return;

      const orderIdsToQueue: string[] = [];
      for (const orderId of group.orderIds) {
        const orderKey = `order:${orderId}`;
        if (persistSeenRef.current.has(orderKey)) continue;
        orderIdsToQueue.push(orderId);
      }

      persistSeenRef.current.add(key);
      setLocallySeenKeys((prev) => new Set(prev).add(key));
      pendingGroupKeysRef.current.add(key);

      for (const orderId of orderIdsToQueue) {
        persistSeenRef.current.add(`order:${orderId}`);
        pendingOrderIdsRef.current.add(orderId);
      }

      if (!orderIdsToQueue.length) return;

      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(flushPendingSeen, MARK_SEEN_BATCH_MS);
    },
    [flushPendingSeen, groupKey]
  );

  const scheduleMarkSeen = useCallback(
    (group: SummaryForSomeoneEnriched) => {
      const key = groupKey(group);
      if (!group.hasUnseen || locallySeenRef.current.has(key)) return;
      const existing = timersRef.current.get(key);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key);
          markGroupSeen(group);
        }, MARK_SEEN_DELAY_MS)
      );
    },
    [markGroupSeen, groupKey]
  );

  const cancelMarkSeen = useCallback(
    (group: SummaryForSomeoneEnriched) => {
      const key = groupKey(group);
      const existing = timersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
        timersRef.current.delete(key);
      }
    },
    [groupKey]
  );

  return { groupKey, isGroupUnseen, markGroupSeen, scheduleMarkSeen, cancelMarkSeen };
}

export function ForSomeoneRequests({
  groups,
  isScopePending,
  run,
  onOpenSupplier,
  statsBySupplierId = {},
  supplierStatsMode = {},
  suppliers = [],
  salesPeople = [],
  supplierMeta = {},
  todayDateKey,
  weekDays = [],
  queueStep,
  sectionId = "kolejka-prosby",
  variant = "requests",
  highlightFresh = false,
  suppliersOnVacationNow = {},
  procurementFlagDefinitions = [],
  procurementLaneOrder = null,
  lanePrefs,
  notify,
}: {
  groups: SummaryForSomeoneEnriched[];
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  statsBySupplierId?: Record<string, DeliveryStats>;
  supplierStatsMode?: Record<string, StatsMode>;
  suppliers?: OrderFormSupplierOption[];
  salesPeople?: { id: string; name: string }[];
  supplierMeta?: Record<string, SupplierSummaryMeta>;
  todayDateKey?: string;
  weekDays?: WeekDayPlan[];
  queueStep?: number;
  sectionId?: string;
  variant?: "requests" | "stockOut";
  highlightFresh?: boolean;
  /** Dostawcy z aktywnym urlopem obejmującym dziś (kalendarz). */
  suppliersOnVacationNow?: Record<string, SupplierOnVacationWindow>;
  procurementFlagDefinitions?: ProcurementFlagDefinition[];
  /** Surowe app_settings — kolejność torów (system + flagi). */
  procurementLaneOrder?: unknown;
  /**
   * Wspólny stan z DailyTodayView (Prośby + stock-out).
   * Gdy brak — lokalny fallback (np. testy / pojedyncze użycie).
   */
  lanePrefs?: {
    localFlagDefinitions: ProcurementFlagDefinition[];
    setLocalFlagDefinitions: Dispatch<SetStateAction<ProcurementFlagDefinition[]>>;
    localLaneOrder: ProcurementRequestLaneId[];
    setLocalLaneOrder: Dispatch<SetStateAction<ProcurementRequestLaneId[]>>;
  };
  notify?: (text: string, tone?: "success" | "error") => void;
}) {
  const isStockOutSection = variant === "stockOut";
  const laneVariant: ProcurementRequestLaneVariant = isStockOutSection
    ? "stockOut"
    : "requests";
  const sectionRootRef = useRef<HTMLElement | null>(null);
  const flagOptimisticEpoch = useSyncExternalStore(
    subscribeProcurementFlagOptimisticInvalidate,
    getProcurementFlagOptimisticEpoch,
    getProcurementFlagOptimisticEpochServerSnapshot
  );

  /** Patche flag + kotwice sync (props / undo epoch) — bez setState w useEffect. */
  const [flagOpt, setFlagOpt] = useState<{
    patches: Map<string, ProcurementFlagLinePatch>;
    groups: SummaryForSomeoneEnriched[];
    epoch: number;
  }>(() => ({
    patches: new Map(),
    groups,
    epoch: flagOptimisticEpoch,
  }));

  if (flagOpt.groups !== groups || flagOpt.epoch !== flagOptimisticEpoch) {
    const clearedByUndo =
      flagOptimisticEpoch !== flagOpt.epoch && flagOptimisticEpoch > 0;
    setFlagOpt({
      groups,
      epoch: flagOptimisticEpoch,
      patches: clearedByUndo
        ? new Map()
        : pruneSyncedProcurementFlagPatches(groups, flagOpt.patches),
    });
  }

  const flagPatches = flagOpt.patches;
  const setFlagPatches = useCallback(
    (
      update:
        | Map<string, ProcurementFlagLinePatch>
        | ((
            prev: Map<string, ProcurementFlagLinePatch>
          ) => Map<string, ProcurementFlagLinePatch>)
    ) => {
      setFlagOpt((prev) => ({
        ...prev,
        patches: typeof update === "function" ? update(prev.patches) : update,
      }));
    },
    []
  );

  const displayGroups = useMemo(
    () => applyProcurementFlagPatchesToGroups(groups, flagPatches),
    [groups, flagPatches]
  );

  const showViaPanelSectionCallout =
    !isStockOutSection && displayGroups.some(groupHasInformacjaFlow);
  const enrichAt = useMemo(
    () =>
      todayDateKey
        ? (parseDateOnly(todayDateKey) ?? todayInWarsaw())
        : todayInWarsaw(),
    [todayDateKey]
  );
  const enrichGroup = useCallback(
    (group: SummaryForSomeoneEnriched) =>
      isStockOutSection
        ? enrichStockOutSignalGroup(group)
        : enrichForSomeoneGroup(group, enrichAt, {
            supplierMeta: supplierMeta[group.supplierId] ?? null,
            todayDateKey,
            weekDays,
          }),
    [enrichAt, isStockOutSection, supplierMeta, todayDateKey, weekDays]
  );
  const unseenVariant: DailyPanelUnseenVariant = isStockOutSection ? "stockOut" : "prosby";
  const [manageFlagsOpen, setManageFlagsOpen] = useState(false);
  /** Puste = wszystkie tory zwinięte (domyślnie); rozwinięcie = pełna lista w torze. */
  const [expandedLanes, setExpandedLanes] = useState<Set<ProcurementRequestLaneId>>(
    () => new Set()
  );
  const [fallbackPrefs, setFallbackPrefs] = useState(() => ({
    defs: procurementFlagDefinitions,
    order: normalizeProcurementLaneOrder(
      procurementLaneOrder,
      procurementFlagDefinitions
    ),
    sourceDefs: procurementFlagDefinitions,
    sourceOrder: procurementLaneOrder,
  }));

  if (
    !lanePrefs &&
    (fallbackPrefs.sourceDefs !== procurementFlagDefinitions ||
      fallbackPrefs.sourceOrder !== procurementLaneOrder)
  ) {
    setFallbackPrefs({
      defs: procurementFlagDefinitions,
      order: normalizeProcurementLaneOrder(
        procurementLaneOrder,
        procurementFlagDefinitions
      ),
      sourceDefs: procurementFlagDefinitions,
      sourceOrder: procurementLaneOrder,
    });
  }

  const localFlagDefinitions =
    lanePrefs?.localFlagDefinitions ?? fallbackPrefs.defs;
  const setLocalFlagDefinitions = useCallback(
    (
      update:
        | ProcurementFlagDefinition[]
        | ((prev: ProcurementFlagDefinition[]) => ProcurementFlagDefinition[])
    ) => {
      if (lanePrefs) {
        lanePrefs.setLocalFlagDefinitions(update);
        return;
      }
      setFallbackPrefs((prev) => ({
        ...prev,
        defs: typeof update === "function" ? update(prev.defs) : update,
      }));
    },
    [lanePrefs]
  );
  const localLaneOrder = lanePrefs?.localLaneOrder ?? fallbackPrefs.order;
  const setLocalLaneOrder = useCallback(
    (
      update:
        | ProcurementRequestLaneId[]
        | ((prev: ProcurementRequestLaneId[]) => ProcurementRequestLaneId[])
    ) => {
      if (lanePrefs) {
        lanePrefs.setLocalLaneOrder(update);
        return;
      }
      setFallbackPrefs((prev) => ({
        ...prev,
        order: typeof update === "function" ? update(prev.order) : update,
      }));
    },
    [lanePrefs]
  );

  const flagSortById = useMemo(
    () => buildFlagSortOrderMap(localFlagDefinitions),
    [localFlagDefinitions]
  );
  const { groupKey, isGroupUnseen, markGroupSeen, scheduleMarkSeen, cancelMarkSeen } =
    useProcurementSeenTracker(laneVariant);

  const laneBuckets = useMemo(
    () => {
      if (isStockOutSection) return [];
      return partitionForSomeoneGroups(displayGroups, {
        variant: laneVariant,
        suppliersOnVacationNow,
        flagSortById,
        flagDefinitions: localFlagDefinitions,
        laneOrder: localLaneOrder,
      }).map((bucket) => ({
        ...bucket,
        groups: sortForSomeoneGroups(bucket.groups, flagSortById),
      }));
    },
    [
      isStockOutSection,
      displayGroups,
      laneVariant,
      suppliersOnVacationNow,
      flagSortById,
      localFlagDefinitions,
      localLaneOrder,
    ]
  );

  const visibleLaneIds = useMemo(
    () => laneBuckets.map((b) => b.laneId),
    [laneBuckets]
  );

  const laneNavItems = useMemo(
    () =>
      laneBuckets.map((b) => ({
        laneId: b.laneId,
        anchorId: procurementLaneAnchorId(laneVariant, b.laneId),
        count: b.groups.length,
        label: b.label,
        tone: resolveProcurementRequestLaneTone(b.color),
      })),
    [laneBuckets, laneVariant]
  );

  const flagShortcuts = useMemo(
    () =>
      [...localFlagDefinitions]
        .filter((d) => d.isActive)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl")
        )
        .map((def) => ({
          flagId: def.id,
          label: def.label.trim(),
          color: def.color,
        })),
    [localFlagDefinitions]
  );

  const laneCtx = useMemo(
    () => ({
      variant: laneVariant,
      suppliersOnVacationNow,
      flagSortById,
    }),
    [laneVariant, suppliersOnVacationNow, flagSortById]
  );

  const reorderActiveFlags = useCallback(
    (fromActiveIndex: number, dir: -1 | 1) => {
      const prevDefs = localFlagDefinitions;
      const prevOrder = localLaneOrder;
      const result = reorderActiveFlagDefinitions(prevDefs, fromActiveIndex, dir);
      if (!result) return;
      const activeIds = result.definitions
        .filter((d) => d.isActive)
        .map((d) => d.id);
      const nextOrder = replaceActiveFlagSequenceInLaneOrder(prevOrder, activeIds);
      setLocalFlagDefinitions(result.definitions);
      setLocalLaneOrder(nextOrder);
      run(
        async () => {
          await actionReorderProcurementFlagsAndLaneOrder(
            result.orderedIds,
            serializeProcurementLaneOrder(nextOrder)
          );
          return { success: true };
        },
        PROCUREMENT_REQUEST_LANE_COPY.flagOrderToast,
        "Zapisywanie kolejności…",
        {
          scope: "__flag_defs_order__",
          overlay: false,
          onError: () => {
            setLocalFlagDefinitions(prevDefs);
            setLocalLaneOrder(prevOrder);
          },
        }
      );
    },
    [localFlagDefinitions, localLaneOrder, run, setLocalFlagDefinitions, setLocalLaneOrder]
  );

  const moveLane = useCallback(
    (laneId: ProcurementRequestLaneId, dir: -1 | 1) => {
      const prevOrder = localLaneOrder;
      const next = moveVisibleLaneInOrder(prevOrder, laneId, dir, visibleLaneIds);
      if (!next) return;
      setLocalLaneOrder(next);
      run(
        () =>
          actionSetProcurementLaneOrder(serializeProcurementLaneOrder(next)),
        PROCUREMENT_REQUEST_LANE_COPY.flagOrderToast,
        "Zapisywanie kolejności…",
        {
          scope: "__flag_defs_order__",
          overlay: false,
          onError: () => setLocalLaneOrder(prevOrder),
        }
      );
    },
    [localLaneOrder, run, setLocalLaneOrder, visibleLaneIds]
  );

  const ensureLaneExpanded = useCallback((laneId: ProcurementRequestLaneId) => {
    if (isStockOutSection) return;
    setExpandedLanes((prev) => {
      if (prev.has(laneId)) return prev;
      const next = new Set(prev);
      next.add(laneId);
      return next;
    });
  }, [isStockOutSection]);

  const navigateToLane = useCallback(
    (laneId: ProcurementRequestLaneId, anchorId: string) => {
      ensureLaneExpanded(laneId);
      const scroll = () => {
        document
          .getElementById(anchorId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      scroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(scroll);
      });
    },
    [ensureLaneExpanded]
  );

  const unanimousGroupFlagNote = useCallback(
    (lines: SummaryForSomeoneEnriched["lines"]): string | null => {
      if (!lines.length) return null;
      const notes = lines.map((l) => l.procurementFlagNote?.trim() || null);
      const first = notes[0] ?? null;
      return notes.every((n) => n === first) ? first : null;
    },
    []
  );

  type LaneBlockRow = {
    laneId: ProcurementRequestLaneId;
    anchorId: string;
    label: string;
    tone: ReturnType<typeof resolveProcurementRequestLaneTone>;
    blocks: ProcurementSupplierBlock[];
  };

  /** Brak na stanie: jedna płaska lista (bez torów / filtrów). Prośby: bloki per tor. */
  const stockOutBlocks = useMemo(() => {
    if (!isStockOutSection) return [] as ProcurementSupplierBlock[];
    return buildProcurementSupplierBlocks(
      sortForSomeoneGroups(displayGroups, flagSortById),
      flagSortById
    );
  }, [isStockOutSection, displayGroups, flagSortById]);

  const laneBlockRows: LaneBlockRow[] = useMemo(
    () =>
      laneBuckets.map((bucket) => ({
        laneId: bucket.laneId,
        anchorId: procurementLaneAnchorId(laneVariant, bucket.laneId),
        label: bucket.label,
        tone: resolveProcurementRequestLaneTone(bucket.color),
        blocks: buildProcurementSupplierBlocks(bucket.groups, flagSortById),
      })),
    [laneBuckets, laneVariant, flagSortById]
  );

  const supplierBlocks = useMemo(
    () => (isStockOutSection ? stockOutBlocks : laneBlockRows.flatMap((row) => row.blocks)),
    [isStockOutSection, stockOutBlocks, laneBlockRows]
  );

  const listSections = useMemo(() => {
    if (isStockOutSection) {
      return [
        {
          key: "stock-out-flat",
          showLaneChrome: false as const,
          laneId: null as ProcurementRequestLaneId | null,
          anchorId: undefined as string | undefined,
          label: "",
          tone: "amber" as ReturnType<typeof resolveProcurementRequestLaneTone>,
          blocks: stockOutBlocks,
        },
      ];
    }
    return laneBlockRows.map((row) => ({
      key: row.laneId,
      showLaneChrome: true as const,
      laneId: row.laneId as ProcurementRequestLaneId | null,
      anchorId: row.anchorId as string | undefined,
      label: row.label,
      tone: row.tone,
      blocks: row.blocks,
    }));
  }, [isStockOutSection, stockOutBlocks, laneBlockRows]);

  const forceExpandedSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of supplierBlocks) {
      if (block.requestGroups.some((g) => isGroupUnseen(g))) {
        ids.add(block.supplierId);
      }
    }
    return ids;
  }, [supplierBlocks, isGroupUnseen]);
  const {
    collapsibleBlocks,
    collapsedSuppliers,
    allSupplierBlocksExpanded,
    toggleSupplierCollapse,
    setAllSupplierBlocksExpanded,
  } = useProcurementSupplierCollapse(supplierBlocks, forceExpandedSupplierIds);

  const navigableGroups = useMemo(() => {
    if (isStockOutSection) {
      return filterNavigableProcurementGroups(stockOutBlocks, collapsedSuppliers);
    }
    const out: SummaryForSomeoneEnriched[] = [];
    for (const row of laneBlockRows) {
      const laneExpanded = isProcurementLaneExpanded(row.laneId, expandedLanes);
      const displayBlocks = procurementLaneDisplayBlocks(
        row.blocks,
        laneExpanded,
        flagSortById
      );
      /** Peek: ignoruj zwinięcie bloku dostawcy — karty nowych muszą zostać w nawigacji. */
      const supplierCollapseForNav = laneExpanded
        ? collapsedSuppliers
        : new Set<string>();
      out.push(
        ...filterNavigableProcurementGroups(displayBlocks, supplierCollapseForNav)
      );
    }
    return out;
  }, [
    isStockOutSection,
    stockOutBlocks,
    laneBlockRows,
    expandedLanes,
    collapsedSuppliers,
    flagSortById,
  ]);

  const unseenGroupCount = useMemo(
    () => displayGroups.filter((g) => isGroupUnseen(g)).length,
    [displayGroups, isGroupUnseen]
  );
  const multiLineKeys = useMemo(
    () => navigableGroups.filter((g) => g.lines.length >= 2).map((g) => groupKey(g)),
    [navigableGroups, groupKey]
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [flagEditTarget, setFlagEditTarget] = useState<{
    lines: SummaryForSomeoneEnriched["lines"];
    initialOrderIds?: string[];
    initialFlag?: ProcurementRequestFlag | null;
    initialNote?: string | null;
    scopeKey: string;
  } | null>(null);

  const openFlagEditor = useCallback(
    (
      group: SummaryForSomeoneEnriched,
      opts?: { orderId?: string }
    ) => {
      const summary = summarizeGroupProcurementFlags(
        group.lines,
        flagSortById
      );
      const line =
        opts?.orderId != null
          ? group.lines.find((l) => l.id === opts.orderId)
          : null;
      const flaggedIds =
        summary.kind === "none" ? [] : summary.orderIds;
      setFlagEditTarget({
        lines: group.lines,
        initialOrderIds: opts?.orderId
          ? [opts.orderId]
          : group.lines.length === 1
            ? [group.lines[0]!.id]
            : flaggedIds.length > 0
              ? flaggedIds
              : group.orderIds,
        initialFlag: line?.procurementFlag
          ?? (summary.kind === "single" ? summary.flag : null),
        initialNote: line?.procurementFlagNote
          ?? (summary.kind === "single" ? summary.note : null),
        scopeKey: groupKey(group),
      });
    },
    [flagSortById, groupKey]
  );

  const applyFlagPatchesLocally = useCallback(
    (orderIds: string[], flag: string | null, note: string | null = null) => {
      const incoming = buildProcurementFlagPatchesForOrderIds(orderIds, flag, note);
      setFlagPatches((prev) => mergeProcurementFlagPatchMaps(prev, incoming));
      return () => {
        setFlagPatches((prev) => omitProcurementFlagPatches(prev, orderIds));
      };
    },
    [setFlagPatches]
  );

  const applyGroupFlag = useCallback(
    (group: SummaryForSomeoneEnriched, flag: string | null) => {
      const key = groupKey(group);
      /** Skrót nie może kasować opisu — backend i tak ustawia jedną notatkę na batch. */
      const note = flag == null ? null : unanimousGroupFlagNote(group.lines);
      const revert = applyFlagPatchesLocally(group.orderIds, flag, note);
      const patchedGroup = {
        ...group,
        lines: group.lines.map((line) =>
          group.orderIds.includes(line.id)
            ? { ...line, procurementFlag: flag, procurementFlagNote: note }
            : line
        ),
      };
      ensureLaneExpanded(assignProcurementRequestLane(patchedGroup, laneCtx));
      run(
        () => actionSetProcurementRequestFlags(group.orderIds, flag, note),
        flag == null
          ? PROCUREMENT_REQUEST_LANE_COPY.flagClearedToast
          : PROCUREMENT_REQUEST_LANE_COPY.flagSetToast,
        "Zapisywanie flagi…",
        { scope: key, overlay: false, onError: revert }
      );
    },
    [
      applyFlagPatchesLocally,
      ensureLaneExpanded,
      groupKey,
      laneCtx,
      run,
      unanimousGroupFlagNote,
    ]
  );

  const toggleLaneCollapsed = useCallback((laneId: ProcurementRequestLaneId) => {
    setExpandedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  }, []);

  const saveFlagEdit = useCallback(
    (result: ProcurementRequestFlagEditResult) => {
      if (!flagEditTarget) return;
      const scope = flagEditTarget.scopeKey;
      const revert = applyFlagPatchesLocally(
        result.orderIds,
        result.flag,
        result.note
      );
      const targetGroup = displayGroups.find((g) => groupKey(g) === scope);
      if (targetGroup) {
        const idSet = new Set(result.orderIds);
        const patchedGroup = {
          ...targetGroup,
          lines: targetGroup.lines.map((line) =>
            idSet.has(line.id)
              ? {
                  ...line,
                  procurementFlag: result.flag,
                  procurementFlagNote: result.note,
                }
              : line
          ),
        };
        ensureLaneExpanded(assignProcurementRequestLane(patchedGroup, laneCtx));
      }
      run(
        () =>
          actionSetProcurementRequestFlags(
            result.orderIds,
            result.flag,
            result.note
          ),
        result.flag == null
          ? PROCUREMENT_REQUEST_LANE_COPY.flagClearedToast
          : PROCUREMENT_REQUEST_LANE_COPY.flagSetToast,
        "Zapisywanie flagi…",
        {
          scope,
          overlay: false,
          onSuccess: () => setFlagEditTarget(null),
          onError: revert,
        }
      );
    },
    [
      applyFlagPatchesLocally,
      displayGroups,
      ensureLaneExpanded,
      flagEditTarget,
      groupKey,
      laneCtx,
      run,
    ]
  );

  const allExpanded =
    multiLineKeys.length > 0 && multiLineKeys.every((k) => expanded.has(k));

  const setAll = useCallback(
    (open: boolean) => {
      setExpanded(open ? new Set(multiLineKeys) : new Set());
    },
    [multiLineKeys]
  );

  const toggleGroupProductsExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** Otwórz blok dostawcy (jeśli zwinięty) i rozwiń wszystkie wielopozycyjne prośby w grupie. */
  const expandSupplierBlockFully = useCallback(
    (block: ProcurementSupplierBlock) => {
      if (collapsedSuppliers.has(block.supplierId)) {
        toggleSupplierCollapse(block.supplierId);
      }
      const keys = block.requestGroups
        .filter((g) => g.lines.length >= 2)
        .map((g) => groupKey(g));
      if (keys.length === 0) return;
      setExpanded((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const k of keys) {
          if (!next.has(k)) {
            next.add(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [collapsedSuppliers, toggleSupplierCollapse, groupKey]
  );

  const collapseProductsInBlock = useCallback(
    (block: ProcurementSupplierBlock) => {
      const keys = block.requestGroups
        .filter((g) => g.lines.length >= 2)
        .map((g) => groupKey(g));
      if (keys.length === 0) return;
      setExpanded((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const k of keys) {
          if (next.delete(k)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [groupKey]
  );

  /**
   * Klik w nagłówek grupy:
   * 1) zwinięty → rozwiń blok + produkty
   * 2) otwarty, produkty zwinięte → rozwiń produkty
   * 3) wszystko otwarte → zwiń blok (albo tylko produkty, gdy collapse zablokowany przez „Nowa”)
   */
  const toggleSupplierBlockHeader = useCallback(
    (
      block: ProcurementSupplierBlock,
      isCollapsed: boolean,
      options?: { allowBlockCollapse?: boolean }
    ) => {
      if (isCollapsed) {
        expandSupplierBlockFully(block);
        return;
      }
      const multiKeys = block.requestGroups
        .filter((g) => g.lines.length >= 2)
        .map((g) => groupKey(g));
      const productsFullyOpen =
        multiKeys.length === 0 || multiKeys.every((k) => expanded.has(k));
      if (!productsFullyOpen) {
        expandSupplierBlockFully(block);
        return;
      }
      const allowBlockCollapse = options?.allowBlockCollapse !== false;
      const blockHasLocalUnseen = block.requestGroups.some((g) =>
        isGroupUnseen(g)
      );
      const canCollapseBlock =
        allowBlockCollapse &&
        !blockHasLocalUnseen &&
        !forceExpandedSupplierIds.has(block.supplierId);
      if (canCollapseBlock) {
        toggleSupplierCollapse(block.supplierId);
      } else {
        collapseProductsInBlock(block);
      }
    },
    [
      expandSupplierBlockFully,
      collapseProductsInBlock,
      toggleSupplierCollapse,
      groupKey,
      expanded,
      forceExpandedSupplierIds,
      isGroupUnseen,
    ]
  );

  const queueToolbarActions = (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {unseenGroupCount > 0 ? (
        <Badge className={cn("h-7 shrink-0 px-2 text-[11px] font-semibold", dailyPanelUnseenBadgeClass(unseenVariant))}>
          {unseenGroupCount}{" "}
          {unseenGroupCount === 1
            ? "nowy"
            : unseenGroupCount >= 2 && unseenGroupCount <= 4
              ? "nowe"
              : "nowych"}
        </Badge>
      ) : null}
      {collapsibleBlocks.length > 0 && !isStockOutSection ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => {
            const nextExpanded = !allSupplierBlocksExpanded;
            if (nextExpanded) {
              setExpandedLanes(new Set(visibleLaneIds));
            }
            setAllSupplierBlocksExpanded(nextExpanded);
          }}
        >
          {allSupplierBlocksExpanded
            ? "Zwiń bloki dostawców"
            : "Rozwiń bloki dostawców"}
        </Button>
      ) : null}
      {multiLineKeys.length > 1 ? (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setAll(!allExpanded)}>
          {allExpanded ? "Zwiń wszystkie produkty" : "Pokaż wszystkie produkty"}
        </Button>
      ) : null}
      {isStockOutSection ? <StockOutSectionHelp /> : <ForSomeoneRequestsSectionHelp />}
    </div>
  );

  const flagLaneNav = (
    <ProcurementRequestLaneNav
      items={laneNavItems}
      onManageClick={() => setManageFlagsOpen(true)}
      onLaneNavigate={navigateToLane}
    />
  );
  const [cancelTarget, setCancelTarget] = useState<{
    orderIds: string[];
    headline: string;
    scopeKey: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    orderIds: string[];
    initial: EditIndividualRequestInitial;
    scopeKey: string;
  } | null>(null);
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);

  const resolvedFocusedGroupKey = useMemo(() => {
    if (!focusedGroupKey) return null;
    return navigableGroups.some((g) => groupKey(g) === focusedGroupKey)
      ? focusedGroupKey
      : null;
  }, [focusedGroupKey, navigableGroups, groupKey]);

  const focusedGroup = useMemo(() => {
    if (!resolvedFocusedGroupKey) return null;
    return navigableGroups.find((g) => groupKey(g) === resolvedFocusedGroupKey) ?? null;
  }, [resolvedFocusedGroupKey, navigableGroups, groupKey]);

  useEffect(() => {
    if (!focusedGroup) return;
    scheduleMarkSeen(focusedGroup);
  }, [focusedGroup, scheduleMarkSeen]);

  useEffect(() => {
    if (!resolvedFocusedGroupKey) return;
    document
      .querySelector<HTMLElement>(
        `[data-procurement-group="${CSS.escape(resolvedFocusedGroupKey)}"]`
      )
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [resolvedFocusedGroupKey]);

  useEffect(() => {
    if (editTarget || cancelTarget || flagEditTarget || !navigableGroups.length) return;

    const onKey = (e: KeyboardEvent) => {
      const root = sectionRootRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      const active = document.activeElement;
      const inside =
        (target && root.contains(target)) ||
        (active instanceof Node && root.contains(active)) ||
        root.matches(":hover");
      if (!inside && !resolvedFocusedGroupKey) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === "Escape") {
        setFocusedGroupKey(null);
        return;
      }

      const currentIndex = resolvedFocusedGroupKey
        ? navigableGroups.findIndex((g) => groupKey(g) === resolvedFocusedGroupKey)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(
          navigableGroups.length - 1,
          currentIndex < 0 ? 0 : currentIndex + 1
        );
        const g = navigableGroups[next];
        setFocusedGroupKey(g ? groupKey(g) : null);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);
        const g = navigableGroups[next];
        setFocusedGroupKey(g ? groupKey(g) : null);
        return;
      }

      if (!focusedGroup) return;
      const group = focusedGroup;
      const key = groupKey(group);

      if (e.key === "Enter") {
        if (group.lines.length < 2) return;
        e.preventDefault();
        toggleGroupProductsExpanded(key);
        return;
      }

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        markGroupSeen(group);
        setEditTarget({
          orderIds: group.orderIds,
          initial: editInitialFromForSomeoneGroup(group),
          scopeKey: key,
        });
        return;
      }

      if ((e.key === "g" || e.key === "G") && e.shiftKey) {
        e.preventDefault();
        const glowneConfirm = group.supplierOrderOnDemand
          ? `Oznaczyć prośbę u ${group.supplierName} (${group.person}) jako główne bez terminu planowego?`
          : `Oznaczyć prośbę u ${group.supplierName} (${group.person}) jako zamówienie główne?`;
        if (!window.confirm(glowneConfirm)) {
          return;
        }
        run(
          () => actionProcessIndividual(group.orderIds, "GLOWNE"),
          group.supplierOrderOnDemand
            ? "Oznaczono jako główne (bez terminu planowego)"
            : "Oznaczono jako zamówienie główne",
          "Oznaczanie jako główne…",
          { scope: key }
        );
        return;
      }

      if ((e.key === "u" || e.key === "U") && e.shiftKey) {
        e.preventDefault();
        if (
          !window.confirm(
            `Oznaczyć prośbę u ${group.supplierName} (${group.person}) jako uzupełniające?`
          )
        ) {
          return;
        }
        run(
          () => actionProcessIndividual(group.orderIds, "POBOCZNE"),
          "Oznaczono jako uzupełniające",
          "Oznaczanie jako uzupełniające…",
          { scope: key }
        );
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    navigableGroups,
    focusedGroup,
    resolvedFocusedGroupKey,
    editTarget,
    cancelTarget,
    flagEditTarget,
    run,
    markGroupSeen,
    groupKey,
    toggleGroupProductsExpanded,
  ]);

  const Wrapper = "section";
  const wrapperProps = {
    id: sectionId,
    ref: sectionRootRef,
    "data-daily-panel-requests-root": laneVariant,
    className: cn(
      dailyPanelQueueSectionScrollClass,
      dailyPanelQueueShellClass(isStockOutSection ? "stockOut" : "prosby")
    ),
  };

  const subsectionHeader = (
    <DailyPanelSubsectionBar
      title={isStockOutSection ? "Brak na stanie — do zamówienia" : "Prośby handlowców"}
      description={
        isStockOutSection ? INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT : undefined
      }
      tone={isStockOutSection ? "stockOut" : "prosby"}
      step={queueStep}
      count={groups.length}
      countUnit={
        isStockOutSection
          ? { one: "sygnał", few: "sygnały", many: "sygnałów" }
          : { one: "grupa", few: "grupy", many: "grup" }
      }
      compact={!isStockOutSection}
      action={queueToolbarActions}
    />
  );
  return (
    <Wrapper {...wrapperProps}>
      <EditIndividualRequestModal
        open={editTarget !== null}
        mode="procurement"
        orderIds={editTarget?.orderIds ?? []}
        initial={editTarget?.initial ?? null}
        suppliers={suppliers}
        salesPeople={salesPeople}
        suppliersOnVacationNow={suppliersOnVacationNow}
        onClose={() => setEditTarget(null)}
        onSaved={(msg) =>
          run(
            async () => ({ success: true as const }),
            msg,
            "Odświeżanie panelu…",
            editTarget
              ? { scope: `${editTarget.scopeKey}:edit`, overlay: false }
              : { overlay: false }
          )
        }
      />
      <ProcurementRequestFlagEditModal
        open={flagEditTarget !== null}
        lines={flagEditTarget?.lines ?? []}
        definitions={localFlagDefinitions}
        initialOrderIds={flagEditTarget?.initialOrderIds}
        initialFlag={flagEditTarget?.initialFlag}
        initialNote={flagEditTarget?.initialNote}
        pending={
          flagEditTarget
            ? isScopePending(flagEditTarget.scopeKey)
            : false
        }
        onCancel={() => setFlagEditTarget(null)}
        onConfirm={saveFlagEdit}
      />
      <ProcurementFlagDefinitionsManageModal
          open={manageFlagsOpen}
          definitions={localFlagDefinitions}
          onClose={() => setManageFlagsOpen(false)}
          onError={(message) => notify?.(message, "error")}
          onSuccess={(message) => notify?.(message, "success")}
          onReorderActive={reorderActiveFlags}
          reorderPending={isScopePending("__flag_defs_order__")}
        />
      <ProcurementCancelDialog
        open={cancelTarget !== null}
        title="Anulować prośbę?"
        headline={cancelTarget?.headline}
        message="Cofnięcie przywraca status w systemie. E-mail do handlowca mógł już zostać wysłany."
        confirmLabel="Anuluj prośbę"
        tier={editTarget ? "stack" : "raised"}
        pending={cancelTarget ? isScopePending(cancelTarget.scopeKey) : false}
        onCancel={() => setCancelTarget(null)}
        onConfirm={(note) => {
          if (!cancelTarget) return;
          const { orderIds, scopeKey } = cancelTarget;
          run(
            () => actionProcessIndividual(orderIds, "ANULOWANO", note),
            "Anulowano prośbę",
            "Anulowanie prośby…",
            { scope: scopeKey, onSuccess: () => setCancelTarget(null) }
          );
        }}
      />
      {subsectionHeader}
      {!isStockOutSection ? flagLaneNav : null}

      {!showViaPanelSectionCallout ? null : (
        <InformacjaViaPanelProcurementCallout className="mx-0" />
      )}

      {groups.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-slate-500">
          {isStockOutSection
            ? "Brak sygnałów stock-out."
            : "Brak próśb w tej sekcji."}
        </p>
      ) : null}

      <div className={procurementRequestLanesBodyClass}>
        {listSections.map((laneRow) => {
          const showLaneChrome = laneRow.showLaneChrome;
          const laneExpanded =
            !showLaneChrome ||
            laneRow.laneId == null ||
            isProcurementLaneExpanded(laneRow.laneId, expandedLanes);
          const laneGroupCount = countProcurementBlockGroups(laneRow.blocks);
          const displayBlocks = showLaneChrome
            ? procurementLaneDisplayBlocks(
                laneRow.blocks,
                laneExpanded,
                flagSortById
              )
            : laneRow.blocks;
          const peekGroupCount = laneExpanded
            ? 0
            : countProcurementBlockGroups(displayBlocks);
          const laneChrome = showLaneChrome
            ? resolveProcurementLaneChrome({
                laneExpanded,
                totalGroupCount: laneGroupCount,
                peekGroupCount,
                peekHint: PROCUREMENT_REQUEST_LANE_COPY.laneCollapsedPeekHint,
                allNewHint: PROCUREMENT_REQUEST_LANE_COPY.laneCollapsedAllNewHint,
                emptyCollapsedHint:
                  PROCUREMENT_REQUEST_LANE_COPY.laneCollapsedEmptyHint,
              })
            : null;
          const laneCollapsed = Boolean(laneChrome?.chromeCollapsed);
          const laneBodyOpen = laneChrome?.bodyOpen ?? true;
          const fullBlocksBySupplier = showLaneChrome
            ? new Map(laneRow.blocks.map((b) => [b.supplierId, b]))
            : null;
          const blocksList = (
                <ul className={procurementRequestLaneContentClass}>
                  {displayBlocks.map((block) => {
                    const showSupplierHeader = showProcurementSupplierBlockHeader(block);
                    /** W peeku zwiniętego toru zawsze pokazuj karty — zwijanie bloku tylko w pełnym torze. */
                    const supplierCollapsed =
                      showSupplierHeader &&
                      laneExpanded &&
                      collapsedSuppliers.has(block.supplierId);
                    const blockMultiKeys = showSupplierHeader
                      ? block.requestGroups
                          .filter((g) => g.lines.length >= 2)
                          .map((g) => groupKey(g))
                      : [];
                    const blockProductsFullyOpen =
                      blockMultiKeys.length === 0 ||
                      blockMultiKeys.every((k) => expanded.has(k));
                    const blockHasLocalUnseen = block.requestGroups.some((g) =>
                      isGroupUnseen(g)
                    );
                    const blockCanCollapse =
                      showSupplierHeader &&
                      laneExpanded &&
                      !blockHasLocalUnseen &&
                      !forceExpandedSupplierIds.has(block.supplierId);
                    const blockHeaderHint = !showSupplierHeader
                      ? undefined
                      : supplierCollapsed
                        ? ("expand-all" as const)
                        : !blockProductsFullyOpen
                          ? ("expand-products" as const)
                          : blockCanCollapse
                            ? ("collapse-block" as const)
                            : ("collapse-products" as const);
                    const blockStats = statsBySupplierId[block.supplierId];
                    const blockStatsMode = supplierStatsMode[block.supplierId] ?? "LACZNIE";
                    const blockLeadTimeBrief =
                      showSupplierHeader && blockStats
                        ? formatSupplierLeadTimeBrief(blockStats, blockStatsMode)
                        : null;
                    const blockScopeKey = procurementSupplierBlockScopeKey(block.supplierId);
                    const blockPending = isScopePending(blockScopeKey);
                    const blockPlannedOrderDate =
                      showSupplierHeader && !isStockOutSection
                        ? plannedOrderDateForSupplier(supplierMeta[block.supplierId] ?? null, {
                            todayDateKey,
                            weekDays,
                            supplierId: block.supplierId,
                          })
                        : null;
                    const peekPartialOrder =
                      showLaneChrome &&
                      isProcurementLanePeekPartialSupplier({
                        laneExpanded,
                        fullBlock: fullBlocksBySupplier?.get(block.supplierId),
                        displayBlock: block,
                      });
                    const orderScopeNote = peekPartialOrder
                      ? PROCUREMENT_REQUEST_LANE_COPY.lanePeekOrderScopeNote
                      : null;

                    return (
                      <li
                        key={`${laneRow.key}-${block.supplierId}`}
                        className={cn(
                          showSupplierHeader &&
                            procurementRequestLaneSupplierShellClass(unseenVariant)
                        )}
                        aria-label={`Dostawca ${block.supplierName}`}
                      >
                        {showSupplierHeader ? (
                          <ProcurementSupplierBlockBar
                            block={block}
                            collapsed={supplierCollapsed}
                            leadTimeBrief={blockLeadTimeBrief}
                            pending={blockPending}
                            run={run}
                            unseenGroupCount={block.requestGroups.filter((g) => isGroupUnseen(g)).length}
                            unseenPeopleNames={block.requestGroups
                              .filter((g) => isGroupUnseen(g))
                              .map((g) => g.person)}
                            unseenVariant={unseenVariant}
                            plannedOrderDate={blockPlannedOrderDate}
                            vacationWindow={
                              suppliersOnVacationNow[block.supplierId] ?? null
                            }
                            flagDefinitions={localFlagDefinitions}
                            onToggleCollapse={() =>
                              toggleSupplierBlockHeader(block, supplierCollapsed, {
                                allowBlockCollapse: laneExpanded,
                              })
                            }
                            headerActionHint={blockHeaderHint}
                            onOpenSupplier={onOpenSupplier}
                            orderScopeNote={orderScopeNote}
                          />
                        ) : null}
                        {!supplierCollapsed ? (
                          <ul
                            className={cn(
                              showSupplierHeader &&
                                procurementRequestLaneSupplierInnerListClass(unseenVariant)
                            )}
                          >
                            {block.requestGroups.map((g) => {
                              const key = groupKey(g);
                              const groupPending = isScopePending(key) || blockPending;
                              const isFocused = resolvedFocusedGroupKey === key;
                              const ui = enrichGroup(g);
                              const isUnseen = isGroupUnseen(g);
                              const stats = statsBySupplierId[g.supplierId];
                              const statsMode = supplierStatsMode[g.supplierId] ?? "LACZNIE";
                              const leadTimeBrief = stats
                                ? formatSupplierLeadTimeBrief(stats, statsMode)
                                : null;
                              const hasInfoViaPanel =
                                !isStockOutSection && g.lines.some((l) => l.informacjaViaPanel);
                              const statusBadgeVariant = isStockOutSection
                                ? "warning"
                                : hasInfoViaPanel
                                  ? "info"
                                  : "default";
                              const showStatusBadge =
                                Boolean(ui.statusTitle?.trim()) && !hasInfoViaPanel;
                              const singleLine = g.lines.length === 1 ? g.lines[0]! : null;
                              const hasMultiLine = g.lines.length >= 2;
                              const isOpen = hasMultiLine && expanded.has(key);
                              const previewLine = hasMultiLine && !isOpen ? g.lines[0]! : null;
                              const moreProductsCount = hasMultiLine && !isOpen ? g.lines.length - 1 : 0;
                              const moreProductsLabel =
                                moreProductsCount > 0
                                  ? procurementMoreProductsLabel(moreProductsCount)
                                  : null;
                              const countLabel = procurementProductCountLabel(g.lines.length);
                              const clientLabel = clientNamesSummaryFromLines(g.lines);
                              const sharedGroupNote = hasMultiLine ? procurementGroupRequestNote(g.lines) : null;
                              const suppressLineRequestNote = shouldSuppressProcurementLineRequestNote(sharedGroupNote);
                              const suppressLineClient = shouldSuppressProcurementLineClient(clientLabel);
                              const suppressGroupPlannedOrderDate =
                                shouldSuppressProcurementGroupPlannedOrderDate(showSupplierHeader);
                              const noteSuffix = requestNotesProcurementSublineSuffix(g.lines);
                              const showVacationOnRow =
                                !showSupplierHeader &&
                                Boolean(suppliersOnVacationNow[g.supplierId]);
                              const rowSubline = showSupplierHeader
                                ? procurementNestedRowMeta({
                                    countLabel,
                                    noteSuffix,
                                  })
                                : isStockOutSection
                                  ? ui.subline
                                  : null;
                              const showRowLeadTime = !showSupplierHeader || !blockLeadTimeBrief;
                              const flagSummary = summarizeGroupProcurementFlags(
                                g.lines,
                                flagSortById
                              );
                              const currentFlagId =
                                flagSummary.kind === "single" ? flagSummary.flag : null;

                              const hasFlags = flagSummary.kind !== "none";
                              const showPersonInContext =
                                !isStockOutSection && !showSupplierHeader;
                              const showNestedStockOutPerson =
                                isStockOutSection &&
                                showSupplierHeader &&
                                ui.headline !== g.supplierName;
                              const showStockOutSupplierMeta =
                                isStockOutSection &&
                                !showSupplierHeader &&
                                Boolean(g.supplierId) &&
                                ui.headline !== g.supplierName;
                              const showOnDemandHint =
                                Boolean(g.supplierOrderOnDemand) && !isStockOutSection;
                              const showContextStrip =
                                isUnseen ||
                                showVacationOnRow ||
                                hasFlags ||
                                showPersonInContext ||
                                showNestedStockOutPerson ||
                                showStockOutSupplierMeta ||
                                Boolean(rowSubline) ||
                                showStatusBadge ||
                                (showRowLeadTime && Boolean(leadTimeBrief)) ||
                                showOnDemandHint;
                              const showClientInOrderBody = Boolean(clientLabel);
                              const showOrderBody =
                                Boolean(singleLine) ||
                                hasMultiLine ||
                                Boolean(sharedGroupNote) ||
                                showClientInOrderBody;
                              const orderBodyFlat =
                                Boolean(singleLine) &&
                                !hasMultiLine &&
                                !sharedGroupNote &&
                                !isOpen;

                              const contextTextItems: ReactNode[] = [];
                              if (showPersonInContext) {
                                contextTextItems.push(
                                  <ProcurementRequestContextMetaItem
                                    key="person"
                                    emphasis
                                    showSep={false}
                                  >
                                    {ui.headline}
                                  </ProcurementRequestContextMetaItem>
                                );
                              }
                              if (showNestedStockOutPerson) {
                                contextTextItems.push(
                                  <ProcurementRequestContextMetaItem
                                    key="so-person"
                                    emphasis
                                    showSep={false}
                                  >
                                    {g.person}
                                  </ProcurementRequestContextMetaItem>
                                );
                              }
                              if (showStockOutSupplierMeta) {
                                contextTextItems.push(
                                  <ProcurementRequestContextMetaItem
                                    key="so-sup"
                                    showSep={contextTextItems.length > 0}
                                    className="min-w-0"
                                  >
                                    <button
                                      type="button"
                                      className={cn(
                                        panelTextLinkClass,
                                        "inline-flex min-w-0 max-w-full truncate align-baseline text-left"
                                      )}
                                      onClick={() => onOpenSupplier(g.supplierId)}
                                      aria-label={`Szczegóły dostawcy ${g.supplierName}`}
                                    >
                                      {g.supplierName}
                                    </button>
                                    {rowSubline ? (
                                      <span className="text-slate-500">{` · ${rowSubline}`}</span>
                                    ) : null}
                                  </ProcurementRequestContextMetaItem>
                                );
                              } else if (rowSubline) {
                                contextTextItems.push(
                                  <ProcurementRequestContextMetaItem
                                    key="sub"
                                    showSep={contextTextItems.length > 0}
                                  >
                                    {rowSubline}
                                  </ProcurementRequestContextMetaItem>
                                );
                              }
                              if (showRowLeadTime && leadTimeBrief) {
                                contextTextItems.push(
                                  <ProcurementRequestContextMetaItem
                                    key="eta"
                                    showSep={contextTextItems.length > 0}
                                  >
                                    {leadTimeBrief}
                                  </ProcurementRequestContextMetaItem>
                                );
                              }
                              if (showOnDemandHint) {
                                contextTextItems.push(
                                  <ProcurementRequestContextMetaItem
                                    key="od"
                                    showSep={contextTextItems.length > 0}
                                    className="text-slate-500"
                                    title={PROCUREMENT_GLOWNE_ON_DEMAND_HINT}
                                  >
                                    Na żądanie
                                  </ProcurementRequestContextMetaItem>
                                );
                              }
                              const hasContextChips =
                                isUnseen ||
                                showVacationOnRow ||
                                hasFlags ||
                                showStatusBadge;

                              return (
                                <li key={key}>
                                  <article
                                    data-procurement-group={key}
                                    className={procurementRequestRowClassName({
                                      variant: unseenVariant,
                                      nestedInBlock: showSupplierHeader,
                                      isUnseen,
                                      isFocused,
                                      highlightFresh,
                                      pending: groupPending,
                                      expandable: hasMultiLine,
                                    })}
                                    aria-busy={groupPending}
                                    title={
                                      hasMultiLine
                                        ? isOpen
                                          ? "Kliknij, aby ukryć produkty"
                                          : "Kliknij, aby pokazać wszystkie produkty"
                                        : undefined
                                    }
                                    onMouseEnter={() => scheduleMarkSeen(g)}
                                    onPointerDown={(e) => {
                                      if (e.pointerType === "touch") scheduleMarkSeen(g);
                                    }}
                                    onClick={(e) => {
                                      const t = e.target as HTMLElement;
                                      if (
                                        t.closest(
                                          "button, a, [role='button'], input, textarea, select, [data-no-card-toggle]"
                                        )
                                      ) {
                                        return;
                                      }
                                      scheduleMarkSeen(g);
                                      setFocusedGroupKey(key);
                                      if (hasMultiLine) {
                                        toggleGroupProductsExpanded(key);
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      cancelMarkSeen(g);
                                      panelRowClearFocusOnLeave(e);
                                      if (resolvedFocusedGroupKey === key) setFocusedGroupKey(null);
                                    }}
                                  >
                                    <div
                                      className={
                                        showSupplierHeader
                                          ? procurementRequestCardBodyNestedClass
                                          : procurementRequestCardBodyClass
                                      }
                                    >
                                          <ProcurementRequestCardHeader
                                            title={
                                              <p className={cn(panelTypography.rowTitle, "min-w-0 truncate")}>
                                                {isStockOutSection ? (
                                                  showSupplierHeader ? (
                                                    ui.headline === g.supplierName ? (
                                                      g.person
                                                    ) : (
                                                      ui.headline
                                                    )
                                                  ) : g.supplierId &&
                                                    ui.headline === g.supplierName ? (
                                                    <button
                                                      type="button"
                                                      className={cn(
                                                        procurementSupplierNameLinkClass("stockOut"),
                                                        "max-w-full truncate"
                                                      )}
                                                      onClick={() => onOpenSupplier(g.supplierId)}
                                                      aria-label={`Szczegóły dostawcy ${g.supplierName}`}
                                                    >
                                                      {g.supplierName}
                                                    </button>
                                                  ) : (
                                                    ui.headline
                                                  )
                                                ) : showSupplierHeader ? (
                                                  ui.headline
                                                ) : (
                                                  <button
                                                    type="button"
                                                    className={cn(
                                                      procurementSupplierNameLinkClass("prosby"),
                                                      "max-w-full truncate"
                                                    )}
                                                    onClick={() => onOpenSupplier(g.supplierId)}
                                                  >
                                                    {g.supplierName}
                                                  </button>
                                                )}
                                              </p>
                                            }
                                            trailing={
                                              !suppressGroupPlannedOrderDate && ui.plannedOrderDate ? (
                                                <PlannedOrderDateMeta
                                                  display={ui.plannedOrderDate}
                                                  density="panel"
                                                  className="shrink-0"
                                                />
                                              ) : null
                                            }
                                          />
                                          {showContextStrip ? (
                                            <ProcurementRequestContextBlock
                                              chips={
                                                hasContextChips ? (
                                                  <>
                                                    {isUnseen ? (
                                                      <Badge
                                                        className={cn(
                                                          "w-fit shrink-0 px-1.5 py-0 text-[10px] font-semibold",
                                                          dailyPanelUnseenBadgeClass(unseenVariant)
                                                        )}
                                                      >
                                                        Nowa
                                                      </Badge>
                                                    ) : null}
                                                    {showVacationOnRow ? (
                                                      <SupplierVacationNowChip
                                                        window={
                                                          suppliersOnVacationNow[g.supplierId]!
                                                        }
                                                        className="max-w-full"
                                                      />
                                                    ) : null}
                                                    {hasFlags ? (
                                                      <ProcurementRequestFlagGroupChip
                                                        lines={g.lines}
                                                        definitions={localFlagDefinitions}
                                                        disabled={groupPending}
                                                        onClick={() => openFlagEditor(g)}
                                                        className="max-w-full"
                                                      />
                                                    ) : null}
                                                    {showStatusBadge ? (
                                                      <Badge
                                                        variant={statusBadgeVariant}
                                                        className="w-fit text-[10px]"
                                                      >
                                                        {ui.statusTitle}
                                                      </Badge>
                                                    ) : null}
                                                  </>
                                                ) : null
                                              }
                                              meta={
                                                contextTextItems.length > 0
                                                  ? contextTextItems
                                                  : null
                                              }
                                            />
                                          ) : null}

                                          {showOrderBody ? (
                                            <ProcurementRequestOrderBody
                                              flat={orderBodyFlat}
                                              interactive={Boolean(
                                                singleLine || previewLine || isOpen || hasMultiLine
                                              )}
                                              tone={unseenVariant}
                                            >
                                              {showClientInOrderBody ? (
                                                <ProcurementRequestClientMeta
                                                  clientLabel={clientLabel}
                                                />
                                              ) : null}
                                              {sharedGroupNote ? (
                                                <ProcurementSalesRequestNote
                                                  note={sharedGroupNote}
                                                />
                                              ) : null}
                                              {singleLine ? (
                                                <ProcurementRequestLineInline
                                                  line={singleLine}
                                                  tone={unseenVariant}
                                                  suppressRequestNote={suppressLineRequestNote}
                                                  suppressClient={suppressLineClient || showClientInOrderBody}
                                                />
                                              ) : null}
                                              {previewLine ? (
                                                <ProcurementRequestLineInline
                                                  line={previewLine}
                                                  tone={unseenVariant}
                                                  suppressRequestNote={suppressLineRequestNote}
                                                  suppressClient={suppressLineClient || showClientInOrderBody}
                                                />
                                              ) : null}
                                              {hasMultiLine ? (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className={procurementRequestExpandProductsClass}
                                                  aria-expanded={isOpen}
                                                  onClick={() => {
                                                    setFocusedGroupKey(key);
                                                    toggleGroupProductsExpanded(key);
                                                  }}
                                                >
                                                  <IconChevronRight
                                                    size={14}
                                                    strokeWidth={2.25}
                                                    className={cn(
                                                      "mr-1 shrink-0 text-slate-400 transition-transform",
                                                      isOpen && "rotate-90"
                                                    )}
                                                    aria-hidden
                                                  />
                                                  {isOpen
                                                    ? "Ukryj produkty"
                                                    : moreProductsLabel
                                                      ? `${moreProductsLabel} · pokaż wszystkie`
                                                      : `Produkty (${g.lines.length})`}
                                                </Button>
                                              ) : null}
                                              {isOpen ? (
                                                <ul className="min-w-0">
                                                  {g.lines.map((line) => (
                                                    <ProcurementRequestLine
                                                      key={line.id}
                                                      line={line}
                                                      inOrderBody
                                                      tone={unseenVariant}
                                                      suppressRequestNote={suppressLineRequestNote}
                                                      suppressClient={
                                                        suppressLineClient || showClientInOrderBody
                                                      }
                                                      flagSlot={
                                                        line.procurementFlag ? (
                                                          <ProcurementRequestFlagChip
                                                            flag={line.procurementFlag}
                                                            note={line.procurementFlagNote}
                                                            definitions={localFlagDefinitions}
                                                            disabled={groupPending}
                                                            onClick={() =>
                                                              openFlagEditor(g, {
                                                                orderId: line.id,
                                                              })
                                                            }
                                                          />
                                                        ) : null
                                                      }
                                                    />
                                                  ))}
                                                </ul>
                                              ) : null}
                                            </ProcurementRequestOrderBody>
                                          ) : null}
                                    </div>
                                    <ProcurementRequestActionsFooter
                                      forceVisible={groupPending || isFocused}
                                      className={
                                        showSupplierHeader
                                          ? procurementRequestCardFooterNestedClass
                                          : procurementRequestCardFooterClass
                                      }
                                    >
                                            <IndividualRequestActionBar
                                              orderIds={g.orderIds}
                                              supplierId={g.supplierId || null}
                                              hasInfoViaPanel={hasInfoViaPanel}
                                              supplierOrderOnDemand={g.supplierOrderOnDemand}
                                              headline={ui.headline}
                                              pending={groupPending}
                                              scopeKey={key}
                                              run={run}
                                              density={showSupplierHeader ? "nested" : "default"}
                                              tone={unseenVariant}
                                              hasFlag={Boolean(currentFlagId) || flagSummary.kind === "mixed"}
                                              currentFlagId={currentFlagId}
                                              onSetFlag={() => openFlagEditor(g)}
                                              flagShortcuts={flagShortcuts}
                                              onSetFlagShortcut={(flagId) =>
                                                applyGroupFlag(g, flagId)
                                              }
                                              onClearFlag={() => applyGroupFlag(g, null)}
                                              onOpenSupplierDetails={
                                                g.supplierId
                                                  ? () => onOpenSupplier(g.supplierId)
                                                  : undefined
                                              }
                                              onEdit={() => {
                                                markGroupSeen(g);
                                                setEditTarget({
                                                  orderIds: g.orderIds,
                                                  initial: editInitialFromForSomeoneGroup(g),
                                                  scopeKey: key,
                                                });
                                              }}
                                              onCancel={() =>
                                                setCancelTarget({
                                                  orderIds: g.orderIds,
                                                  headline: ui.headline,
                                                  scopeKey: key,
                                                })
                                              }
                                            />
                                    </ProcurementRequestActionsFooter>
                                  </article>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
          );

          if (!showLaneChrome) {
            return (
              <div key={laneRow.key}>{blocksList}</div>
            );
          }

          const laneId = laneRow.laneId!;
          return (
            <section
              key={laneRow.key}
              id={laneRow.anchorId}
              className={cn(
                "scroll-mt-36",
                procurementRequestLaneShellClass(laneRow.tone)
              )}
            >
              <ProcurementRequestLaneHeader
                label={laneRow.label}
                count={laneGroupCount}
                countLabel={laneChrome?.countLabel}
                collapsed={laneCollapsed}
                tone={laneRow.tone}
                hint={procurementRequestLaneHint(laneId)}
                collapsedHint={laneChrome?.subtitle}
                peekUnseenCount={laneChrome?.peekGroupCount ?? 0}
                onToggle={() => toggleLaneCollapsed(laneId)}
                canMoveUp={canMoveVisibleLane(visibleLaneIds, laneId, -1)}
                canMoveDown={canMoveVisibleLane(visibleLaneIds, laneId, 1)}
                movePending={isScopePending("__flag_defs_order__")}
                onMoveUp={() => moveLane(laneId, -1)}
                onMoveDown={() => moveLane(laneId, 1)}
              />
              <ProcurementRequestLaneCollapse open={laneBodyOpen}>
                {blocksList}
              </ProcurementRequestLaneCollapse>
            </section>
          );
        })}
      </div>
    </Wrapper>
  );
}
