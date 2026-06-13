"use client";

import { useMemo } from "react";
import { filterSalesNotesByQuery } from "@/lib/sales/notepad-note-sort";
import { filterZkWatchesByClientQuery } from "@/lib/sales/zk-watch-order-link";
import type { SalesNote, SalesZkWatch } from "@/types/database";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { useNotepadListFilter } from "@/hooks/use-notepad-list-filter";
import {
  SalesListFilterEmptyHint,
} from "@/components/sales/SalesListEmptyHints";
import { ZkWatchGroupedList } from "./ZkWatchGroupedList";
import { ArchivedNotesSection } from "./ArchivedNotesSection";
import { NotatnikListFilterBar } from "./NotatnikListFilterBar";

export function NotatnikArchivePanel({
  archivedWatches,
  archivedNotes,
  readOnly,
  focusWatchId,
  onFocusWatchHandled,
  onLiveAnnounce,
  onWatchRestored,
  onWatchDeleted,
  onNoteRestored,
  onNoteDeleted,
}: {
  archivedWatches: SalesZkWatch[];
  archivedNotes: SalesNote[];
  readOnly?: boolean;
  focusWatchId?: string | null;
  onFocusWatchHandled?: (watchId: string) => void;
  onLiveAnnounce?: (message: string) => void;
  onWatchRestored?: (watch: SalesZkWatch) => void;
  onWatchDeleted?: (watchId: string) => void;
  onNoteRestored?: (note: SalesNote) => void;
  onNoteDeleted?: (noteId: string) => void;
}) {
  const focusInZkList =
    focusWatchId != null && archivedWatches.some((watch) => watch.id === focusWatchId);
  const [listFilter, setListFilter] = useNotepadListFilter(focusWatchId, focusInZkList);

  const filteredWatches = useMemo(
    () => filterZkWatchesByClientQuery(archivedWatches, listFilter),
    [archivedWatches, listFilter]
  );
  const filteredNotes = useMemo(
    () => filterSalesNotesByQuery(archivedNotes, listFilter),
    [archivedNotes, listFilter]
  );

  const hasZk = archivedWatches.length > 0;
  const hasNotes = archivedNotes.length > 0;
  const filterActive = listFilter.trim().length > 0;
  const showFilter = hasZk || hasNotes;
  const showZkSection = hasZk && filteredWatches.length > 0;
  const showNotesSection = hasNotes && filteredNotes.length > 0;
  const showEmptyFilter =
    filterActive && filteredWatches.length === 0 && filteredNotes.length === 0;

  return (
    <>
      {showFilter ? (
        <div className="space-y-3 px-3 pt-3 sm:px-4">
          <NotatnikListFilterBar
            value={listFilter}
            onChange={setListFilter}
            placeholder="Filtruj archiwum po kliencie, numerze ZK lub treści notatki…"
          />
        </div>
      ) : null}

      {showEmptyFilter ? (
        <SalesListFilterEmptyHint
          query={listFilter.trim()}
          onClear={() => setListFilter("")}
          entityLabel="wpisów archiwum"
        />
      ) : (
        <>
          {showZkSection ? (
            <>
              <div className="px-3 pb-2 pt-3 sm:px-4">
                <p className={salesTypography.sectionLabel}>ZK zamknięte</p>
              </div>
              <ZkWatchGroupedList
                watches={filteredWatches}
                readOnly={readOnly}
                archived
                compact
                focusWatchId={focusWatchId}
                onFocusWatchHandled={onFocusWatchHandled}
                onLiveAnnounce={onLiveAnnounce}
                onRestored={onWatchRestored}
                onDeleted={onWatchDeleted}
              />
            </>
          ) : null}
          {showNotesSection ? (
            <div
              className={cn(
                "space-y-2 px-3 pb-3 pt-3 sm:px-4",
                showZkSection && "border-t border-slate-100"
              )}
            >
              <p className={salesTypography.sectionLabel}>Notatki</p>
              <ArchivedNotesSection
                notes={filteredNotes}
                readOnly={readOnly}
                onRestored={onNoteRestored}
                onDeleted={onNoteDeleted}
              />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
