"use client";

import { useMemo, useRef, useState } from "react";
import {
  actionAddZkWatchByNumber,
  actionAddZkWatchBySubiektDokId,
} from "@/app/actions/sales-notepad";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { validateZkQueryForSubmit } from "@/lib/subiekt/zk-search";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { compareZkWatches } from "@/lib/sales/zk-watch-sort";
import { watchNeedsNotepadAttention } from "@/lib/sales/notepad-follow-up";
import {
  filterZkWatchesByClientQuery,
  type ZkLinkableOrder,
  type ZkWatchOrderHints,
} from "@/lib/sales/zk-watch-order-link";
import { ZK_KEYBOARD_HINTS, ZK_PAGE_SECTION_COPY } from "@/lib/sales/zk-page-copy";
import { summarizeZkWatchList } from "@/lib/sales/zk-list-stats";
import { SalesKeyboardShortcutsStrip } from "@/components/sales/SalesKeyboardShortcutsStrip";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchGroupedList } from "./ZkWatchGroupedList";
import { ZkWatchAddBar } from "./ZkWatchAddBar";
import { ZkWatchAddInlineStrip } from "./ZkWatchAddInlineStrip";
import { ZkWatchAddSection } from "./ZkWatchAddSection";
import { ZkWatchProsbaScopeModal } from "./ZkWatchProsbaScopeModal";
import {
  SalesListFilterEmptyHint,
  SalesSectionEmptyHint,
} from "@/components/sales/SalesListEmptyHints";
import { NotatnikListFilterBar } from "./NotatnikListFilterBar";
import { ZkListMetaStrip } from "./ZkListMetaStrip";
import { ZkWatchStatusGuideStrip } from "./ZkWatchStatusGuideStrip";
import { salesSearchPlaceholder } from "@/lib/sales/sales-search-ui";
import { SALES_SEARCH_COPY } from "@/lib/sales/sales-page-ui-copy";
import { useNotepadListFilter } from "@/hooks/use-notepad-list-filter";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";

export function ZkWatchSection({
  watches,
  zkHintsByWatchId,
  linkableOrders = [],
  readOnly,
  tourPreview = false,
  embedded,
  compact,
  subiektReachable = true,
  subiektBlockedHint,
  onWatchAdded,
  onWatchClosed,
  onWatchRefreshed,
  unseenWatchIds,
  newLineKeysByWatchId,
  onWarehouseArrivalSeen,
  onNewZkLinesSeen,
  prosbaScopeWatchId,
  prosbaScopeOpenNonce = 0,
  onProsbaScopeConfigured,
  onProsbaScopeRequested,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
}: {
  watches: SalesZkWatch[];
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  linkableOrders?: ZkLinkableOrder[];
  unseenWatchIds?: Set<string>;
  newLineKeysByWatchId?: Record<string, string[]>;
  onWarehouseArrivalSeen?: (watchId: string) => void;
  onNewZkLinesSeen?: (watchId: string) => void;
  prosbaScopeWatchId?: string | null;
  prosbaScopeOpenNonce?: number;
  onProsbaScopeConfigured?: (watchId: string) => void;
  onProsbaScopeRequested?: (watchId: string) => void;
  focusWatchId?: string | null;
  onFocusWatchHandled?: (watchId: string) => void;
  onLiveAnnounce?: (message: string) => void;
  readOnly?: boolean;
  tourPreview?: boolean;
  embedded?: boolean;
  compact?: boolean;
  subiektReachable?: boolean;
  subiektBlockedHint?: string;
  onWatchAdded?: (watch: SalesZkWatch) => void;
  onWatchClosed?: (watchId: string, closedAt: string) => void;
  onWatchRefreshed?: (
    watch: SalesZkWatch,
    refreshDiff?: import("@/lib/sales/zk-watch-refresh-diff").ZkWatchRefreshDiff,
    options?: { skipRouterRefresh?: boolean }
  ) => void;
}) {
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
  const addPanelOpen = watches.length === 0 || addPanelExpanded;
  const canAddZk = subiektReachable;
  const searchActive = listFilter.trim().length > 0;

  function handleWatchAdded(watch: SalesZkWatch) {
    onWatchAdded?.(watch);
    collapseAddPanel();
    setAddSectionNonce((value) => value + 1);
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
    if (!value || loading || readOnly || tourPreview || !canAddZk) return;

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
      if (result.kind === "choose") {
        setCandidates(result.candidates);
        setChooseHint(result.hint);
        return;
      }
      setQuery("");
      handleWatchAdded(result.watch);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zamówienia.");
    } finally {
      setLoading(false);
    }
  }

  async function pickCandidate(candidate: ZkSearchCandidate) {
    if (loading || readOnly || tourPreview || !canAddZk) return;
    setLoading(true);
    setError(null);
    try {
      const { watch } = await actionAddZkWatchBySubiektDokId(candidate.subiektDokId);
      setQuery("");
      clearChoose();
      handleWatchAdded(watch);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zamówienia.");
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
        onWarehouseArrivalSeen={onWarehouseArrivalSeen}
        onNewZkLinesSeen={onNewZkLinesSeen}
        focusWatchId={focusWatchId}
        onFocusWatchHandled={onFocusWatchHandled}
        onLiveAnnounce={onLiveAnnounce}
        readOnly={readOnly}
        tourPreview={tourPreview}
        compact={compact}
        subiektReachable={subiektReachable}
        onClosed={onWatchClosed}
        onRefreshed={onWatchRefreshed}
        onProsbaScopeRequested={onProsbaScopeRequested}
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

        {!embedded && !readOnly && !tourPreview ? (
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

        {error && !embedded ? (
          <div className={cn(embedded && salesChromeInsetClass)}>
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
      </div>

      {embedded ? (
        <section className={mojeShipmentSectionShellClass} aria-label={ZK_PAGE_SECTION_COPY.listTitle}>
          <div className="border-b border-slate-100 bg-slate-50/40">
            <div className={cn(salesChromeInsetClass, "space-y-2.5 py-2.5")}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
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
                {!readOnly && !tourPreview && watches.length > 0 && !addPanelOpen ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11 shrink-0 justify-center sm:min-h-[2.5rem]"
                    onClick={openAddPanel}
                  >
                    <IconPlusCircle size={16} strokeWidth={2} className="mr-1.5 shrink-0" aria-hidden />
                    Dodaj ZK
                  </Button>
                ) : null}
              </div>

              {!readOnly && !tourPreview && addPanelOpen ? (
                <ZkWatchAddInlineStrip
                  showCollapse={watches.length > 0}
                  onCollapse={collapseAddPanel}
                >
                  <ZkWatchAddBar {...addBarProps} layout="inline" />
                </ZkWatchAddInlineStrip>
              ) : null}

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
        <div className={mojeShipmentSectionShellClass}>{listBody}</div>
      )}

      {prosbaScopeWatch ? (
        <ZkWatchProsbaScopeModal
          watch={prosbaScopeWatch}
          open={prosbaScopeModalOpen}
          required={!prosbaScopeConfigured}
          onClose={() =>
            setScopeDismissed({ watchId: prosbaScopeWatch.id, nonce: prosbaScopeOpenNonce })
          }
          onSaved={(updated) => {
            setScopeDismissed(null);
            onProsbaScopeConfigured?.(prosbaScopeWatch.id);
            onWatchRefreshed?.(updated, undefined, { skipRouterRefresh: true });
          }}
        />
      ) : null}
    </div>
  );
}
