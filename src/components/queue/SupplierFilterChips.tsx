"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { SupplierCountChip } from "@/lib/orders/supplier-filter-summary";
import { DeliveryJournalSearchField } from "@/components/queue/delivery-journal/DeliveryJournalSearchField";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelChoiceChipSuccessSelectedClass,
} from "@/lib/ui/ontime-theme";
import { matchesSearchWords } from "@/lib/search/keywords";

const SEARCH_THRESHOLD = 7;
const COLLAPSED_VISIBLE = 5;

function SupplierChip({
  label,
  count,
  active,
  onClick,
  title,
  activeClass = panelChoiceChipSelectedClass,
  activeCountClass = "bg-white text-indigo-700",
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  title?: string;
  activeClass?: string;
  activeCountClass?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex min-h-11 max-w-[14rem] shrink-0 items-center gap-1.5 px-2.5 py-1.5 transition sm:min-h-8",
        active ? activeClass : panelChoiceChipIdleClass
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            "shrink-0 rounded px-1 py-px text-[0.625rem] font-semibold tabular-nums",
            active ? activeCountClass : "bg-slate-100 text-slate-600"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function SupplierFilterChips({
  chips,
  value,
  onChange,
  totalLabel = "Wszyscy",
  fieldLabel = "Dostawca",
  className,
  accentVariant = "indigo",
}: {
  chips: SupplierCountChip[];
  value: string;
  onChange: (supplierKey: string) => void;
  totalLabel?: string;
  fieldLabel?: string;
  className?: string;
  accentVariant?: "emerald" | "indigo";
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const clearFilter = useCallback(() => {
    onChange("");
    setQuery("");
    setExpanded(false);
  }, [onChange]);

  const total = useMemo(() => chips.reduce((n, c) => n + c.count, 0), [chips]);

  const filteredChips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chips;
    return chips.filter((c) => matchesSearchWords(c.key, q));
  }, [chips, query]);

  const showSearch = chips.length >= SEARCH_THRESHOLD;
  const canCollapse = chips.length > COLLAPSED_VISIBLE && !query.trim();

  const visibleChips = useMemo(() => {
    let list: SupplierCountChip[];
    if (!canCollapse || expanded) {
      list = filteredChips;
    } else {
      const top = filteredChips.slice(0, COLLAPSED_VISIBLE);
      if (!value) list = top;
      else if (top.some((c) => c.key === value)) list = top;
      else {
        const selected = filteredChips.find((c) => c.key === value);
        list = selected ? [...top.slice(0, COLLAPSED_VISIBLE - 1), selected] : top;
      }
    }
    if (value && !list.some((chip) => chip.key === value) && !filteredChips.some((c) => c.key === value)) {
      return [...list, { key: value, count: 0 }];
    }
    if (value && !list.some((chip) => chip.key === value)) {
      const selected = filteredChips.find((c) => c.key === value);
      if (selected) return [...list, selected];
    }
    return list;
  }, [canCollapse, expanded, filteredChips, value]);

  const hiddenCount =
    canCollapse && !expanded ? Math.max(0, filteredChips.length - visibleChips.length) : 0;

  // Wybrany chip filtra jest zawsze w Petrolu (DESIGN.md → „Jedno wybrane”); emerald zostaje dla zgodności wywołań.
  const activeClass =
    accentVariant === "indigo" ? panelChoiceChipSelectedClass : panelChoiceChipSuccessSelectedClass;
  const activeCountClass =
    accentVariant === "indigo" ? "bg-white text-indigo-700" : "bg-emerald-100/80 text-emerald-900";
  const clearFilterClass =
    "inline-flex min-h-11 items-center text-xs font-medium text-indigo-700 underline-offset-2 transition hover:text-indigo-900 hover:underline sm:min-h-0";

  if (chips.length === 0) return null;

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      {value ? (
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={clearFilter}
            className={clearFilterClass}
          >
            Wyczyść filtr
          </button>
        </div>
      ) : null}

      {showSearch ? (
        <div className="sm:max-w-xs">
          <DeliveryJournalSearchField
            id="receive-supplier-chip-search"
            label={`Filtruj: ${fieldLabel.toLowerCase()}`}
            hideLabel
            value={query}
            onChange={setQuery}
            placeholder="Filtruj listę dostawców…"
            className="w-full"
          />
        </div>
      ) : null}

      <div
        className={cn(
          showSearch ? "mt-2" : null,
          "flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:flex-wrap sm:overflow-visible"
        )}
        role="group"
        aria-label={`Filtr: ${fieldLabel.toLowerCase()}`}
      >
        <SupplierChip
          label={totalLabel}
          count={total}
          active={!value}
          onClick={clearFilter}
          activeClass={activeClass}
          activeCountClass={activeCountClass}
        />
        {visibleChips.map((chip) => (
          <SupplierChip
            key={chip.key}
            label={chip.key}
            count={chip.count}
            active={value === chip.key}
            onClick={() => onChange(value === chip.key ? "" : chip.key)}
            activeClass={activeClass}
            activeCountClass={activeCountClass}
          />
        ))}
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn(
              panelChoiceChipClass,
              panelChoiceChipIdleClass,
              "min-h-11 shrink-0 px-2.5 py-1.5 text-xs sm:min-h-8"
            )}
          >
            +{hiddenCount} więcej
          </button>
        ) : null}
        {canCollapse && expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className={cn(
              panelChoiceChipClass,
              panelChoiceChipIdleClass,
              "min-h-11 shrink-0 px-2.5 py-1.5 text-xs sm:min-h-8"
            )}
          >
            Zwiń listę
          </button>
        ) : null}
      </div>

      {query && filteredChips.length === 0 ? (
        <p className="mt-1.5 text-[0.6875rem] text-slate-500">Brak dostawcy pasującego do wyszukiwania.</p>
      ) : null}
    </div>
  );
}
