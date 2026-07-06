"use client";

import { memo } from "react";
import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import { ProductSourceBadge } from "@/components/orders/ProductSourceBadge";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import { sharedRequestNoteFromLines } from "@/lib/orders/sales-request-note";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

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
}: {
  line: ForSomeoneLine;
  className?: string;
  /** Gdy notatka jest już w nagłówku grupy — nie duplikuj na każdej pozycji. */
  suppressRequestNote?: boolean;
  /** Gdy klient jest już w nagłówku grupy — nie duplikuj na pozycji. */
  suppressClient?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-md border border-slate-100/80 bg-slate-50/50 px-2 py-1.5 text-xs",
        className
      )}
    >
      <ProcurementRequestLineContent
        line={line}
        suppressRequestNote={suppressRequestNote}
        suppressClient={suppressClient}
      />
    </li>
  );
});

/** Jedna pozycja inline w nagłówku grupy (bez osobnej listy). */
export const ProcurementRequestLineInline = memo(function ProcurementRequestLineInline({
  line,
  className,
  suppressRequestNote = false,
  suppressClient = false,
}: {
  line: ForSomeoneLine;
  className?: string;
  suppressRequestNote?: boolean;
  suppressClient?: boolean;
}) {
  return (
    <div className={cn("mt-1", className)}>
      <ProcurementRequestLineContent
        line={line}
        compact
        suppressRequestNote={suppressRequestNote}
        suppressClient={suppressClient}
      />
    </div>
  );
});

function ProcurementRequestLineContent({
  line,
  compact = false,
  suppressRequestNote = false,
  suppressClient = false,
}: {
  line: ForSomeoneLine;
  compact?: boolean;
  suppressRequestNote?: boolean;
  suppressClient?: boolean;
}) {
  const isInformacja = line.requestKind === "informacja";
  const hasMeta =
    (line.symbol && line.symbol !== "-") || (line.quantity && line.quantity !== "-" && !isInformacja);

  return (
    <>
      <p
        className={cn(
          "flex items-start gap-1.5 font-medium text-slate-900",
          compact ? "text-[11px] leading-snug" : "text-xs"
        )}
      >
        <ProductSourceBadge
          fromSubiekt={line.fromSubiekt}
          className={cn("mt-0.5 shrink-0", compact ? "size-4" : "size-5")}
        />
        <span className="min-w-0 flex-1">
          {line.products}
        </span>
      </p>
      {hasMeta ? (
        <p className={cn("mt-0.5 text-slate-500", compact ? "pl-5 text-[10px]" : "text-xs")}>
          {line.symbol && line.symbol !== "-" ? line.symbol : null}
          {line.symbol && line.symbol !== "-" && line.quantity && line.quantity !== "-" && line.quantity !== "—" && !isInformacja
            ? " · "
            : null}
          {isInformacja
            ? "Informacja o dostępności"
            : line.quantity && line.quantity !== "-" && line.quantity !== "—"
              ? `Ilość: ${line.quantity}`
              : null}
        </p>
      ) : null}
      {line.clientName && !suppressClient ? (
        <MyOrderAssignedClient
          name={line.clientName}
          className={cn(compact ? "mt-1 pl-5" : "mt-1.5")}
        />
      ) : null}
      {line.requestNote && !suppressRequestNote ? (
        <ProcurementSalesRequestNote
          note={line.requestNote}
          compact={compact}
          className={cn(compact ? "mt-1 pl-5" : "mt-1.5")}
        />
      ) : null}
    </>
  );
}

export function procurementGroupRequestNote(
  lines: ForSomeoneLine[]
): string | null {
  return sharedRequestNoteFromLines(lines);
}
