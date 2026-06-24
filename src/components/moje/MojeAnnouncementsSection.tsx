"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import { IconChevronDown, IconInbox, IconPin } from "@/components/icons/StrokeIcons";
import { SalesListFilterEmptyHint } from "@/components/sales/SalesListEmptyHints";
import { Alert } from "@/components/ui/Alert";
import {
  DEPARTMENT_BOARD_ANNOUNCEMENTS_EXPLAINER,
  DEPARTMENT_BOARD_ANNOUNCEMENTS_SEARCH,
} from "@/lib/department-board/copy";
import { filterDepartmentBoardAnnouncementsByQuery } from "@/lib/department-board/announcement-search";
import { authorLabelFromProfile, formatBoardDate } from "@/lib/department-board/format";
import { MOJE_ANNOUNCEMENTS_SECTION_ID } from "@/lib/department-board/moje-announcements-ui";
import type {
  DepartmentBoardAnnouncementsSlice,
  DepartmentBoardThreadRow,
} from "@/lib/data/department-board";
import { actionMarkAnnouncementRead } from "@/app/actions/department-board";
import { cn } from "@/lib/cn";
import { useDeepLinkScrollOnce } from "@/hooks/use-deep-link-scroll-once";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { salesSearchPlaceholder } from "@/lib/sales/sales-search-ui";
import { SALES_SEARCH_COPY } from "@/lib/sales/sales-page-ui-copy";
import {
  mojeQueueRowLayoutClass,
  mojeShipmentListClass,
  mojeShipmentSectionShellClass,
} from "@/lib/ui/moje-shipment-row-styles";
import { brandLinkClass, salesTypography } from "@/lib/ui/ontime-theme";

function sortAnnouncementsForMoje(
  rows: DepartmentBoardThreadRow[],
  readSet: Set<string>
): DepartmentBoardThreadRow[] {
  return [...rows].sort((a, b) => {
    const aUnread = !readSet.has(a.id);
    const bUnread = !readSet.has(b.id);
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (
      new Date(b.published_at ?? b.created_at).getTime() -
      new Date(a.published_at ?? a.created_at).getTime()
    );
  });
}

function MojeAnnouncementCompactRow({
  thread,
  unread,
  expanded,
  tourDemo,
  onToggle,
  onRead,
}: {
  thread: DepartmentBoardThreadRow;
  unread: boolean;
  expanded: boolean;
  tourDemo: boolean;
  onToggle: () => void;
  onRead: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    markedRef.current = false;
  }, [thread.id, unread]);

  useEffect(() => {
    if (!expanded || !unread || tourDemo || !bodyRef.current) return;

    const node = bodyRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.35);
        if (!visible || markedRef.current) return;
        markedRef.current = true;
        void actionMarkAnnouncementRead(thread.id)
          .then(onRead)
          .catch(() => {
            markedRef.current = false;
          });
      },
      { threshold: [0.35, 0.5] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, unread, tourDemo, thread.id, onRead]);

  const author = authorLabelFromProfile(thread.author, "Zakupy");
  const dateLabel = formatBoardDate(thread.published_at);

  return (
    <li
      id={`announcement-${thread.id}`}
      className={cn(
        "border-l-[3px] border-b border-slate-100 last:border-b-0",
        unread ? "border-l-sky-500 bg-sky-50/25" : "border-l-slate-200 bg-white"
      )}
    >
      <button
        type="button"
        className={cn(mojeQueueRowLayoutClass, "w-full px-3 py-2.5 text-left sm:px-4")}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {unread ? (
              <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Nowe
              </span>
            ) : null}
            {thread.pinned ? (
              <IconPin size={12} className="shrink-0 text-indigo-500" aria-label="Przypięte" />
            ) : null}
            <span
              className={cn(
                salesTypography.rowTitle,
                "min-w-0 truncate",
                unread && "text-slate-950"
              )}
            >
              {thread.title}
            </span>
          </div>
          <p className={cn(salesTypography.rowBody, "mt-0.5 truncate")}>
            {author} · {dateLabel}
          </p>
        </div>
        <IconChevronDown open={expanded} size={15} className="shrink-0 text-slate-400" />
      </button>
      {expanded ? (
        <div
          ref={bodyRef}
          className="border-t border-slate-100/80 px-3 pb-3 pt-2 text-sm leading-relaxed text-slate-700 sm:px-4"
        >
          <p className="whitespace-pre-wrap">{thread.body}</p>
        </div>
      ) : null}
    </li>
  );
}

function hashRequestsAnnouncementsExpand(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.replace(/^#/, "") === MOJE_ANNOUNCEMENTS_SECTION_ID;
}

export function MojeAnnouncementsSection({
  announcements,
  readAnnouncementIds,
  focusAnnouncementId = null,
  tourDemo = false,
}: {
  announcements: DepartmentBoardAnnouncementsSlice["announcements"];
  readAnnouncementIds: string[];
  focusAnnouncementId?: string | null;
  tourDemo?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const tablicaHref = hrefWithSalesPreviewFromUrl("/tablica", previewDla);
  const [search, setSearch] = useState("");
  const [optimisticReadIds, setOptimisticReadIds] = useState<string[]>([]);
  const readIds = useMemo(
    () => new Set([...readAnnouncementIds, ...optimisticReadIds]),
    [readAnnouncementIds, optimisticReadIds]
  );
  const initialUnread = announcements.filter((a) => !readAnnouncementIds.includes(a.id)).length;
  const autoSectionExpanded = Boolean(focusAnnouncementId) || initialUnread > 0;
  const [hashExpand] = useState(() => hashRequestsAnnouncementsExpand());
  const [userSectionExpanded, setUserSectionExpanded] = useState<boolean | null>(null);
  const sectionExpanded = userSectionExpanded ?? (autoSectionExpanded || hashExpand);
  const [userOpenRowId, setUserOpenRowId] = useState<string | null>(null);
  const [dismissedFocusId, setDismissedFocusId] = useState<string | null>(null);
  const effectiveFocusId =
    focusAnnouncementId && focusAnnouncementId !== dismissedFocusId
      ? focusAnnouncementId
      : null;
  const openRowId = userOpenRowId ?? effectiveFocusId;

  const unreadCount = useMemo(
    () => announcements.filter((a) => !readIds.has(a.id)).length,
    [announcements, readIds]
  );

  const focusAnnouncementMissing = Boolean(
    focusAnnouncementId && !announcements.some((row) => row.id === focusAnnouncementId)
  );

  const clearAnnouncementFocusFromUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("ogloszenie")) return;
    params.delete("ogloszenie");
    const qs = params.toString();
    router.replace(qs ? `/moje?${qs}` : "/moje", { scroll: false });
  };

  const searchNeedle = search.trim();
  const filtered = useMemo(
    () => filterDepartmentBoardAnnouncementsByQuery(announcements, search),
    [announcements, search]
  );

  const sorted = useMemo(
    () => sortAnnouncementsForMoje(filtered, readIds),
    [filtered, readIds]
  );

  useDeepLinkScrollOnce(
    effectiveFocusId && !focusAnnouncementMissing
      ? `announcement-${effectiveFocusId}`
      : null,
    Boolean(effectiveFocusId && !focusAnnouncementMissing),
    180
  );

  if (announcements.length === 0) return null;

  function refresh() {
    router.refresh();
  }

  function markReadLocally(id: string) {
    setOptimisticReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    refresh();
  }

  const sectionSummary =
    unreadCount > 0
      ? `${unreadCount} ${unreadCount === 1 ? "nowe" : "nowych"}`
      : `${announcements.length} ${announcements.length === 1 ? "ogłoszenie" : announcements.length < 5 ? "ogłoszenia" : "ogłoszeń"}`;

  return (
    <div id={MOJE_ANNOUNCEMENTS_SECTION_ID} className="scroll-mt-24">
      <div className={mojeShipmentSectionShellClass}>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 text-left sm:px-4"
          onClick={() =>
            setUserSectionExpanded(
              !(userSectionExpanded ?? (autoSectionExpanded || hashExpand))
            )
          }
          aria-expanded={sectionExpanded}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-800">
            <IconInbox size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn(salesTypography.blockTitle, "text-slate-900")}>
              {DEPARTMENT_BOARD_ANNOUNCEMENTS_EXPLAINER.title}
            </span>
            <span className={cn(salesTypography.sectionHint, "ml-1.5")}>
              · {sectionSummary}
            </span>
          </span>
          <IconChevronDown open={sectionExpanded} size={16} className="shrink-0 text-slate-400" />
        </button>

        {sectionExpanded ? (
          <div>
            {focusAnnouncementMissing ? (
              <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
                <Alert tone="warning">
                  Nie znaleziono wskazanego ogłoszenia — mogło wygasnąć lub zostać usunięte.
                </Alert>
              </div>
            ) : null}

            {announcements.length > 4 ? (
              <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
                <NotatnikListFilterBar
                  embedded
                  bleed
                  compact
                  value={search}
                  onChange={setSearch}
                  matchCount={filtered.length}
                  totalCount={announcements.length}
                  placeholder={salesSearchPlaceholder(SALES_SEARCH_COPY.boardAnnouncements)}
                  searchLabel={DEPARTMENT_BOARD_ANNOUNCEMENTS_SEARCH.label}
                  showIdleHint={false}
                  showActiveDetail={false}
                  emptyMatchHint="Brak dopasowań — sprawdź tytuł lub treść ogłoszenia."
                />
              </div>
            ) : null}

            {searchNeedle && sorted.length === 0 ? (
              <div className="px-3 py-3 sm:px-4">
                <SalesListFilterEmptyHint
                  query={searchNeedle}
                  onClear={() => setSearch("")}
                  entityLabel="ogłoszeń"
                />
              </div>
            ) : (
              <ul className={mojeShipmentListClass}>
                {sorted.map((thread) => {
                  const unread = !readIds.has(thread.id);
                  const expanded = openRowId === thread.id;
                  return (
                    <MojeAnnouncementCompactRow
                      key={thread.id}
                      thread={thread}
                      unread={unread}
                      expanded={expanded}
                      tourDemo={tourDemo}
                      onToggle={() => {
                        const currentOpenId = userOpenRowId ?? effectiveFocusId ?? null;
                        if (currentOpenId === thread.id) {
                          if (effectiveFocusId === thread.id) {
                            setDismissedFocusId(thread.id);
                            clearAnnouncementFocusFromUrl();
                          }
                          setUserOpenRowId(null);
                          return;
                        }
                        setUserOpenRowId(thread.id);
                      }}
                      onRead={() => markReadLocally(thread.id)}
                    />
                  );
                })}
              </ul>
            )}

            {!searchNeedle && announcements.length > 3 ? (
              <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 sm:px-4">
                Pytania do zakupów zadajesz na{" "}
                <Link href={tablicaHref} className={brandLinkClass}>
                  Tablicy
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
