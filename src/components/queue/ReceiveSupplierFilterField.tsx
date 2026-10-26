"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { TypeaheadDropdown, TypeaheadOption } from "@/components/ui/TypeaheadDropdown";
import { IconX } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { matchesSearchWords } from "@/lib/search/keywords";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { SupplierCountChip } from "@/lib/orders/supplier-filter-summary";

type Option = { key: string; count: number };

/**
 * Filtr dostawcy w kolejce przyjęcia: jedno pole z listą i licznikami zamiast rzędu chipów.
 * Puste pole = wszyscy dostawcy; wybór pokazuje nazwę w polu i × do wyczyszczenia.
 */
export function ReceiveSupplierFilterField({
  chips,
  value,
  onChange,
  className,
}: {
  chips: SupplierCountChip[];
  value: string;
  onChange: (supplierKey: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const mounted = useClientHydrated();
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listboxId = `${id}-listbox`;

  const total = useMemo(() => chips.reduce((n, c) => n + c.count, 0), [chips]);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const list = q ? chips.filter((c) => matchesSearchWords(c.key, q)) : chips;
    // „Wszyscy” na górze tylko bez wpisanego tekstu.
    return q ? list : [{ key: "", count: total }, ...list];
  }, [chips, query, total]);

  const optionsKey = options.map((o) => o.key).join("\0");
  const [appliedKey, setAppliedKey] = useState(optionsKey);
  if (optionsKey !== appliedKey) {
    setAppliedKey(optionsKey);
    setHighlightedIndex(0);
  }

  // Lista otwarta także bez wyników — wtedy pokazuje komunikat zamiast znikać.
  const listVisible = open;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (document.getElementById(listboxId)?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listboxId]);

  const pick = useCallback(
    (key: string) => {
      onChange(key);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && listVisible) {
      e.preventDefault();
      e.stopPropagation();
      const chosen = options[highlightedIndex];
      if (chosen) pick(chosen.key);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  };

  const a11y = mounted
    ? {
        role: "combobox" as const,
        "aria-expanded": listVisible,
        "aria-controls": listVisible ? listboxId : undefined,
        "aria-activedescendant": listVisible ? `${listboxId}-opt-${highlightedIndex}` : undefined,
        "aria-autocomplete": "list" as const,
      }
    : {};

  const shown = open ? query : value;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <div ref={anchorRef} className="relative">
        <label htmlFor={`${id}-input`} className="sr-only">
          Dostawca
        </label>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          autoComplete="off"
          placeholder={open ? "Szukaj dostawcy…" : `Wszyscy dostawcy (${chips.length})`}
          value={shown}
          {...a11y}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-11 w-full rounded-md border bg-white pl-3 pr-9 text-sm text-slate-900 shadow-sm transition-colors duration-150 placeholder:text-slate-600 hover:border-slate-300 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:h-10",
            value && !open ? "border-indigo-300 bg-indigo-50/60 font-medium text-indigo-900" : "border-slate-200"
          )}
        />
        {value && !open ? (
          <button
            type="button"
            onClick={() => pick("")}
            aria-label="Pokaż wszystkich dostawców"
            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-indigo-700 hover:text-indigo-900 sm:w-10"
          >
            <IconX size={16} aria-hidden />
          </button>
        ) : (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-500">
            <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
              <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
            </svg>
          </span>
        )}
        <TypeaheadDropdown
          open={listVisible}
          listboxId={listboxId}
          portalled
          anchorRef={anchorRef}
          size="comfortable"
          emptyMessage={options.length === 0 ? "Brak dostawcy pasującego do wyszukiwania." : undefined}
        >
          {options.map((o, index) => (
            <TypeaheadOption
              key={o.key || "__all"}
              optionId={`${listboxId}-opt-${index}`}
              title={o.key || "Wszyscy dostawcy"}
              subtitle={`${o.count} ${polishPluralWord(o.count, "pozycja", "pozycje", "pozycji")}`}
              highlighted={highlightedIndex === index}
              onHighlight={() => setHighlightedIndex(index)}
              onSelect={() => pick(o.key)}
            />
          ))}
        </TypeaheadDropdown>
      </div>
    </div>
  );
}
