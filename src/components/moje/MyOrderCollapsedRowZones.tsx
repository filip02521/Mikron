"use client";

import { myOrderCollapsedProductSummary } from "@/lib/orders/my-order-row-layout";
import type { ReactNode } from "react";
import { MyOrderKindBadge } from "@/components/moje/MyOrderKindBadge";
import { MyOrderProductLaneBadge } from "@/components/moje/MyOrderProductLaneBadge";
import type { MyOrderProductLaneKind } from "@/lib/orders/my-order-lane-meta";
import type { MyOrderListKind } from "@/lib/orders/my-order-row-layout";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

export type MyOrderCollapsedRowZonesProps = {
  row: MyOrderRow;
  listKind: MyOrderListKind;
  title: string;
  contextLine: string;
  statusLine?: string | null;
  statusLineClassName?: string;
  statusHint?: string | null;
  showStatusHint?: boolean;
  chips?: ReactNode;
  patternHint?: ReactNode;
  /** Pod treścią (telefon: termin i liczba produktów). */
  footer?: ReactNode;
  searchQuery?: string | null;
  displayLaneKind?: MyOrderProductLaneKind;
  srOnlyHeadline?: string | null;
  /** Gdy liczba pozycji jest w prawym railu — nie duplikuj badge +N przy tytule. */
  showInlineLineCountBadge?: boolean;
};

/** Product-first strefy zwiniętego wiersza: L1 produkt, L2 kontekst, status/hint. */
export function MyOrderCollapsedRowZones({
  row,
  listKind,
  title,
  contextLine,
  statusLine,
  statusLineClassName,
  statusHint,
  showStatusHint,
  chips,
  patternHint,
  footer,
  searchQuery,
  displayLaneKind,
  srOnlyHeadline,
  showInlineLineCountBadge = true,
}: MyOrderCollapsedRowZonesProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-baseline gap-2">
        <SearchHighlightText
          text={title}
          searchQuery={searchQuery}
          // Telefon: nazwa produktu w 2 liniach zamiast ucięcia po kilku słowach.
          className={cn("line-clamp-2 break-words sm:block sm:truncate", salesTypography.rowTitle)}
        />
        {showInlineLineCountBadge && row.lineCount > 1 ? (
          <span
            className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-700"
            title={`${myOrderCollapsedProductSummary(row, listKind)} w prośbie - rozwiń, aby zobaczyć`}
          >
            +{row.lineCount - 1}
          </span>
        ) : null}
        <MyOrderKindBadge row={row} listKind={listKind} />
        {/* „Towar” to typ domyślny — etykieta tylko gdy coś odróżnia (zęby / mieszane). */}
        {displayLaneKind !== "regular" ? <MyOrderProductLaneBadge laneKind={displayLaneKind} /> : null}
      </div>

      {srOnlyHeadline ? <span className="sr-only">{srOnlyHeadline}</span> : null}

      {contextLine ? (
        <SearchHighlightText
          text={contextLine}
          searchQuery={searchQuery}
          className={cn("mt-0.5 truncate", salesTypography.rowMeta)}
          as="p"
        />
      ) : null}

      {statusLine ? (
        <SearchHighlightText
          text={statusLine}
          searchQuery={searchQuery}
          className={statusLineClassName}
          as="p"
        />
      ) : null}

      {showStatusHint && statusHint ? (
        <SearchHighlightText
          text={statusHint}
          searchQuery={searchQuery}
          className={cn("mt-0.5 truncate text-slate-500", salesTypography.rowMeta)}
          as="p"
        />
      ) : null}

      {chips ? <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{chips}</div> : null}

      {patternHint}

      {footer}
    </div>
  );
}
