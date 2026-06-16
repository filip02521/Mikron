"use client";

import { useMemo, useRef, useState } from "react";
import { actionAddZkWatchByNumber,
  actionAddZkWatchBySubiektDokId,
} from "@/app/actions/sales-notepad";
import { Alert } from "@/components/ui/Alert";
import { validateZkQueryForSubmit } from "@/lib/subiekt/zk-search";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { compareZkWatches } from "@/lib/sales/zk-watch-sort";
import {
  filterZkWatchesByClientQuery,
  type ZkWatchOrderHints,
} from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchGroupedList } from "./ZkWatchGroupedList";
import { ZkWatchAddBar } from "./ZkWatchAddBar";
import {
  SalesListFilterEmptyHint,
  SalesSectionEmptyHint,
} from "@/components/sales/SalesListEmptyHints";
import { NotatnikListFilterBar } from "./NotatnikListFilterBar";
import { useNotepadListFilter } from "@/hooks/use-notepad-list-filter";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";

export function ZkWatchSection({
  watches,
  zkHintsByWatchId,
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
  onWatchDetailOpen,
  prosbaScopeWatchId,
  onProsbaScopeConfigured,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
}: {
  watches: SalesZkWatch[];
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  unseenWatchIds?: Set<string>;
  newLineKeysByWatchId?: Record<string, string[]>;
  onWarehouseArrivalSeen?: (watchId: string) => void;
  onNewZkLinesSeen?: (watchId: string) => void;
  onWatchDetailOpen?: (watchId: string) => void;
  prosbaScopeWatchId?: string | null;
  onProsbaScopeConfigured?: (watchId: string) => void;
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
  onWatchRefreshed?: (watch: SalesZkWatch, refreshDiff?: import("@/lib/sales/zk-watch-refresh-diff").ZkWatchRefreshDiff) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const focusInList =
    focusWatchId != null && watches.some((watch) => watch.id === focusWatchId);
  const [listFilter, setListFilter] = useNotepadListFilter(focusWatchId, focusInList);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chooseHint, setChooseHint] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ZkSearchCandidate[]>([]);
  const canAddZk = subiektReachable;

  const filteredWatches = useMemo(
    () => filterZkWatchesByClientQuery(watches, listFilter),
    [watches, listFilter]
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
      onWatchAdded?.(result.watch);
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
      onWatchAdded?.(watch);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zamówienia.");
    } finally {
      setLoading(false);
    }
  }

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

      <div className={cn(embedded && "space-y-0 px-3 sm:px-4 pt-3", !embedded && "space-y-4")}>
      {!readOnly && !tourPreview ? (
        <ZkWatchAddBar
          inputRef={inputRef}
          query={query}
          loading={loading}
          canAdd={canAddZk}
          subiektBlockedHint={subiektBlockedHint}
          chooseHint={chooseHint}
          candidates={sortedCandidates}
          onQueryChange={(value) => {
            setQuery(value);
            if (error) setError(null);
            if (candidates.length) clearChoose();
          }}
          onSubmit={() => void submit()}
          onPickCandidate={(candidate) => void pickCandidate(candidate)}
          onClearChoose={clearChoose}
        />
      ) : null}

      {watches.length > 0 ? (
        <div className={cn(!readOnly && !tourPreview && "mt-3")}>
          <NotatnikListFilterBar
            embedded
            value={listFilter}
            onChange={setListFilter}
            matchCount={filteredWatches.length}
            totalCount={watches.length}
          />
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      </div>

      {watches.length === 0 ? (
        <SalesSectionEmptyHint message="Brak zamówień klienta czekających na towar." />
      ) : filteredWatches.length === 0 ? (
        <SalesListFilterEmptyHint
          query={listFilter.trim()}
          onClear={() => setListFilter("")}
          entityLabel="ZK"
        />
      ) : (
        <div className={embedded ? undefined : mojeShipmentSectionShellClass}>
        <ZkWatchGroupedList
          watches={filteredWatches}
          zkHintsByWatchId={zkHintsByWatchId}
          unseenWatchIds={unseenWatchIds}
          newLineKeysByWatchId={newLineKeysByWatchId}
          onWarehouseArrivalSeen={onWarehouseArrivalSeen}
          onNewZkLinesSeen={onNewZkLinesSeen}
          onWatchDetailOpen={onWatchDetailOpen}
          prosbaScopeWatchId={prosbaScopeWatchId}
          onProsbaScopeConfigured={onProsbaScopeConfigured}
          focusWatchId={focusWatchId}
          onFocusWatchHandled={onFocusWatchHandled}
          onLiveAnnounce={onLiveAnnounce}
          readOnly={readOnly}
            tourPreview={tourPreview}
            compact={compact}
            subiektReachable={subiektReachable}
            onClosed={onWatchClosed}
            onRefreshed={onWatchRefreshed}
          />
        </div>
      )}
    </div>
  );
}
