"use client";

import { cn } from "@/lib/cn";
import { queueToolbarFieldLabelClass } from "@/lib/ui/queue-panel-styles";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSuccessSelectedClass,
} from "@/lib/ui/ontime-theme";
import type { ZdReceiveFilterState } from "@/lib/warehouse/zd-receive-filter";

export function ReceiveQueueActiveFilters({
  productSearch,
  onClearProductSearch,
  zdFilter,
  onClearZdFilter,
}: {
  productSearch: string;
  onClearProductSearch: () => void;
  zdFilter: ZdReceiveFilterState | null;
  onClearZdFilter: () => void;
}) {
  const hasProduct = productSearch.trim().length > 0;
  if (!hasProduct && !zdFilter) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className={cn(queueToolbarFieldLabelClass, "mb-0")}>Aktywne filtry</span>
      {zdFilter ? (
        <button
          type="button"
          aria-pressed
          onClick={onClearZdFilter}
          className={cn(
            panelChoiceChipClass,
            panelChoiceChipSuccessSelectedClass,
            "inline-flex max-w-full items-center gap-1.5 px-2.5 py-1.5 text-xs transition hover:brightness-95"
          )}
          title={`Wyczyść filtr ZD: ${zdFilter.docNumber}`}
        >
          <span className="truncate">ZD: {zdFilter.docNumber}</span>
          <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 text-emerald-800/70" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 3L9 9M9 3L3 9" />
          </svg>
        </button>
      ) : null}
      {hasProduct ? (
        <button
          type="button"
          aria-pressed
          onClick={onClearProductSearch}
          className={cn(
            panelChoiceChipClass,
            panelChoiceChipIdleClass,
            "inline-flex max-w-full items-center gap-1.5 border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 transition hover:bg-slate-100"
          )}
          title="Wyczyść wyszukiwanie towaru"
        >
          <span className="truncate">Szukaj: {productSearch.trim()}</span>
          <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 3L9 9M9 3L3 9" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
