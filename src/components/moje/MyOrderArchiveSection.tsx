"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { ARCHIVE_RECENT_DAYS } from "@/lib/orders/my-order-archive";
import {
  filterMyOrderRowsBySearch,
  searchQueryTokens,
} from "@/lib/orders/my-order-search";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MojeSectionIcon, mojeSectionIconTileClass } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";

export function MyOrderArchiveSection({
  rowsRecent,
  rowsExtended,
  defaultOpen = false,
  forceOpen = false,
  searchQuery = "",
}: {
  /** Potwierdzenia z ostatnich 7 dni. */
  rowsRecent: MyOrderRow[];
  /** Szersze archiwum (np. 90 dni), po „Pokaż więcej”. */
  rowsExtended: MyOrderRow[];
  /** Tour / onboarding — sekcja rozwinięta od razu. */
  defaultOpen?: boolean;
  /** Rozwiń gdy wynik jest tylko w archiwum. */
  forceOpen?: boolean;
  searchQuery?: string;
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  const [showMore, setShowMore] = useState(false);
  const searchOpenedRef = useRef(false);
  const searchShowMoreRef = useRef(false);
  const preSearchOpenRef = useRef<boolean | null>(null);
  const preSearchShowMoreRef = useRef<boolean | null>(null);

  const filteredRecent = useMemo(
    () => filterMyOrderRowsBySearch(rowsRecent, searchQuery),
    [rowsRecent, searchQuery]
  );
  const filteredExtended = useMemo(
    () => filterMyOrderRowsBySearch(rowsExtended, searchQuery),
    [rowsExtended, searchQuery]
  );

  useEffect(() => {
    if (forceOpen) {
      setOpen((wasOpen) => {
        if (preSearchOpenRef.current === null) preSearchOpenRef.current = wasOpen;
        return true;
      });
      searchOpenedRef.current = true;
      return;
    }
    const searchActive = searchQueryTokens(searchQuery).length > 0;
    if (!searchActive && searchOpenedRef.current) {
      setOpen(preSearchOpenRef.current ?? defaultOpen);
      preSearchOpenRef.current = null;
      searchOpenedRef.current = false;
    }
  }, [forceOpen, searchQuery, defaultOpen]);

  useEffect(() => {
    const searchActive = searchQueryTokens(searchQuery).length > 0;
    if (!searchActive) {
      if (searchShowMoreRef.current) {
        setShowMore(preSearchShowMoreRef.current ?? false);
        preSearchShowMoreRef.current = null;
        searchShowMoreRef.current = false;
      }
      return;
    }
    if (filteredRecent.length > 0 || filteredExtended.length === 0) return;
    setShowMore((wasMore) => {
      if (preSearchShowMoreRef.current === null) preSearchShowMoreRef.current = wasMore;
      searchShowMoreRef.current = true;
      return true;
    });
  }, [searchQuery, filteredRecent.length, filteredExtended.length]);

  const searchActive = searchQueryTokens(searchQuery).length > 0;

  const hasRecent = filteredRecent.length > 0;
  const hasExtended = filteredExtended.length > 0;
  const hasMoreToLoad =
    filteredExtended.length > filteredRecent.length ||
    filteredExtended.some((r) => !filteredRecent.some((x) => x.id === r.id));

  if (!searchActive && !rowsRecent.length && !rowsExtended.length) return null;
  if (searchActive && !hasRecent && !hasExtended) return null;

  const visibleRows = showMore ? filteredExtended : filteredRecent;

  const countLabel = (n: number) =>
    `${n} ${n === 1 ? "wpis" : n < 5 ? "wpisy" : "wpisów"}`;

  const description = open
    ? showMore
      ? `${countLabel(filteredExtended.length)} z ostatnich 90 dni — tylko do wglądu`
      : hasRecent
        ? `${countLabel(filteredRecent.length)} z ostatnich ${ARCHIVE_RECENT_DAYS} dni — tylko do wglądu`
        : searchActive
          ? "Brak zakończonych prośb pasujących do wyszukiwania"
          : `Brak wpisów z ostatnich ${ARCHIVE_RECENT_DAYS} dni`
    : searchActive
      ? "Zakończone prośby pasujące do wyszukiwania"
      : `Odebrane, wycofane i zakończone prośby z ostatnich ${ARCHIVE_RECENT_DAYS} dni`;

  return (
    <div id="moje-ostatnio-zakonczone" className="mt-8 border-t-2 border-dashed border-slate-200/90 pt-6">
    <Card padding={false} className="border-slate-200/70 bg-slate-50/80 shadow-none">
      <CardHeader
        inset
        density="compact"
        title="Ostatnio zakończone"
        description={description}
        leading={
          <SectionHeadingIcon tileClassName={mojeSectionIconTileClass("archive")}>
            <MojeSectionIcon kind="archive" size={20} />
          </SectionHeadingIcon>
        }
        action={
          <button
            type="button"
            onClick={() => {
              setOpen((v) => {
                if (v) setShowMore(false);
                return !v;
              });
            }}
            className="min-h-11 cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-8"
            aria-expanded={open}
          >
            {open ? "Zwiń" : "Pokaż"}
          </button>
        }
      />
      {open ? (
        <div>
          {visibleRows.length > 0 ? (
            <MyOrderShipmentList
              embedded
              rows={visibleRows}
              listKind={visibleRows[0]?.kind === "informacja" ? "informacja" : "zamowienie"}
              showProgress={false}
              canAcknowledge={false}
              searchQuery={searchQuery}
              rowVisualTone="archive"
            />
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">
              W ostatnich {ARCHIVE_RECENT_DAYS} dniach nie ma zakończonych wpisów.
              {hasMoreToLoad
                ? " Starsze pozycje zobaczysz po kliknięciu „Pokaż więcej” poniżej."
                : null}
            </p>
          )}
          {hasMoreToLoad ? (
            <div className="border-t border-slate-100 px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setShowMore((v) => !v)}
              >
                {showMore
                  ? "Pokaż tylko ostatnie 7 dni"
                  : `Pokaż więcej (${countLabel(filteredExtended.length)} z 90 dni)`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
    </div>
  );
}
