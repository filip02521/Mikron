"use client";

import { useMemo } from "react";
import { filterSalesNotesByQuery } from "@/lib/sales/notepad-note-sort";
import { filterZkWatchesByClientQuery } from "@/lib/sales/zk-watch-order-link";
import type { SalesNote, SalesZkWatch } from "@/types/database";
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
  mode,
  readOnly,
  focusWatchId,
  focusNoteId,
  onFocusWatchHandled,
  onFocusNoteHandled,
  onLiveAnnounce,
  onWatchRestored,
  onWatchDeleted,
  onNoteRestored,
  onNoteDeleted,
}: {
  archivedWatches: SalesZkWatch[];
  archivedNotes: SalesNote[];
  /** Które wpisy pokazać — osobne archiwum na /zk i /notatnik. */
  mode: "zk" | "notes";
  readOnly?: boolean;
  focusWatchId?: string | null;
  focusNoteId?: string | null;
  onFocusWatchHandled?: (watchId: string) => void;
  onFocusNoteHandled?: (noteId: string) => void;
  onLiveAnnounce?: (message: string) => void;
  onWatchRestored?: (watch: SalesZkWatch) => void;
  onWatchDeleted?: (watchId: string) => void;
  onNoteRestored?: (note: SalesNote) => void;
  onNoteDeleted?: (noteId: string) => void;
}) {
  const showZkArchive = mode === "zk";
  const showNotesArchive = mode === "notes";
  const zkWatches = useMemo(
    () => (showZkArchive ? archivedWatches : []),
    [showZkArchive, archivedWatches]
  );
  const notes = useMemo(
    () => (showNotesArchive ? archivedNotes : []),
    [showNotesArchive, archivedNotes]
  );
  const focusInZkList =
    focusWatchId != null && zkWatches.some((watch) => watch.id === focusWatchId);
  const [listFilter, setListFilter] = useNotepadListFilter(focusWatchId, focusInZkList);

  const filteredWatches = useMemo(
    () => filterZkWatchesByClientQuery(zkWatches, listFilter),
    [zkWatches, listFilter]
  );
  const filteredNotes = useMemo(
    () => filterSalesNotesByQuery(notes, listFilter),
    [notes, listFilter]
  );

  const hasZk = zkWatches.length > 0;
  const hasNotes = notes.length > 0;
  const filterActive = listFilter.trim().length > 0;
  const showFilter = hasZk || hasNotes;
  const showZkSection = hasZk && filteredWatches.length > 0;
  const showNotesSection = hasNotes && filteredNotes.length > 0;
  const showEmptyFilter =
    filterActive && filteredWatches.length === 0 && filteredNotes.length === 0;
  const filterPlaceholder =
    mode === "zk"
      ? "Szukaj w archiwum ZK: klient, numer ZK lub produkt…"
      : mode === "notes"
        ? "Szukaj w archiwum notatek: tytuł lub treść…"
        : "Szukaj w archiwum: klient, numer ZK, produkt lub treść notatki…";
  const filterIdleHint =
    mode === "zk"
      ? "Filtruj zamknięte ZK po kliencie, numerze lub produkcie."
      : mode === "notes"
        ? "Filtruj zarchiwizowane notatki po tytule lub treści."
        : "Filtruj archiwum po kliencie, numerze ZK, produkcie lub treści notatki.";
  const filterActiveHint =
    mode === "zk"
      ? "Wyniki z zamkniętych spraw ZK."
      : mode === "notes"
        ? "Wyniki ze zarchiwizowanych notatek."
        : "Wyniki z zamkniętych ZK i zarchiwizowanych notatek.";

  return (
    <>
      {showFilter ? (
        <div className="px-3 pt-3 sm:px-4">
          <NotatnikListFilterBar
            embedded
            value={listFilter}
            onChange={setListFilter}
            matchCount={filteredWatches.length + filteredNotes.length}
            totalCount={zkWatches.length + notes.length}
            placeholder={filterPlaceholder}
            idleHint={filterIdleHint}
            activeHint={filterActiveHint}
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
            <ArchivedNotesSection
              embedded
              className="mx-3 mb-3 mt-2 sm:mx-4"
              notes={filteredNotes}
              readOnly={readOnly}
              focusNoteId={focusNoteId}
              onFocusNoteHandled={onFocusNoteHandled}
              onRestored={onNoteRestored}
              onDeleted={onNoteDeleted}
            />
          ) : null}
        </>
      )}
    </>
  );
}
