"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import { retargetTwIdToPackIfPiece } from "@/lib/orders/zd-estimate-on-request";
import { scrollZdEstimateAfterSelectionChange } from "@/lib/orders/zd-estimate-launch-scroll";

/**
 * Zaznaczenie wierszy kreatora ZD: stan, zakres Shift, liczniki paska narzędzi
 * (z „exit” podczas animacji), checkbox nagłówka i scroll po zmianie zaznaczenia.
 */
export function useZdEstimateSelection({
  lines,
  visibleLines,
  productPairs,
}: {
  lines: ManualZdEstimateLine[] | null;
  visibleLines: ManualZdEstimateLine[];
  productPairs: readonly ZdProductPairRow[];
}) {
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectAnchorTwIdRef = useRef<number | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const prevSelectedCountRef = useRef(0);
  const selectedCountLiveRef = useRef(0);
  const selectionScrollTwIdRef = useRef<number | null>(null);
  /** Pomija scroll przy programmatic clear (Policz / zmiana zakresu). */
  const skipSelectionScrollRef = useRef(false);

  const resetSelectionQuiet = useCallback(() => {
    selectionScrollTwIdRef.current = null;
    setSelected((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      skipSelectionScrollRef.current = true;
      return {};
    });
  }, []);

  const clearSucceededFromSelection = useCallback((ids: number[]) => {
    if (!ids.length) return;
    setSelected((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of ids) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  /**
   * Po bulk „Na prośbę” succeeded może być packTwId (retarget),
   * a zaznaczenie trzyma piece — czyść oba końce pary + oryginał.
   */
  const clearBulkOnRequestSelection = useCallback(
    (succeededTwIds: number[], submittedTwIds: number[]) => {
      const succeeded = new Set(succeededTwIds);
      const clearIds = new Set<number>(succeededTwIds);
      for (const twId of submittedTwIds) {
        const packId = retargetTwIdToPackIfPiece(twId, productPairs).twId;
        if (succeeded.has(twId) || succeeded.has(packId)) {
          clearIds.add(twId);
          clearIds.add(packId);
        }
      }
      clearSucceededFromSelection([...clearIds]);
    },
    [productPairs, clearSucceededFromSelection]
  );

  const selectedLines = useMemo(() => {
    if (!lines) return [];
    return lines.filter((l) => selected[l.tw_Id]);
  }, [lines, selected]);

  const selectedCount = selectedLines.length;

  // Live count dla cleanup scrolla (Strict Mode / rapid toggle) — layout, nie render.
  useLayoutEffect(() => {
    selectedCountLiveRef.current = selectedCount;
  }, [selectedCount]);

  const visibleSelectedCount = useMemo(
    () => visibleLines.filter((l) => selected[l.tw_Id]).length,
    [visibleLines, selected]
  );
  /** Ostatnie liczniki — treść paska zostaje w DOM podczas animacji exit. */
  const [selectionExitCounts, setSelectionExitCounts] = useState({
    selected: 0,
    visible: 0,
  });
  // Sync bez useEffect — unikamy react-hooks/set-state-in-effect.
  if (
    selectedCount > 0 &&
    (selectionExitCounts.selected !== selectedCount ||
      selectionExitCounts.visible !== visibleSelectedCount)
  ) {
    setSelectionExitCounts({
      selected: selectedCount,
      visible: visibleSelectedCount,
    });
  }
  const selectionToolsOpen = selectedCount > 0;
  const selectionBarSelectedCount = selectionToolsOpen
    ? selectedCount
    : selectionExitCounts.selected;
  const selectionBarVisibleSelectedCount = selectionToolsOpen
    ? visibleSelectedCount
    : selectionExitCounts.visible;
  const allVisibleSelected =
    visibleLines.length > 0 && visibleSelectedCount === visibleLines.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected;

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  useEffect(() => {
    const prev = prevSelectedCountRef.current;
    const next = selectedCount;
    if (prev === next) return;

    if (skipSelectionScrollRef.current) {
      skipSelectionScrollRef.current = false;
      prevSelectedCountRef.current = next;
      return;
    }

    const twId = selectionScrollTwIdRef.current;
    let cancelled = false;
    let ran = false;
    const followUpCancel = { current: null as (() => void) | null };
    // Delay tylko przy zaznaczeniu (animacja paska). Przy odznaczeniu scroll od razu.
    // Strict Mode: cleanup NIE przesuwa prev, gdy count nadal = next (remount
    // zobaczy prev≠next i przełoży scroll). Szybkie 0→1→0: live count już ≠ next
    // → commit prev=next, żeby deselect effect miał prev=1.
    const t = window.setTimeout(() => {
      if (cancelled) return;
      ran = true;
      prevSelectedCountRef.current = next;
      followUpCancel.current = scrollZdEstimateAfterSelectionChange({
        prevCount: prev,
        nextCount: next,
        twId,
      });
    }, next > prev ? 50 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      followUpCancel.current?.();
      followUpCancel.current = null;
      if (
        !ran &&
        prevSelectedCountRef.current === prev &&
        selectedCountLiveRef.current !== next
      ) {
        prevSelectedCountRef.current = next;
      }
    };
  }, [selectedCount]);

  const toggleRowSelected = (twId: number, shiftKey = false) => {
    selectionScrollTwIdRef.current = twId;
    if (shiftKey && selectAnchorTwIdRef.current != null) {
      const anchor = selectAnchorTwIdRef.current;
      const ids = visibleLines.map((l) => l.tw_Id);
      const a = ids.indexOf(anchor);
      const b = ids.indexOf(twId);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = { ...prev };
          for (let i = lo; i <= hi; i++) next[ids[i]!] = true;
          return next;
        });
        selectAnchorTwIdRef.current = twId;
        return;
      }
    }
    setSelected((prev) => {
      const next = { ...prev };
      if (next[twId]) delete next[twId];
      else next[twId] = true;
      return next;
    });
    selectAnchorTwIdRef.current = twId;
  };

  const selectAllVisible = () => {
    selectionScrollTwIdRef.current =
      visibleLines[visibleLines.length - 1]?.tw_Id ?? null;
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of visibleLines) next[row.tw_Id] = true;
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      selectionScrollTwIdRef.current =
        visibleLines[0]?.tw_Id ?? selectionScrollTwIdRef.current;
      setSelected((prev) => {
        const next = { ...prev };
        for (const row of visibleLines) delete next[row.tw_Id];
        return next;
      });
      return;
    }
    selectAllVisible();
  };

  return {
    selected,
    selectAnchorTwIdRef,
    headerCheckboxRef,
    resetSelectionQuiet,
    clearSucceededFromSelection,
    clearBulkOnRequestSelection,
    selectedLines,
    selectedCount,
    selectionToolsOpen,
    selectionBarSelectedCount,
    selectionBarVisibleSelectedCount,
    allVisibleSelected,
    toggleRowSelected,
    selectAllVisible,
    toggleSelectAllVisible,
  };
}
