"use client";

import { useEffect, useMemo, useRef } from "react";
import { actionFetchProsbaLineStock } from "@/app/actions/subiekt";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  applyProsbaLineStockMap,
  prosbaLinesStockSyncSignature,
  uniqueProsbaLineTwIds,
} from "@/lib/orders/prosba-stock-check";
import type { IndividualRequestKind } from "@/types/database";

const STOCK_SYNC_DEBOUNCE_MS = 450;

/**
 * Uzupełnia / odświeża stan magazynowy linii prośby (pick ZK, zmiana ilości, brak danych po prefill).
 */
export function useProsbaLinesStockSync(
  lines: ProductLineDraft[],
  onChange: (lines: ProductLineDraft[]) => void,
  requestKind: IndividualRequestKind,
  enabled: boolean
) {
  const linesRef = useRef(lines);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    linesRef.current = lines;
    onChangeRef.current = onChange;
  });

  const syncSignature = useMemo(
    () => (enabled ? prosbaLinesStockSyncSignature(lines, requestKind) : ""),
    [enabled, lines, requestKind]
  );

  useEffect(() => {
    if (!enabled || requestKind !== "zamowienie" || !syncSignature) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const currentLines = linesRef.current;
        const twIds = uniqueProsbaLineTwIds(currentLines);
        if (!twIds.length) return;

        try {
          const stock = await actionFetchProsbaLineStock(twIds);
          if (cancelled) return;
          const { next, changed } = applyProsbaLineStockMap(currentLines, stock);
          if (changed) onChangeRef.current(next);
        } catch {
          /* stan — best effort */
        }
      })();
    }, STOCK_SYNC_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, requestKind, syncSignature]);
}

