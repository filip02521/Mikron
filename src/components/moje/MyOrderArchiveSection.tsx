"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { ARCHIVE_RECENT_DAYS, ARCHIVE_EXPANDED_DAYS } from "@/lib/orders/my-order-archive";
import {
  filterMyOrderRowsBySearch,
  searchQueryTokens,
} from "@/lib/orders/my-order-search";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  MojeSectionIcon,
  mojeSectionIconTileClass,
  IconChevronDown,
  IconArchive,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";

export function MyOrderArchiveSection({
  rowsRecent,
  rowsExtended,
  defaultOpen = false,
  forceOpen = false,
  searchQuery = "",
  cardIdPrefix,
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
  /** Id karty (np. scroll po wyszukiwaniu) — jak w aktywnej liście. */
  cardIdPrefix?: (rowId: string) => string;
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

  const totalRecent = rowsRecent.length;

  const description = open
    ? showMore
      ? `${countLabel(filteredExtended.length)} · ostatnie ${ARCHIVE_EXPANDED_DAYS} dni`
      : hasRecent
        ? `${countLabel(filteredRecent.length)} · ostatnie ${ARCHIVE_RECENT_DAYS} dni`
        : searchActive
          ? "Brak zakończonych prośb pasujących do wyszukiwania"
          : `Brak wpisów z ostatnich ${ARCHIVE_RECENT_DAYS} dni`
    : searchActive
      ? "Zakończone prośby pasujące do wyszukiwania"
      : totalRecent > 0
        ? `${countLabel(totalRecent)} ${totalRecent === 1 ? "zakończony" : "zakończone"} · ostatnie ${ARCHIVE_RECENT_DAYS} dni`
        : `Odebrane i zakończone prośby z ostatnich ${ARCHIVE_RECENT_DAYS} dni`;

  return (
    <div id="moje-ostatnio-zakonczone" className="mt-6 border-t border-slate-200/70 pt-5">
    <Card padding={false} className="border-slate-200/80 bg-white/70 shadow-sm shadow-slate-200/30">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen((v) => {
                if (v) setShowMore(false);
                return !v;
              });
            }}
            aria-expanded={open}
          >
            <IconChevronDown size={14} open={open} />
            {open ? "Zwiń" : "Pokaż"}
          </Button>
        }
      />
      {open ? (
        <div className="archive-expand-enter">
          {visibleRows.length > 0 ? (
            <MyOrderShipmentList
              embedded
              rows={visibleRows}
              listKind={visibleRows[0]?.kind === "informacja" ? "informacja" : "zamowienie"}
              showProgress={false}
              canAcknowledge={false}
              searchQuery={searchQuery}
              rowVisualTone="archive"
              cardIdPrefix={cardIdPrefix}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <IconArchive size={20} />
              </span>
              <p className="text-sm text-slate-500">
                {searchActive
                  ? "Brak zakończonych prośb pasujących do wyszukiwania"
                  : `W ostatnich ${ARCHIVE_RECENT_DAYS} dniach nie ma zakończonych wpisów.`}
              </p>
              {hasMoreToLoad ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMore(true)}
                >
                  Pokaż starsze pozycje
                </Button>
              ) : null}
            </div>
          )}
          {visibleRows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500" aria-label="Znaczenie kolorów w archiwum">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-1 shrink-0 rounded-full bg-emerald-300" aria-hidden />
                <span>Zrealizowane</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-1 shrink-0 rounded-full bg-red-300" aria-hidden />
                <span>Anulowane / wycofane</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-1 shrink-0 rounded-full bg-violet-300" aria-hidden />
                <span>Informacyjne</span>
              </span>
            </div>
          ) : null}
          {hasMoreToLoad ? (
            <div className="flex items-center justify-center border-t border-slate-100 px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMore((v) => !v)}
              >
                {showMore
                  ? `Pokaż tylko ostatnie ${ARCHIVE_RECENT_DAYS} dni`
                  : `Pokaż więcej · ${countLabel(filteredExtended.length)} z ${ARCHIVE_EXPANDED_DAYS} dni`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
    </div>
  );
}
