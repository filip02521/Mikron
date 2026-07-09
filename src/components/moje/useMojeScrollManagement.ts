"use client";

import { useEffect, useRef } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  parseMojeSectionHash,
  scrollToMojeSection,
  scrollToMojeCardWhenReady,
} from "@/lib/orders/moje-section-focus";
import {
  resolveSingleMyOrderSearchScrollTarget,
  filterMyOrderRowsBySearch,
} from "@/lib/orders/my-order-search";
import {
  findMyOrderRowIdsForFocusOrderIds,
} from "@/lib/orders/moje-order-focus";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

export function useMojeScrollManagement({
  focusOrderIds,
  initialFocusOrderIds,
  searchActive,
  searchTrimmed,
  searchMatchCount,
  archiveMatchCount,
  filteredZamowienia,
  filteredInformacje,
  archiwumRecentFiltered,
  archiwumExtendedFiltered,
  searchQuery,
}: {
  focusOrderIds: string[];
  initialFocusOrderIds: string | null;
  searchActive: boolean;
  searchTrimmed: string;
  searchMatchCount: number;
  archiveMatchCount: number;
  filteredZamowienia: MyOrderRow[];
  filteredInformacje: MyOrderRow[];
  archiwumRecentFiltered: MyOrderRow[];
  archiwumExtendedFiltered: MyOrderRow[];
  searchQuery: string;
}) {
  const focusScrollDoneRef = useRef(false);
  const sectionHashDoneRef = useRef(false);
  const searchScrollKeyRef = useRef<string | null>(null);

  const focusRowIds = (() => {
    if (focusOrderIds.length === 0) return new Set<string>();
    const sourceRows = [
      ...filteredZamowienia,
      ...filteredInformacje,
      ...archiwumRecentFiltered,
      ...archiwumExtendedFiltered,
    ];
    return new Set(findMyOrderRowIdsForFocusOrderIds(sourceRows, focusOrderIds));
  })();

  // 1. Section hash scroll — scroll to section based on URL #hash
  useEffect(() => {
    if (sectionHashDoneRef.current || focusOrderIds.length > 0) return;
    const sectionId = parseMojeSectionHash(window.location.hash);
    if (!sectionId) return;

    const markDoneIfScrolled = () => {
      if (scrollToMojeSection(sectionId)) {
        sectionHashDoneRef.current = true;
        return true;
      }
      return false;
    };

    if (markDoneIfScrolled()) return;
    window.setTimeout(markDoneIfScrolled, 120);
  }, [focusOrderIds.length]);

  // 2. Focus order scroll — scroll to specific card when ?focusOrders= is set
  useEffect(() => {
    if (focusScrollDoneRef.current || focusRowIds.size === 0) return;

    const visibleRows = [...filteredZamowienia, ...filteredInformacje];
    const targetRowId = visibleRows.find((row) => focusRowIds.has(row.id))?.id;
    if (!targetRowId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryScroll = () => {
      if (cancelled || focusScrollDoneRef.current) return;
      const card = document.getElementById(cardDomId(targetRowId));
      if (card) {
        focusScrollDoneRef.current = true;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        const toggle = card.querySelector<HTMLElement>("[data-moje-row-toggle]");
        toggle?.focus({ preventScroll: true });
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(tryScroll, 100);
      }
    };

    const initialTimer = window.setTimeout(tryScroll, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
    };
  }, [focusRowIds, filteredZamowienia, filteredInformacje]);

  // Reset focus scroll when the URL param changes
  useEffect(() => {
    focusScrollDoneRef.current = false;
  }, [initialFocusOrderIds]);

  // 3. Search scroll — auto-scroll to single search match
  useEffect(() => {
    if (!searchActive) {
      searchScrollKeyRef.current = null;
      return;
    }
    if (focusRowIds.size > 0) return;

    const target = resolveSingleMyOrderSearchScrollTarget({
      searchActive,
      searchTrimmed,
      searchMatchCount,
      archiveMatchCount,
      activeRows: [...filteredZamowienia, ...filteredInformacje],
      archiveRecentRows: filterMyOrderRowsBySearch(archiwumRecentFiltered, searchQuery),
      archiveExtendedRows: filterMyOrderRowsBySearch(archiwumExtendedFiltered, searchQuery),
    });
    if (!target) return;
    if (searchScrollKeyRef.current === target.scrollKey) return;
    searchScrollKeyRef.current = target.scrollKey;

    const isArchive = target.kind === "archive";
    return scrollToMojeCardWhenReady(cardDomId(target.rowId), {
      flashStyle: "outline",
      initialDelayMs: isArchive ? 220 : 180,
      retryDelayMs: isArchive ? 180 : 120,
      maxAttempts: isArchive ? 5 : 2,
    });
  }, [
    searchActive,
    searchTrimmed,
    searchMatchCount,
    archiveMatchCount,
    filteredZamowienia,
    filteredInformacje,
    archiwumRecentFiltered,
    archiwumExtendedFiltered,
    searchQuery,
    focusRowIds.size,
  ]);

  return { focusRowIds };
}
