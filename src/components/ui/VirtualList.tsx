"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function VirtualList<T>({
  items,
  threshold,
  className,
  listClassName,
  estimateSize,
  getItemKey,
  renderItem,
  scrollToKey,
  listRole,
  enabled: enabledOverride,
  bareItems = false,
  virtualItemClassName = "border-b border-slate-100",
  remeasureKey,
}: {
  items: T[];
  threshold: number;
  /** Gdy podane — nadpisuje domyślne `items.length >= threshold`. */
  enabled?: boolean;
  /** Bez owijania w `<li>` (np. karta sama renderuje `<li>`). */
  bareItems?: boolean;
  /** Separatory między wierszami w trybie wirtualnym (zamiast `divide-y` na liście). */
  virtualItemClassName?: string;
  /** Zmiana wymusza ponowny pomiar wysokości (np. rozwinięte wiersze). */
  remeasureKey?: string | number;
  className?: string;
  listClassName?: string;
  estimateSize: (index: number, item: T) => number;
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Przewiń do elementu o tym kluczu (np. kotwica #watch-). */
  scrollToKey?: string | null;
  listRole?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const enabled = enabledOverride ?? items.length >= threshold;

  // TanStack Virtual — znany wyjątek React Compiler (funkcje z useVirtualizer).
  // eslint-disable-next-line react-hooks/incompatible-library -- biblioteka zewnętrzna
  const virtualizer = useVirtualizer({
    count: enabled ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateSize(index, items[index]!),
    overscan: 10,
  });

  useEffect(() => {
    if (!enabled || !scrollToKey) return;
    const index = items.findIndex((item, i) => getItemKey(item, i) === scrollToKey);
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when target key changes
  }, [enabled, scrollToKey, items, getItemKey]);

  useLayoutEffect(() => {
    if (!enabled) return;
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure on layout-sensitive keys
  }, [enabled, remeasureKey, items.length]);

  if (!enabled) {
    return (
      <ul className={listClassName} role={listRole}>
        {items.map((item, index) =>
          bareItems ? (
            <Fragment key={getItemKey(item, index)}>{renderItem(item, index)}</Fragment>
          ) : (
            <li key={getItemKey(item, index)} className="list-none">
              {renderItem(item, index)}
            </li>
          )
        )}
      </ul>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn(
        "max-h-[min(70vh,880px)] overflow-y-auto overflow-x-hidden overscroll-y-contain",
        className
      )}
    >
      <ul
        className={cn(listClassName, "divide-y-0")}
        role={listRole}
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const item = items[virtualRow.index]!;
          return (
            <li
              key={getItemKey(item, virtualRow.index)}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={cn("list-none", virtualItemClassName)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
