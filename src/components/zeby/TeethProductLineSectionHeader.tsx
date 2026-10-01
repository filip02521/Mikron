"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TeethProductLine } from "@/lib/teeth/teeth-catalog-types";
import { teethProductLineAccent } from "@/lib/teeth/teeth-panel-product-line-ui";
import { IconChevronDown } from "@/components/icons/StrokeIcons";

/** Id kotwicy sekcji linii w karcie dostawcy (chipy w nagłówku przewijają do niej). */
export function teethLineSectionDomId(scope: string, supplierId: string | null, lineKey: string): string {
  return `teeth-${scope}-${(supplierId ?? "none").replace(/[^a-z0-9-]/gi, "")}-${lineKey}`;
}

/** Pasek nagłówka podsekcji linii produktowej (np. Phonares II) w karcie dostawcy. */
export function TeethProductLineSectionHeader({
  productLine,
  label,
  meta,
  leading,
  trailing,
  expanded,
  onToggle,
  controlsId,
}: {
  productLine: TeethProductLine | null;
  label: string;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Z `onToggle` nagłówek staje się przyciskiem zwijania sekcji. */
  expanded?: boolean;
  onToggle?: () => void;
  controlsId?: string;
}) {
  const accent = teethProductLineAccent(productLine);
  const title = (
    <>
      <span className={cn("h-4 w-1 shrink-0 rounded-full", accent.dot)} aria-hidden />
      <h3 className={cn("text-sm font-semibold", accent.text)}>{label}</h3>
      {meta ? <span className="text-xs text-slate-500">{meta}</span> : null}
    </>
  );
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-2 sm:px-5",
        accent.header,
      )}
    >
      {leading}
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={controlsId}
          className="-mx-1 flex min-w-0 flex-1 items-center gap-x-3 gap-y-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-black/[0.03]"
        >
          <IconChevronDown
            size={15}
            className={cn("shrink-0 text-slate-400 transition-transform", !expanded && "-rotate-90")}
            aria-hidden
          />
          {title}
        </button>
      ) : (
        title
      )}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

/** Chipy z liniami w nagłówku karty dostawcy — klik przewija do sekcji. */
export function TeethProductLineChips({
  sections,
  sectionDomId,
  onSelect,
}: {
  sections: Array<{ key: string; productLine: TeethProductLine | null; label: string; count: number }>;
  sectionDomId: (key: string) => string;
  /** Np. rozwinięcie zwiniętej sekcji przed przewinięciem do niej. */
  onSelect?: (key: string) => void;
}) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label="Linie produktowe u dostawcy" className="mt-2 flex flex-wrap gap-1.5">
      {sections.map((section) => {
        const accent = teethProductLineAccent(section.productLine);
        return (
          <a
            key={section.key}
            href={`#${sectionDomId(section.key)}`}
            onClick={
              onSelect
                ? (e) => {
                    e.preventDefault();
                    onSelect(section.key);
                    // Po rozwinięciu poczekaj na commit Reacta, potem przewiń do nagłówka linii.
                    window.setTimeout(
                      () =>
                        document
                          .getElementById(sectionDomId(section.key))
                          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                      50,
                    );
                  }
                : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50"
          >
            <span className={cn("size-2 rounded-full", accent.dot)} aria-hidden />
            {section.label}
            <span className="tabular-nums text-slate-400">{section.count}</span>
          </a>
        );
      })}
    </nav>
  );
}
