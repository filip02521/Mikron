"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { locationLabel } from "@/lib/display-labels";
import { panelToolbarSearchInputClass } from "@/lib/ui/ontime-theme";
import {
  TypeaheadDropdown,
  TypeaheadOption,
} from "@/components/ui/TypeaheadDropdown";
import { cn } from "@/lib/cn";
import type { SupplierLocation } from "@/types/database";

export type SupplierDirectoryEntry = {
  id: string;
  name: string;
  location: SupplierLocation;
  vacationNote?: string | null;
};

export function SupplierSearchField({
  suppliers,
  onSelect,
  inputId = "supplier-search",
  appearance = "default",
}: {
  suppliers: SupplierDirectoryEntry[];
  onSelect: (id: string) => void;
  inputId?: string;
  /** toolbar — wysokość jak przyciski w nagłówku panelu dziennego */
  appearance?: "default" | "toolbar";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const typeaheadId = useId();
  const listboxId = `${typeaheadId}-listbox`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 12);
    return suppliers
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, suppliers]);

  const listVisible = open && filtered.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = useCallback(
    (supplier: SupplierDirectoryEntry) => {
      onSelect(supplier.id);
      setQuery("");
      setOpen(false);
      setHighlightedIndex(0);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const hasList = filtered.length > 0;

      if (e.key === "ArrowDown" && hasList) {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setHighlightedIndex(0);
          return;
        }
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }

      if (e.key === "ArrowUp" && hasList && open) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        if (listVisible) {
          e.preventDefault();
          e.stopPropagation();
          const chosen = filtered[highlightedIndex];
          if (chosen) pick(chosen);
        }
        return;
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(0);
      }
    },
    [filtered, highlightedIndex, listVisible, open, pick]
  );

  const isToolbar = appearance === "toolbar";

  const comboboxA11y = mounted
    ? {
        role: "combobox" as const,
        "aria-expanded": listVisible,
        "aria-controls": listVisible ? listboxId : undefined,
        "aria-activedescendant": listVisible
          ? `${listboxId}-opt-${highlightedIndex}`
          : undefined,
        "aria-autocomplete": "list" as const,
      }
    : {};

  return (
    <div
      className={cn(
        "min-w-0",
        isToolbar ? "w-full" : "relative flex-1 sm:max-w-xs"
      )}
    >
      <div ref={ref} className="relative w-full min-w-0">
        <label htmlFor={inputId} className="sr-only">
          Szukaj dostawcy
        </label>
        <input
          id={inputId}
          type="search"
          placeholder="Szukaj dostawcy… (/)"
          className={cn(
            isToolbar
              ? panelToolbarSearchInputClass
              : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          )}
          value={query}
          autoComplete="off"
          {...comboboxA11y}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <TypeaheadDropdown open={listVisible} listboxId={listboxId}>
          {filtered.map((s, index) => (
            <TypeaheadOption
              key={s.id}
              optionId={`${listboxId}-opt-${index}`}
              title={s.name}
              subtitle={`${locationLabel(s.location)}${s.vacationNote ? " · urlop" : ""}`}
              highlighted={highlightedIndex === index}
              onHighlight={() => setHighlightedIndex(index)}
              onSelect={() => pick(s)}
            />
          ))}
        </TypeaheadDropdown>
      </div>
    </div>
  );
}
