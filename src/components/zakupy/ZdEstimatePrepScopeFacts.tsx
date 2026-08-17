"use client";

import { cn } from "@/lib/cn";
import { buildZdEstimateScopeFactParts } from "@/lib/orders/zd-estimate-scope-facts";
import {
  zdEstimateChromeGapClass,
  zdEstimateScopeFactChipAccentClass,
  zdEstimateScopeFactChipClass,
  zdEstimateScopeFactMetaClass,
  zdEstimateScopeFactPrimaryClass,
} from "@/lib/ui/ontime-theme";

/**
 * Belka faktów zakresu — inline (prep) / toolbar (top bar).
 * Toolbar: jeden primary + cicha linia meta (bez dublowania Holtrade×2).
 */
export function ZdEstimatePrepScopeFacts({
  variant,
  scopeName,
  stockLabel,
  dniZapasu,
  supplierLabel,
  dataOd,
  dataDo,
  className,
}: {
  variant: "inline" | "toolbar";
  scopeName: string;
  stockLabel: string | null;
  dniZapasu: string;
  supplierLabel: string | null;
  dataOd: string;
  dataDo: string;
  className?: string;
}) {
  const parts = buildZdEstimateScopeFactParts({
    scopeName,
    stockLabel,
    dniZapasu,
    supplierLabel,
    dataOd,
    dataDo,
  });

  const toolbar = variant === "toolbar";
  const metaBits = [
    parts.supplier,
    parts.stock,
    parts.window,
  ].filter(Boolean) as string[];

  if (toolbar) {
    return (
      <div
        className={cn("flex h-8 min-w-0 w-full items-center gap-2", className)}
        role="status"
        aria-label="Parametry zakresu"
        title={parts.summaryTitle}
      >
        <span className={zdEstimateScopeFactPrimaryClass}>{parts.primary}</span>
        {metaBits.length > 0 ? (
          <p className={zdEstimateScopeFactMetaClass}>{metaBits.join(" · ")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center",
        zdEstimateChromeGapClass,
        className
      )}
      role="status"
      aria-label="Parametry zakresu"
      title={parts.summaryTitle}
    >
      <span className={zdEstimateScopeFactChipAccentClass} title={parts.primary}>
        {parts.primary}
      </span>
      <span className={cn(zdEstimateScopeFactChipClass, "tabular-nums")}>
        {parts.stock}
      </span>
      {parts.supplier ? (
        <span className={zdEstimateScopeFactChipClass} title={parts.supplier}>
          {parts.supplier}
        </span>
      ) : null}
      <span
        className="inline-flex h-7 items-center text-[11px] tabular-nums tracking-tight text-slate-500"
        title={`Okno sprzedaży: ${parts.window}`}
      >
        {parts.window}
      </span>
    </div>
  );
}
