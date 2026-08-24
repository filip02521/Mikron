"use client";

import { memo, type ReactNode } from "react";
import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import { ProductSourceBadge } from "@/components/orders/ProductSourceBadge";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import { sharedRequestNoteFromLines } from "@/lib/orders/sales-request-note";
import { cn } from "@/lib/cn";
import { panelTypography, type DailyPanelUnseenVariant } from "@/lib/ui/ontime-theme";
import {
  procurementRequestLineInOrderBodyClass,
  procurementRequestProductTitleClass,
} from "@/components/summary/procurement-request-row-styles";

/** Klient prośby — widoczny w wierszu grupy panelu Dziś. */
export function ProcurementRequestClientMeta({
  clientLabel,
  className,
}: {
  clientLabel: string | null;
  className?: string;
}) {
  if (!clientLabel) return null;

  if (clientLabel.includes("różnych klientów")) {
    return (
      <p className={cn(panelTypography.rowMeta, className)}>
        <span className="inline-flex items-center rounded bg-slate-100 px-1 py-0.5 font-semibold uppercase tracking-wide text-slate-500">
          Klienci
        </span>{" "}
        <span className="font-medium text-slate-800">{clientLabel}</span>
      </p>
    );
  }

  return <MyOrderAssignedClient name={clientLabel} className={className} />;
}

export const ProcurementRequestLine = memo(function ProcurementRequestLine({
  line,
  className,
  suppressRequestNote = false,
  suppressClient = false,
  flagSlot,
  /** Gdy linia jest w insetcie strefy P — bez drugiej ramki. */
  inOrderBody = false,
  tone = "prosby",
}: {
  line: ForSomeoneLine;
  className?: string;
  /** Gdy notatka jest już w strefie zamówienia (body) — nie duplikuj na pozycji. */
  suppressRequestNote?: boolean;
  /** Gdy klient jest już pokazany na poziomie grupy — nie duplikuj na pozycji. */
  suppressClient?: boolean;
  flagSlot?: React.ReactNode;
  inOrderBody?: boolean;
  tone?: DailyPanelUnseenVariant;
}) {
  return (
    <li
      className={cn(
        inOrderBody
          ? procurementRequestLineInOrderBodyClass
          : "rounded-md border border-slate-100/80 bg-slate-50/50 px-2 py-1.5 text-xs",
        className
      )}
    >
      <ProcurementRequestLineContent
        line={line}
        suppressRequestNote={suppressRequestNote}
        suppressClient={suppressClient}
        flagSlot={flagSlot}
        tone={tone}
      />
    </li>
  );
});

/** Jedna pozycja inline w strefie zamówienia (bez osobnej listy). */
export const ProcurementRequestLineInline = memo(function ProcurementRequestLineInline({
  line,
  className,
  suppressRequestNote = false,
  suppressClient = false,
  tone = "prosby",
}: {
  line: ForSomeoneLine;
  className?: string;
  suppressRequestNote?: boolean;
  suppressClient?: boolean;
  tone?: DailyPanelUnseenVariant;
}) {
  return (
    <div className={cn(className)}>
      <ProcurementRequestLineContent
        line={line}
        compact
        suppressRequestNote={suppressRequestNote}
        suppressClient={suppressClient}
        tone={tone}
      />
    </div>
  );
});

function ProcurementRequestLineContent({
  line,
  compact = false,
  suppressRequestNote = false,
  suppressClient = false,
  flagSlot,
  tone = "prosby",
}: {
  line: ForSomeoneLine;
  compact?: boolean;
  suppressRequestNote?: boolean;
  suppressClient?: boolean;
  flagSlot?: ReactNode;
  tone?: DailyPanelUnseenVariant;
}) {
  const hasSymbol = Boolean(line.symbol && line.symbol !== "-");
  const hasQty = Boolean(
    line.quantity && line.quantity !== "-" && line.quantity !== "—"
  );
  const hasMeta = hasSymbol || hasQty;

  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 gap-y-0.5">
      <ProductSourceBadge
        fromSubiekt={line.fromSubiekt}
        className={cn("mt-0.5 shrink-0", compact ? "size-4" : "size-5")}
      />
      <div className="min-w-0">
        <p className={procurementRequestProductTitleClass(tone)}>
          {line.products}
        </p>
        {flagSlot ? <div className="mt-1 min-w-0">{flagSlot}</div> : null}
        {hasMeta ? (
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-snug text-slate-500">
            {hasSymbol ? (
              <span className="font-mono tabular-nums text-slate-500">{line.symbol}</span>
            ) : null}
            {hasSymbol && hasQty ? (
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
            ) : null}
            {hasQty ? (
              <span className="tabular-nums">
                <span className="text-slate-400">Ilość</span> {line.quantity}
              </span>
            ) : null}
          </p>
        ) : null}
        {line.clientName && !suppressClient ? (
          <MyOrderAssignedClient name={line.clientName} className="mt-1" />
        ) : null}
        {line.requestNote && !suppressRequestNote ? (
          <ProcurementSalesRequestNote
            note={line.requestNote}
            compact={compact}
            className="mt-1"
          />
        ) : null}
      </div>
    </div>
  );
}

export function procurementGroupRequestNote(
  lines: ForSomeoneLine[]
): string | null {
  return sharedRequestNoteFromLines(lines);
}
