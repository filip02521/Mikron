"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect } from "react";
import { ZD_ESTIMATE_TABLE_SCROLL_ID } from "@/lib/orders/zd-estimate-launch-scroll";
import {
  ZD_ESTIMATE_TABLE_ROW_ESTIMATE_PX,
  ZD_ESTIMATE_TABLE_VIRTUAL_THRESHOLD,
} from "@/lib/ui/virtual-list-config";

/**
 * Wirtualizacja tbody kreatora ZD — scroll parent = `#zd-estimate-table-scroll`.
 * Poniżej progu: wyłączone (pełny render, bez kosztu virtualizera).
 */
export function useZdEstimateTableVirtualizer(opts: {
  rowCount: number;
  /** Zmiana wymusza ponowny pomiar (filtry, kolumny, sort). */
  layoutKey: string;
  enabled?: boolean;
}) {
  const enabled =
    opts.enabled ?? opts.rowCount >= ZD_ESTIMATE_TABLE_VIRTUAL_THRESHOLD;

  // TanStack Virtual — znany wyjątek React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library -- biblioteka zewnętrzna
  const virtualizer = useVirtualizer({
    count: enabled ? opts.rowCount : 0,
    getScrollElement: () =>
      typeof document !== "undefined"
        ? document.getElementById(ZD_ESTIMATE_TABLE_SCROLL_ID)
        : null,
    estimateSize: () => ZD_ESTIMATE_TABLE_ROW_ESTIMATE_PX,
    overscan: 12,
    // React 19: measureElement→resizeItem→notify(sync) + domyślny flushSync
    // w trakcie commit (np. po Create ZD / remount wielu `<tr>`) → console error.
    // false = batch jak zwykły setState; wirtualizacja (okno DOM) bez zmian.
    useFlushSync: false,
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    // measure() i tak woła notify(false) — nie używa flushSync; zostaje sync
    // w layout, żeby po filtrze/sort cache wysokości był świeży przed paintem.
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure on layout keys
  }, [enabled, opts.layoutKey, opts.rowCount]);

  if (!enabled) {
    return {
      enabled: false as const,
      virtualRows: [] as const,
      paddingTop: 0,
      paddingBottom: 0,
      measureElement: undefined as
        | ((node: Element | null) => void)
        | undefined,
      scrollToIndex: undefined as
        | ((
            index: number,
            opts?: { align?: "start" | "center" | "end" | "auto" }
          ) => void)
        | undefined,
    };
  }

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]!.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]!.end ?? 0)
      : 0;

  return {
    enabled: true as const,
    virtualRows,
    paddingTop,
    paddingBottom,
    measureElement: virtualizer.measureElement,
    scrollToIndex: (
      index: number,
      scrollOpts?: { align?: "start" | "center" | "end" | "auto" }
    ) => {
      virtualizer.scrollToIndex(index, {
        align: scrollOpts?.align ?? "auto",
      });
    },
  };
}
