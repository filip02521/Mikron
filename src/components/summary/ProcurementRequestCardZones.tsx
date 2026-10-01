import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  procurementRequestContextMetaClass,
  procurementRequestContextStripClass,
  procurementRequestOrderBodyClass,
  procurementRequestOrderBodyFlatClass,
  procurementRequestOrderBodyInteractiveClass,
} from "@/components/summary/procurement-request-row-styles";
import { panelTypography } from "@/lib/ui/ontime-theme";

/** Strefa H — tytuł (lewa) + planowe / meta terminu (prawa). */
export function ProcurementRequestCardHeader({
  title,
  trailing,
  className,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-2", className)}>
      <div className="min-w-0 flex-1">{title}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

/**
 * Strefa C — opcjonalnie dwie linie: chipy (statusy), potem meta tekstowe (osoba · ETA).
 * Łatwiejszy skan niż jeden wspólny wrap wszystkiego.
 */
export function ProcurementRequestContextBlock({
  chips,
  meta,
  className,
}: {
  chips?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  if (!chips && !meta) return null;
  return (
    <div className={cn("mt-0.5 flex min-w-0 flex-col gap-0.5", className)}>
      {chips ? (
        <div className={procurementRequestContextStripClass}>{chips}</div>
      ) : null}
      {meta ? (
        <div className={procurementRequestContextMetaClass}>{meta}</div>
      ) : null}
    </div>
  );
}

/** Strefa P — inset zamówienia (produkt, uwagi, expand). */
export function ProcurementRequestOrderBody({
  children,
  className,
  /** Bez ramki — typowy przypadek pojedynczego produktu. */
  flat = false,
  /** Podświetlenie przy hoverze karty (klik rozwija produkty). */
  interactive = false,
  tone = "prosby",
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
  interactive?: boolean;
  tone?: "prosby" | "stockOut";
}) {
  return (
    <div
      className={cn(
        flat ? procurementRequestOrderBodyFlatClass : procurementRequestOrderBodyClass,
        interactive && procurementRequestOrderBodyInteractiveClass(tone),
        // Flat też potrzebuje ramki-tła przy hoverze, żeby produkty były czytelne.
        interactive &&
          flat &&
          (tone === "stockOut"
            ? "rounded-md border border-transparent px-1.5 py-1 group-hover/panelRow:border-amber-200/90 group-hover/panelRow:bg-amber-50/70"
            : "rounded-md border border-transparent px-1.5 py-1 group-hover/panelRow:border-indigo-200/80 group-hover/panelRow:bg-indigo-50/55"),
        className
      )}
    >
      {children}
    </div>
  );
}

/** Separator tekstowy w pasku kontekstu (nie między chipami). */
export function ProcurementRequestContextSep({ className }: { className?: string }) {
  return (
    <span
      className={cn("select-none text-[10px] text-slate-300", className)}
      aria-hidden
    >
      ·
    </span>
  );
}

/** Fragment meta z separatorem przed (gdy nie pierwszy). */
export function ProcurementRequestContextMetaItem({
  children,
  showSep,
  className,
  emphasis = false,
  title,
}: {
  children: ReactNode;
  showSep?: boolean;
  className?: string;
  /** Osoba / kluczowy kontekst — mocniejszy niż ETA. */
  emphasis?: boolean;
  title?: string;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-x-1.5" title={title}>
      {showSep ? <ProcurementRequestContextSep /> : null}
      <span
        className={cn(
          emphasis
            ? cn(panelTypography.rowMeta, "font-medium text-slate-700")
            : cn(panelTypography.caption, "text-slate-500"),
          className
        )}
      >
        {children}
      </span>
    </span>
  );
}
