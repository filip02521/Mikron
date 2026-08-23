"use client";

import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { buildZdEstimateScopeFactParts } from "@/lib/orders/zd-estimate-scope-facts";
import {
  zdEstimateScopeKindLabel,
  zdEstimateScopeLinkedCaption,
  zdEstimateScopeLinkedTitle,
} from "@/lib/orders/zd-estimate-ui-copy";
import {
  zdEstimateChromeGapClass,
  zdEstimateScopeFactChipAccentClass,
  zdEstimateScopeFactChipClass,
  zdEstimateScopeFactMetaClass,
  zdEstimateScopeFactPrimaryClass,
} from "@/lib/ui/ontime-theme";

/**
 * Belka faktów zakresu — inline (prep) / toolbar (top bar) / card (potwierdzenie wyboru).
 * Toolbar: jeden primary + cicha linia meta (bez dublowania Holtrade×2).
 */
export function ZdEstimatePrepScopeFacts({
  variant,
  scopeMode = "grupa",
  scopeName,
  stockLabel,
  dniZapasu,
  supplierLabel,
  dataOd,
  dataDo,
  caption,
  tone = "ready",
  /** toolbar: bez zapas/okna gdy edytory są w karcie prep. */
  density = "full",
  className,
}: {
  variant: "inline" | "toolbar" | "card";
  scopeMode?: "grupa" | "cecha";
  scopeName: string;
  stockLabel: string | null;
  dniZapasu: string;
  supplierLabel: string | null;
  dataOd: string;
  dataDo: string;
  /** Nadpisuje domyślny podpis w wariancie card. */
  caption?: string | null;
  tone?: "ready" | "warn";
  density?: "full" | "short";
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
  const short = density === "short";
  const metaBits = (
    short
      ? [parts.supplier]
      : [parts.supplier, parts.stock, parts.window]
  ).filter(Boolean) as string[];

  if (toolbar) {
    return (
      <div
        className={cn("flex h-8 min-w-0 w-full items-center gap-1.5 sm:gap-2", className)}
        role="status"
        aria-label="Parametry zakresu"
        title={short ? [parts.primary, parts.supplier].filter(Boolean).join(" · ") : parts.summaryTitle}
      >
        <span className={zdEstimateScopeFactPrimaryClass}>
          <span className="mr-1.5 shrink-0 font-medium text-indigo-700/70">
            {zdEstimateScopeKindLabel(scopeMode)}
          </span>
          <span className="min-w-0 truncate">{parts.primary}</span>
        </span>
        {metaBits.length > 0 ? (
          <p className={zdEstimateScopeFactMetaClass}>{metaBits.join(" · ")}</p>
        ) : null}
      </div>
    );
  }

  if (variant === "card") {
    const warn = tone === "warn";
    const captionText =
      caption === undefined ? zdEstimateScopeLinkedCaption() : caption;
    const title = [parts.summaryTitle, captionText].filter(Boolean).join(" — ");
    return (
      <div
        className={cn(
          "flex h-8 min-w-0 items-center gap-2 rounded-md border px-2.5",
          warn
            ? "border-amber-200/80 bg-amber-50/80"
            : "border-emerald-200/70 bg-emerald-50/70",
          className
        )}
        role="status"
        aria-label={zdEstimateScopeLinkedTitle(scopeMode)}
        title={title}
      >
        <IconCircleCheck
          size={14}
          strokeWidth={2.25}
          className={cn(
            "shrink-0",
            warn ? "text-amber-700" : "text-emerald-700"
          )}
          aria-hidden
        />
        <p className="min-w-0 flex-1 truncate text-[12px] leading-none">
          <span
            className={cn(
              "font-medium",
              warn ? "text-amber-800/80" : "text-emerald-800/80"
            )}
          >
            {zdEstimateScopeKindLabel(scopeMode)}
          </span>
          <span className="font-semibold tracking-tight text-slate-900">
            {" "}
            {parts.primary}
          </span>
          {metaBits.length > 0 ? (
            <span className="text-slate-500">
              {" "}
              · {metaBits.join(" · ")}
            </span>
          ) : null}
        </p>
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
