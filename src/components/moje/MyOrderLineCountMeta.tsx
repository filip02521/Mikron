"use client";

import { IconLayers } from "@/components/icons/StrokeIcons";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { cn } from "@/lib/cn";

/** Liczba pozycji w grupie — pod terminem / statusem w prawym railu wiersza. */
export function MyOrderLineCountMeta({
  label,
  expandHint,
  searchQuery,
  className,
}: {
  label: string;
  expandHint?: string;
  searchQuery?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5",
        "text-[10px] font-semibold leading-none text-indigo-800",
        "ring-1 ring-inset ring-indigo-200/75",
        className
      )}
      title={expandHint ?? label}
      aria-label={expandHint ?? label}
    >
      <IconLayers size={11} className="shrink-0 text-indigo-600/90" aria-hidden />
      <SearchHighlightText
        text={label}
        searchQuery={searchQuery}
        className="truncate tabular-nums"
        as="span"
      />
    </span>
  );
}
