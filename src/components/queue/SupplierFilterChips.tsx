"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { SupplierCountChip } from "@/lib/orders/supplier-filter-summary";
import {
  queueToolbarFieldLabelClass,
  queueToolbarInputClass,
} from "@/lib/ui/queue-panel-styles";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSuccessSelectedClass,
} from "@/lib/ui/ontime-theme";

const SEARCH_THRESHOLD = 7;
const COLLAPSED_VISIBLE = 5;

function SupplierChip({
  label,
  count,
  active,
  onClick,
  title,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex max-w-[14rem] shrink-0 items-center gap-1.5 px-2.5 py-1.5",
        active ? panelChoiceChipSuccessSelectedClass : panelChoiceChipIdleClass
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            "shrink-0 rounded px-1 py-px text-[10px] font-semibold tabular-nums",
            active ? "bg-emerald-100/80 text-emerald-900" : "bg-slate-100 text-slate-600"
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
  className,
}: {
  chips: SupplierCountChip[];
  value: string;
  onChange: (supplierKey: string) => void;
  totalLabel?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const clearFilter = useCallback(() => {
    onChange("");
    setQuery("");
    setExpanded(false);
  }, [onChange]);

  const chipsKey = chips.map((chip) => chip.key).join("\0");
  const [appliedInvalidClearKey, setAppliedInvalidClearKey] = useState("");
  const invalidClearKey =
    value && !chips.some((chip) => chip.key === value) ? `${value}\0${chipsKey}` : "";
  if (invalidClearKey && invalidClearKey !== appliedInvalidClearKey) {
    setAppliedInvalidClearKey(invalidClearKey);
    clearFilter();
  }

  const total = useMemo(() => chips.reduce((n, c) => n + c.count, 0), [chips]);

  const filteredChips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chips;
    return chips.filter((c) => c.key.toLowerCase().includes(q));
  }, [chips, query]);

  const showSearch = chips.length >= SEARCH_THRESHOLD;
  const canCollapse = chips.length > COLLAPSED_VISIBLE && !query.trim();

  const visibleChips = useMemo(() => {
    if (!canCollapse || expanded) return filteredChips;
    const top = filteredChips.slice(0, COLLAPSED_VISIBLE);
    if (!value) return top;
    if (top.some((c) => c.key === value)) return top;
    const selected = filteredChips.find((c) => c.key === value);
    return selected ? [...top.slice(0, COLLAPSED_VISIBLE - 1), selected] : top;
  }, [canCollapse, expanded, filteredChips, value]);

  const hiddenCount =
    canCollapse && !expanded ? Math.max(0, filteredChips.length - visibleChips.length) : 0;

  if (chips.length === 0) return null;

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={queueToolbarFieldLabelClass}>Dostawca</span>
        {value ? (
          <button
            type="button"
            onClick={clearFilter}
            className="text-[10px] font-medium text-emerald-700 transition hover:text-emerald-900"
          >
            Wyczyść filtr
          </button>
        ) : null}
      </div>

      {showSearch ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtruj listę dostawców…"
          className={cn(queueToolbarInputClass, "mt-1.5 h-8 py-1 text-xs")}
        />
      ) : null}

      <div
        className={cn(
          "mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:flex-wrap sm:overflow-visible"
        )}
        role="group"
        aria-label="Filtr dostawcy"
      >
        <SupplierChip
          label={totalLabel}
          count={total}
          active={!value}
          onClick={clearFilter}
        />
        {visibleChips.map((chip) => (
          <SupplierChip
            key={chip.key}
            label={chip.key}
            count={chip.count}
            active={value === chip.key}
            onClick={() => onChange(value === chip.key ? "" : chip.key)}
          />
        ))}
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn(
              panelChoiceChipClass,
              panelChoiceChipIdleClass,
              "shrink-0 px-2.5 py-1.5 text-xs"
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
              "shrink-0 px-2.5 py-1.5 text-xs"
            )}
          >
            Zwiń listę
          </button>
        ) : null}
      </div>

      {query && filteredChips.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-slate-500">Brak dostawcy pasującego do wyszukiwania.</p>
      ) : null}
    </div>
  );
}
