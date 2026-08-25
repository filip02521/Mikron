"use client";

import {
  extractRawErrorMessage,
  userFacingErrorText,
} from "@/lib/ui/user-facing-error";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionAddZkWatchByNumber,
  actionAddZkWatchBySubiektDokId,
  actionFindActiveZkWatchByQuery,
} from "@/app/actions/sales-notepad";
import { isServerActionTransportError } from "@/lib/client/server-action-transport-error";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { validateZkQueryForSubmit } from "@/lib/subiekt/zk-search";
import { zkNumbersEquivalent } from "@/lib/subiekt/zk-document";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, notatnikPrimaryAddButtonClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { compareZkWatches } from "@/lib/sales/zk-watch-sort";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import { getZkWatchProsbaScopeLineKeys } from "@/lib/sales/zk-watch-prosba-scope";
import { watchNeedsNotepadAttention } from "@/lib/sales/notepad-follow-up";
import {
  filterZkWatchesByClientQuery,
  computeZkWatchOrderHints,
  type ZkLinkableOrder,
  type ZkWatchOrderHints,
} from "@/lib/sales/zk-watch-order-link";
import { buildClientAutoProsbaLines } from "@/lib/sales/zk-watch-auto-prosba";
import {
  toastForScopeSavedOnly,
  toastForAutoProsbaDialogCancelled,
  toastForTeethSkippedAfterScope,
  toastForScopeSavedProsbaFailed,
  normalizeAutoProsbaToastAfterScopeSaved,
  buildAutoProsbaClientBlockedToast,
  nextAutoProsbaAckAfterConfirm,
  mapZkQuantityConfirmLabelForAuto,
  type AutoProsbaToastPayload,
} from "@/lib/sales/zk-watch-auto-prosba-copy";
import { actionAutoCreateProsbaFromZkWatch } from "@/app/actions/sales-notepad";
import {
  buildProsbaSubmitStockConfirm,
  buildProsbaSubmitZkQuantityConfirm,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import { useTeethExemptTwIds, useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { ZkProsbaScopeSavedMeta } from "./ZkWatchProsbaScopeModal";
import { ZK_KEYBOARD_HINTS, ZK_PAGE_SECTION_COPY } from "@/lib/sales/zk-page-copy";
import { summarizeZkWatchList } from "@/lib/sales/zk-list-stats";
import { SalesKeyboardShortcutsStrip } from "@/components/sales/SalesKeyboardShortcutsStrip";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchGroupedList } from "./ZkWatchGroupedList";
import { ZkWatchAddBar } from "./ZkWatchAddBar";
import { ZkWatchAddInlineStrip } from "./ZkWatchAddInlineStrip";
import { ZkWatchAddSection } from "./ZkWatchAddSection";
import {
  SalesListFilterEmptyHint,
  SalesSectionEmptyHint,
} from "@/components/sales/SalesListEmptyHints";

const ZkWatchProsbaScopeModal = dynamic(
  () =>
    import("./ZkWatchProsbaScopeModal").then((mod) => ({
      default: mod.ZkWatchProsbaScopeModal,
    })),
  { ssr: false }
);
const ZkWatchTeethDraftModal = dynamic(
  () =>
    import("./ZkWatchTeethDraftModal").then((mod) => ({
      default: mod.ZkWatchTeethDraftModal,
    })),
  { ssr: false }
);
import { collectZkTeethLineCandidates, zkWatchTeethDraftsReady } from "@/lib/sales/zk-watch-teeth-draft";
import { NotatnikListFilterBar } from "./NotatnikListFilterBar";
import { ZkListMetaStrip } from "./ZkListMetaStrip";
import { ZkWatchStatusGuideStrip } from "./ZkWatchStatusGuideStrip";
import { salesSearchPlaceholder } from "@/lib/sales/sales-search-ui";
import { SALES_SEARCH_COPY } from "@/lib/sales/sales-page-ui-copy";
import { useNotepadListFilter } from "@/hooks/use-notepad-list-filter";
import { NOTATNIK_ZK_LIST_SECTION_CLASS } from "./notatnik-layout";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import { flashNotepadAnchor } from "@/lib/sales/notepad-anchor";

export function ZkWatchSection({
  watches,
  zkHintsByWatchId,
  linkableOrders = [],
  readOnly,
  delegatePreview = false,
  tourPreview = false,
  embedded,
  compact,
  subiektReachable = true,
  subiektBlockedHint,
  onWatchAdded,
  onWatchAlreadyOnList,
  onWatchClosed,
  onWatchRefreshed,
  unseenWatchIds,
  newLineKeysByWatchId,
  newlyAddedWatchIds,
  onWarehouseArrivalSeen,
  onNewZkLinesSeen,
  onNewlyAddedZkWatchSeen,
  prosbaScopeWatchId,
  prosbaScopeOpenNonce = 0,
  onProsbaScopeConfigured,
  onProsbaScopeRequested,
  teethDraftRequestWatchId = null,
  teethDraftOpenNonce = 0,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
  onProsbaToast,
}: {
  watches: SalesZkWatch[];
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  linkableOrders?: ZkLinkableOrder[];
  unseenWatchIds?: Set<string>;
  newLineKeysByWatchId?: Record<string, string[]>;
  newlyAddedWatchIds?: Set<string>;
  onWarehouseArrivalSeen?: (watchId: string) => void;
  onNewZkLinesSeen?: (watchId: string) => void;
  onNewlyAddedZkWatchSeen?: (watchId: string) => void;
  prosbaScopeWatchId?: string | null;
  prosbaScopeOpenNonce?: number;
  onProsbaScopeConfigured?: (watchId: string) => void;
  onProsbaScopeRequested?: (watchId: string) => void;
  /** Otwórz modal list zębów z zewnątrz (np. RefreshPrompt). */
  teethDraftRequestWatchId?: string | null;
  teethDraftOpenNonce?: number;
  focusWatchId?: string | null;
  onFocusWatchHandled?: (watchId: string) => void;
  onLiveAnnounce?: (message: string) => void;
  onProsbaToast?: (toast: AutoProsbaToastPayload) => void;
  readOnly?: boolean;
  delegatePreview?: boolean;
  tourPreview?: boolean;
  embedded?: boolean;
  compact?: boolean;
  subiektReachable?: boolean;
  subiektBlockedHint?: string;
  onWatchAdded?: (watch: SalesZkWatch) => void;
  /** ZK już na liście — przewiń do karty bez oznaczania jako nowe. */
  onWatchAlreadyOnList?: (watch: SalesZkWatch) => void;
  onWatchClosed?: (watchId: string, closedAt: string) => void;
  onWatchRefreshed?: (
    watch: SalesZkWatch,
    refreshDiff?: import("@/lib/sales/zk-watch-refresh-diff").ZkWatchRefreshDiff,
    options?: { skipRouterRefresh?: boolean }
  ) => void;
}) {
  const router = useRouter();
  const teethExemptTwIds = useTeethExemptTwIds();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [scopeDismissed, setScopeDismissed] = useState<{
    watchId: string;
    nonce: number;
  } | null>(null);
  const [statusGuideOpen, setStatusGuideOpen] = useState(tourPreview);
  const focusInList =
    focusWatchId != null && watches.some((watch) => watch.id === focusWatchId);
  const [listFilter, setListFilter] = useNotepadListFilter(focusWatchId, focusInList);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chooseHint, setChooseHint] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ZkSearchCandidate[]>([]);
  const [addSectionNonce, setAddSectionNonce] = useState(0);
  const [addPanelExpanded, setAddPanelExpanded] = useState(false);
  const [teethDraftWatchId, setTeethDraftWatchId] = useState<string | null>(null);
  const teethProductInfo = useTeethProductInfo();
  const [autoProsbaIntent, setAutoProsbaIntent] = useState<{
    watchId: string;
    selectedScopeCount: number;
    stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"stock" | "zk_quantity" | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("Towar na stanie");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmLabel, setConfirmLabel] = useState("Utwórz prośbę mimo stanu");
  const [autoProsbaSubmitting, setAutoProsbaSubmitting] = useState(false);
  const [autoProsbaPendingWatchId, setAutoProsbaPendingWatchId] = useState<string | null>(null);
  const pendingLinesRef = useRef<ProductLineDraft[]>([]);
  const pendingWatchRef = useRef<SalesZkWatch | null>(null);
  const pendingScopeCountRef = useRef(0);
  const pendingStockRef = useRef<Record<number, import("@/lib/orders/prosba-stock-check").ProsbaLineStockSnapshot>>(
    {}
  );
  const pendingAckRef = useRef<{
    acknowledgeSufficientStock?: boolean;
    acknowledgeZkQuantityMismatch?: boolean;
  }>({});
  const canRequestTeethDrafts = !readOnly && !tourPreview;
  const [appliedTeethDraftOpenNonce, setAppliedTeethDraftOpenNonce] = useState(0);

  // Sync z zewnętrznym żądaniem (np. RefreshPrompt) — bez useEffect (eslint set-state-in-effect).
  if (
    teethDraftOpenNonce !== appliedTeethDraftOpenNonce &&
    teethDraftRequestWatchId &&
    canRequestTeethDrafts &&
    watches.some((watch) => watch.id === teethDraftRequestWatchId)
  ) {
    setAppliedTeethDraftOpenNonce(teethDraftOpenNonce);
    setTeethDraftWatchId(teethDraftRequestWatchId);
  }

  function openTeethDraftModal(watchId: string) {
    if (!canRequestTeethDrafts) return;
    setTeethDraftWatchId(watchId);
  }
  const teethRegistry = useMemo(
    () => ({
      twIds: teethProductInfo.twIds,
      manufacturerByTwId: teethProductInfo.manufacturerByTwId,
      productLineByTwId: teethProductInfo.productLineByTwId,
      kindByTwId: teethProductInfo.kindByTwId,
      catalogAvailable: teethProductInfo.catalogAvailable,
    }),
    [teethProductInfo]
  );

  function resolveWatchHints(watch: SalesZkWatch): ZkWatchOrderHints {
    return computeZkWatchOrderHints(watch, linkableOrders);
  }

  function scopeLineKeysForWatch(watch: SalesZkWatch): string[] {
    return getZkWatchProsbaScopeLineKeys(watch, buildZkWatchLineViews(watch)) ?? [];
  }

  function emitProsbaToastAfterScopeSaved(
    toast: AutoProsbaToastPayload,
    selectedScopeCount?: number
  ) {
    emitProsbaToast(
      normalizeAutoProsbaToastAfterScopeSaved(toast, {
        selectedScopeCount: selectedScopeCount ?? pendingScopeCountRef.current,
      })
    );
  }

  function emitProsbaToast(toast: AutoProsbaToastPayload) {
    onProsbaToast?.(toast);
  }

  function mojeHrefForWatch(watch: SalesZkWatch): string {
    return buildMojeClientLink(watch.sales_person_id, watch.client_label, {
      clientKhId: watch.client_kh_id,
      zkWatchId: watch.id,
      zkNumber: watch.zk_number,
    });
  }

  function toastForClientBlocked(
    watch: SalesZkWatch,
    hints: ZkWatchOrderHints,
    blocked: import("@/lib/sales/zk-watch-auto-prosba").AutoProsbaBlockReason
  ): AutoProsbaToastPayload {
    return buildAutoProsbaClientBlockedToast({
      watch,
      hints,
      blocked,
      mojeHref: mojeHrefForWatch(watch),
      mojeHrefWithFocus: (ids) =>
        appendMojeFocusOrderIds(mojeHrefForWatch(watch), ids),
    });
  }

  async function submitAutoProsba(ack: {
    acknowledgeSufficientStock?: boolean;
    acknowledgeZkQuantityMismatch?: boolean;
  }) {
    const watch = pendingWatchRef.current;
    if (!watch || autoProsbaSubmitting) return;
    setAutoProsbaSubmitting(true);
    setAutoProsbaPendingWatchId(watch.id);
    let reopenStockConfirm = false;
    try {
      const result = await actionAutoCreateProsbaFromZkWatch(watch.id, {
        acknowledgeSufficientStock: ack.acknowledgeSufficientStock,
        selectedScopeCount: pendingScopeCountRef.current,
        stockByTwId: pendingStockRef.current,
      });
      if (result.code === "error_stock_ack_required") {
        reopenStockConfirm = true;
        setConfirmTitle("Towar na stanie");
        setConfirmMessage(result.message);
        setConfirmLabel("Utwórz prośbę mimo stanu");
        setConfirmKind("stock");
        setConfirmOpen(true);
        return;
      }
      emitProsbaToastAfterScopeSaved(result);
      if (result.tone === "success") {
        router.refresh();
        flashNotepadAnchor(`watch-${watch.id}`);
      }
    } catch (e) {
      emitProsbaToast(
        toastForScopeSavedProsbaFailed(
          userFacingErrorText(e, "Nie udało się utworzyć prośby.")
        )
      );
    } finally {
      setAutoProsbaSubmitting(false);
      setAutoProsbaPendingWatchId(null);
      if (!reopenStockConfirm) {
        setAutoProsbaIntent(null);
        pendingWatchRef.current = null;
        pendingLinesRef.current = [];
        pendingAckRef.current = {};
        pendingStockRef.current = {};
      }
    }
  }

  function runConfirmAndSubmit(
    lines: ProductLineDraft[],
    ack: {
      acknowledgeSufficientStock?: boolean;
      acknowledgeZkQuantityMismatch?: boolean;
    }
  ) {
    if (!ack.acknowledgeSufficientStock) {
      const stockConfirm = buildProsbaSubmitStockConfirm(
        lines,
        "zamowienie",
        teethExemptTwIds
      );
      if (stockConfirm) {
        pendingLinesRef.current = lines;
        pendingAckRef.current = ack;
        setConfirmTitle("Towar na stanie");
        setConfirmMessage(stockConfirm.message);
        setConfirmLabel("Utwórz prośbę mimo stanu");
        setConfirmKind("stock");
        setConfirmOpen(true);
        return;
      }
    }

    if (!ack.acknowledgeZkQuantityMismatch) {
      const zkConfirm = buildProsbaSubmitZkQuantityConfirm(lines, "zamowienie");
      if (zkConfirm) {
        pendingLinesRef.current = lines;
        pendingAckRef.current = ack;
        setConfirmTitle(zkConfirm.title);
        setConfirmMessage(zkConfirm.message);
        setConfirmLabel(mapZkQuantityConfirmLabelForAuto(zkConfirm.confirmLabel));
        setConfirmKind("zk_quantity");
        setConfirmOpen(true);
        return;
      }
    }

    void submitAutoProsba(ack);
  }

  async function runAutoProsbaChain(
    watch: SalesZkWatch,
    intent: {
      selectedScopeCount: number;
      stockByTwId: Record<number, ProsbaLineStockSnapshot>;
    }
  ) {
    if (autoProsbaSubmitting || confirmOpen) return;
    const hints = resolveWatchHints(watch);
    const built = buildClientAutoProsbaLines({
      watch,
      hints,
      teethRegistry,
      stockByTwId: intent.stockByTwId,
    });

    if (built.blocked || !built.lines.length) {
      emitProsbaToastAfterScopeSaved(
        toastForClientBlocked(
          watch,
          hints,
          built.blocked ?? "no_effective_lines"
        ),
        intent.selectedScopeCount
      );
      setAutoProsbaIntent(null);
      return;
    }

    pendingWatchRef.current = watch;
    pendingScopeCountRef.current = intent.selectedScopeCount;
    pendingStockRef.current = intent.stockByTwId;
    pendingLinesRef.current = built.lines;
    pendingAckRef.current = {};
    runConfirmAndSubmit(built.lines, {});
  }

  function beginAutoProsbaAfterScope(
    updated: SalesZkWatch,
    meta: ZkProsbaScopeSavedMeta
  ) {
    if (!meta.autoProsba) {
      emitProsbaToast(toastForScopeSavedOnly(meta.selectedScopeCount));
      return;
    }

    const intent = {
      watchId: updated.id,
      selectedScopeCount: meta.selectedScopeCount,
      stockByTwId: meta.stockByTwId,
    };
    setAutoProsbaIntent(intent);

    const scopeKeys = scopeLineKeysForWatch(updated);
    const candidates = collectZkTeethLineCandidates(updated, teethRegistry).filter(
      (candidate) => scopeKeys.includes(candidate.lineKey)
    );
    if (
      candidates.length > 0 &&
      !zkWatchTeethDraftsReady(updated, teethRegistry, {
        lineKeys: scopeKeys,
        requestKind: "zamowienie",
      })
    ) {
      openTeethDraftModal(updated.id);
      return;
    }

    void runAutoProsbaChain(updated, intent);
  }

  const addPanelOpen = watches.length === 0 || addPanelExpanded;
  const canAddZk = subiektReachable;
  const searchActive = listFilter.trim().length > 0;

  function handleWatchAdded(watch: SalesZkWatch) {
    onWatchAdded?.(watch);
    collapseAddPanel();
    setAddSectionNonce((value) => value + 1);
  }

  async function recoverWatchAfterTransportError(
    zkQuery: string
  ): Promise<SalesZkWatch | null> {
    try {
      const { watch } = await actionFindActiveZkWatchByQuery(zkQuery);
      return watch;
    } catch {
      return null;
    }
  }

  async function finishWatchAdd(watch: SalesZkWatch) {
    setQuery("");
    handleWatchAdded(watch);
    inputRef.current?.focus();
  }

  function focusExistingWatch(watch: SalesZkWatch) {
    setQuery("");
    clearChoose();
    collapseAddPanel();
    onWatchAlreadyOnList?.(watch);
    onLiveAnnounce?.(
      `${watch.zk_number} jest już na liście — pokazuję kartę.`
    );
    inputRef.current?.focus();
  }

  function isDuplicateZkOnListMessage(message: string): boolean {
    return message.includes("jest już na liście oczekujących");
  }

  async function handleAddFailure(error: unknown, zkQueryForRecovery: string) {
    const rawMessage = extractRawErrorMessage(error);

    if (isDuplicateZkOnListMessage(rawMessage)) {
      const onList = watches.find((watch) =>
        zkNumbersEquivalent(watch.zk_number, zkQueryForRecovery)
      );
      if (onList) {
        focusExistingWatch(onList);
        return;
      }
      const recovered = await recoverWatchAfterTransportError(zkQueryForRecovery);
      if (recovered) {
        focusExistingWatch(recovered);
        return;
      }
      setError(
        userFacingErrorText(rawMessage, "Zamówienie jest już na liście.")
      );
      return;
    }

    if (isServerActionTransportError(error)) {
      const recovered = await recoverWatchAfterTransportError(zkQueryForRecovery);
      if (recovered) {
        await finishWatchAdd(recovered);
        return;
      }
    }

    setError(
      userFacingErrorText(error, "Nie udało się dodać zamówienia.")
    );
  }

  const filteredWatches = useMemo(
    () => filterZkWatchesByClientQuery(watches, listFilter),
    [watches, listFilter]
  );

  const listStats = useMemo(
    () => summarizeZkWatchList(watches, zkHintsByWatchId),
    [watches, zkHintsByWatchId]
  );

  const followUpCount = useMemo(
    () => watches.filter((watch) => watchNeedsNotepadAttention(watch)).length,
    [watches]
  );
  const unseenRegalWatchCount = unseenWatchIds?.size ?? 0;
  const newLinesWatchCount = newLineKeysByWatchId
    ? Object.keys(newLineKeysByWatchId).length
    : 0;

  const prosbaScopeWatch = useMemo(
    () =>
      prosbaScopeWatchId
        ? watches.find((watch) => watch.id === prosbaScopeWatchId)
        : undefined,
    [prosbaScopeWatchId, watches]
  );
  const teethDraftWatch = useMemo(
    () =>
      teethDraftWatchId
        ? watches.find((watch) => watch.id === teethDraftWatchId)
        : undefined,
    [teethDraftWatchId, watches]
  );

  const prosbaScopeConfigured =
    prosbaScopeWatch != null
      ? (zkHintsByWatchId?.get(prosbaScopeWatch.id)?.prosbaScopeConfigured ?? false)
      : false;

  const prosbaScopeModalOpen = Boolean(
    prosbaScopeWatch &&
      !readOnly &&
      !tourPreview &&
      !(
        scopeDismissed?.watchId === prosbaScopeWatch.id &&
        scopeDismissed.nonce === prosbaScopeOpenNonce
      )
  );

  const sortedCandidates = useMemo(
    () =>
      [...candidates].sort((a, b) =>
        compareZkWatches(
          {
            zk_number: a.zkNumber,
            zk_issued_at: a.issuedAt,
            created_at: a.issuedAt ?? "",
            follow_up_at: null,
          },
          {
            zk_number: b.zkNumber,
            zk_issued_at: b.issuedAt,
            created_at: b.issuedAt ?? "",
            follow_up_at: null,
          }
        )
      ),
    [candidates]
  );

  function clearChoose() {
    setCandidates([]);
    setChooseHint(null);
  }

  function collapseAddPanel() {
    clearChoose();
    setQuery("");
    setError(null);
    setAddPanelExpanded(false);
  }

  function openAddPanel() {
    setAddPanelExpanded(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const addBarProps = {
    inputRef,
    query,
    loading,
    canAdd: canAddZk,
    subiektBlockedHint,
    chooseHint,
    candidates: sortedCandidates,
    onQueryChange: (value: string) => {
      setQuery(value);
      if (error) setError(null);
      if (candidates.length) clearChoose();
    },
    onSubmit: () => void submit(),
    onPickCandidate: (candidate: ZkSearchCandidate) => void pickCandidate(candidate),
    onClearChoose: clearChoose,
  };

  async function submit(nextQuery?: string) {
    const value = (nextQuery ?? query).trim();
    if (!value || loading || readOnly || delegatePreview || tourPreview || !canAddZk) return;

    const validated = validateZkQueryForSubmit(value);
    if (!validated.ok) {
      setError(validated.message);
      clearChoose();
      return;
    }

    setLoading(true);
    setError(null);
    clearChoose();
    try {
      const result = await actionAddZkWatchByNumber(value);
      if (result.kind === "error") {
        await handleAddFailure(new Error(result.message), value);
        return;
      }
      if (result.kind === "choose") {
        setCandidates(result.candidates);
        setChooseHint(result.hint);
        return;
      }
      await finishWatchAdd(result.watch);
    } catch (e) {
      await handleAddFailure(e, value);
    } finally {
      setLoading(false);
    }
  }

  async function pickCandidate(candidate: ZkSearchCandidate) {
    if (loading || readOnly || delegatePreview || tourPreview || !canAddZk) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actionAddZkWatchBySubiektDokId(candidate.subiektDokId);
      if (result.kind === "error") {
        await handleAddFailure(new Error(result.message), candidate.zkNumber);
        return;
      }
      if (result.kind === "choose") {
        setCandidates(result.candidates);
        setChooseHint(result.hint);
        return;
      }
      clearChoose();
      await finishWatchAdd(result.watch);
    } catch (e) {
      await handleAddFailure(e, candidate.zkNumber);
    } finally {
      setLoading(false);
    }
  }

  const listBody =
    watches.length === 0 ? (
      <SalesSectionEmptyHint message="Brak zamówień klienta czekających na towar." />
    ) : filteredWatches.length === 0 ? (
      <SalesListFilterEmptyHint
        query={listFilter.trim()}
        onClear={() => setListFilter("")}
        entityLabel="ZK"
      />
    ) : (
      <ZkWatchGroupedList
        watches={filteredWatches}
        zkHintsByWatchId={zkHintsByWatchId}
        linkableOrders={linkableOrders}
        unseenWatchIds={unseenWatchIds}
        newLineKeysByWatchId={newLineKeysByWatchId}
        newlyAddedWatchIds={newlyAddedWatchIds}
        onWarehouseArrivalSeen={onWarehouseArrivalSeen}
        onNewZkLinesSeen={onNewZkLinesSeen}
        onNewlyAddedZkWatchSeen={onNewlyAddedZkWatchSeen}
        focusWatchId={focusWatchId}
        onFocusWatchHandled={onFocusWatchHandled}
        onLiveAnnounce={onLiveAnnounce}
        readOnly={readOnly}
        delegatePreview={delegatePreview}
        tourPreview={tourPreview}
        compact={compact}
        subiektReachable={subiektReachable}
        onClosed={onWatchClosed}
        onRefreshed={onWatchRefreshed}
        onProsbaScopeRequested={onProsbaScopeRequested}
        autoProsbaPendingWatchId={autoProsbaPendingWatchId}
        onTeethDraftRequested={openTeethDraftModal}
        teethRegistry={teethRegistry}
      />
    );

  return (
    <div className={embedded ? "space-y-0" : "space-y-4"}>
      {!embedded ? (
        <div>
          <h2 className={salesTypography.blockTitle}>Czeka na towar</h2>
          <p className={cn("mt-0.5", salesTypography.sectionHint)}>
            Śledź zamówienia klientów i dopinaj prośby do pozycji z Subiekta.
          </p>
        </div>
      ) : null}

      <div className={cn(embedded && "space-y-0", !embedded && "space-y-4")}>
        {!embedded ? (
          <div>
            <ZkWatchStatusGuideStrip
              open={statusGuideOpen}
              onOpenChange={setStatusGuideOpen}
            />
          </div>
        ) : null}

        {!embedded && !readOnly && !delegatePreview && !tourPreview ? (
          <ZkWatchAddSection
            key={`${watches.length === 0 ? "zk-add-empty" : "zk-add-has-items"}-${addSectionNonce}`}
            defaultOpen={watches.length === 0}
            showCollapse={watches.length > 0}
            embedded={embedded}
            onCollapse={collapseAddPanel}
          >
            <ZkWatchAddBar {...addBarProps} layout="stack" />
          </ZkWatchAddSection>
        ) : null}

        {!embedded && watches.length > 0 ? (
          <NotatnikListFilterBar
            embedded
            visibleLabel="Szukaj na swojej liście"
            value={listFilter}
            onChange={setListFilter}
            matchCount={filteredWatches.length}
            totalCount={watches.length}
            placeholder={salesSearchPlaceholder(SALES_SEARCH_COPY.zkList)}
            searchLabel="Szukaj na liście ZK"
            showIdleHint={false}
            showActiveDetail={false}
          />
        ) : null}

        {error && !embedded ? (
          <div>
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
      </div>

      {embedded ? (
        <section className={NOTATNIK_ZK_LIST_SECTION_CLASS} aria-label={ZK_PAGE_SECTION_COPY.listTitle}>
          <div className="border-b border-slate-100 bg-slate-50/40">
            <div className={cn(salesChromeInsetClass, "space-y-2.5 py-2.5")}>
              {!readOnly && !delegatePreview && !tourPreview && addPanelOpen ? (
                <ZkWatchAddInlineStrip
                  showCollapse={watches.length > 0}
                  onCollapse={collapseAddPanel}
                >
                  <ZkWatchAddBar {...addBarProps} layout="inline" />
                </ZkWatchAddInlineStrip>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                {!readOnly && !delegatePreview && !tourPreview && watches.length > 0 && !addPanelOpen ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(notatnikPrimaryAddButtonClass, "sm:min-h-[2.5rem]")}
                    onClick={openAddPanel}
                  >
                    <IconPlusCircle size={16} strokeWidth={2} className="mr-1.5 shrink-0" aria-hidden />
                    Dodaj ZK
                  </Button>
                ) : null}
                {watches.length > 0 ? (
                  <div className="min-w-0 flex-1">
                    <NotatnikListFilterBar
                      compact
                      embedded
                      value={listFilter}
                      onChange={setListFilter}
                      matchCount={filteredWatches.length}
                      totalCount={watches.length}
                      placeholder={salesSearchPlaceholder(SALES_SEARCH_COPY.zkList)}
                      searchLabel="Szukaj na liście ZK"
                      showIdleHint={false}
                      showActiveDetail={false}
                    />
                  </div>
                ) : null}
              </div>

              {watches.length > 0 ? (
                <ZkListMetaStrip
                  bare
                  watchCount={listStats.watchCount}
                  lineCount={listStats.lineCount}
                  filteredWatchCount={filteredWatches.length}
                  searchActive={searchActive}
                  regalLineCount={listStats.regalLineCount}
                  informacjaReadyLineCount={listStats.informacjaReadyLineCount}
                  newLinesWatchCount={newLinesWatchCount}
                  unseenRegalWatchCount={unseenRegalWatchCount}
                  followUpCount={followUpCount}
                  onOpenStatusGuide={() => setStatusGuideOpen(true)}
                  trailing={
                    <SalesKeyboardShortcutsStrip
                      items={[...ZK_KEYBOARD_HINTS]}
                      layout="toolbar"
                    />
                  }
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusGuideOpen(true)}
                    className={cn(brandLinkSubtleClass, "text-xs font-semibold")}
                  >
                    Statusy pozycji
                  </button>
                  <SalesKeyboardShortcutsStrip
                    items={[...ZK_KEYBOARD_HINTS]}
                    layout="toolbar"
                  />
                </div>
              )}

              {statusGuideOpen ? (
                <ZkWatchStatusGuideStrip
                  embedded={false}
                  open={statusGuideOpen}
                  onOpenChange={setStatusGuideOpen}
                  className="rounded-md border border-indigo-100/80 bg-indigo-50/30"
                />
              ) : null}

              {error ? <Alert tone="error">{error}</Alert> : null}
            </div>
          </div>
          {listBody}
        </section>
      ) : (
        <div className={NOTATNIK_ZK_LIST_SECTION_CLASS}>{listBody}</div>
      )}

      {prosbaScopeWatch ? (
        <ZkWatchProsbaScopeModal
          key={`${prosbaScopeWatch.id}:${prosbaScopeOpenNonce}`}
          watch={prosbaScopeWatch}
          open={prosbaScopeModalOpen}
          required={!prosbaScopeConfigured}
          readOnly={readOnly}
          tourPreview={tourPreview}
          delegatePreview={delegatePreview}
          teethRegistry={teethRegistry}
          onClose={() =>
            setScopeDismissed({ watchId: prosbaScopeWatch.id, nonce: prosbaScopeOpenNonce })
          }
          onSaved={(updated, meta) => {
            setScopeDismissed(null);
            onProsbaScopeConfigured?.(prosbaScopeWatch.id);
            onWatchRefreshed?.(updated, undefined, { skipRouterRefresh: true });
            beginAutoProsbaAfterScope(updated, meta);
          }}
        />
      ) : null}

      {teethDraftWatch ? (
        <ZkWatchTeethDraftModal
          key={teethDraftWatch.id}
          open
          watch={teethDraftWatch}
          onClose={() => {
            if (autoProsbaIntent?.watchId === teethDraftWatch.id) {
              emitProsbaToast(toastForTeethSkippedAfterScope());
              setAutoProsbaIntent(null);
            }
            setTeethDraftWatchId(null);
          }}
          onSkipLater={() => {
            if (autoProsbaIntent?.watchId === teethDraftWatch.id) {
              emitProsbaToast(toastForTeethSkippedAfterScope());
              setAutoProsbaIntent(null);
            }
            setTeethDraftWatchId(null);
          }}
          onSaved={(updated) => {
            setTeethDraftWatchId(null);
            onWatchRefreshed?.(updated, undefined, { skipRouterRefresh: true });
            if (autoProsbaIntent?.watchId === updated.id) {
              void runAutoProsbaChain(updated, {
                selectedScopeCount: autoProsbaIntent.selectedScopeCount,
                stockByTwId: autoProsbaIntent.stockByTwId,
              });
            }
          }}
        />
      ) : null}

      <ProsbaStockConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel="Zostaw tylko zakres"
        pending={autoProsbaSubmitting}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmKind(null);
          pendingLinesRef.current = [];
          pendingWatchRef.current = null;
          pendingAckRef.current = {};
          pendingStockRef.current = {};
          setAutoProsbaPendingWatchId(null);
          setAutoProsbaIntent(null);
          emitProsbaToast(toastForAutoProsbaDialogCancelled());
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          const lines = pendingLinesRef.current;
          const prevAck = pendingAckRef.current;
          const kind = confirmKind;
          setConfirmKind(null);
          if (kind === "stock") {
            const nextAck = nextAutoProsbaAckAfterConfirm("stock", prevAck);
            pendingAckRef.current = nextAck;
            runConfirmAndSubmit(lines, nextAck);
            return;
          }
          void submitAutoProsba(nextAutoProsbaAckAfterConfirm("zk_quantity", prevAck));
        }}
      />
    </div>
  );
}
