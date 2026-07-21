"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { TypeaheadDropdown, TypeaheadOption } from "@/components/ui/TypeaheadDropdown";
import { cn } from "@/lib/cn";
import { filterSuppliersByName } from "@/lib/orders/filter-suppliers";
import { queueToolbarInputClass } from "@/lib/ui/queue-panel-styles";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

type SupplierOption = { id: string; name: string };

export function QueueSupplierDirectoryField({
  suppliers,
  value,
  onChange,
  disabled,
  placeholder = "Szukaj dostawcy…",
  emptyOptionLabel = "— inny / wpisz poniżej —",
  includeAllOption = false,
  allOptionLabel = "Wszyscy",
}: {
  suppliers: SupplierOption[];
  value: string;
  onChange: (supplierId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Pusty wybór w formularzu (np. „inny dostawca”). */
  emptyOptionLabel?: string;
  /** Filtr archiwum — opcja bez dostawcy. */
  includeAllOption?: boolean;
  allOptionLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const sorted = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [suppliers]
  );

  const selected = useMemo(
    () => sorted.find((s) => s.id === value) ?? null,
    [sorted, value]
  );

  const [query, setQuery] = useState(() => selected?.name ?? "");
  const selectedName = selected?.name ?? "";
  const [appliedSelectedName, setAppliedSelectedName] = useState(selectedName);
  if (!open && selectedName !== appliedSelectedName) {
    setAppliedSelectedName(selectedName);
    setQuery(selectedName);
  }

  const options = useMemo(() => {
    const q = query.trim();
    const matched = q ? filterSuppliersByName(sorted, q, 12) : sorted.slice(0, 12);
    const rows: Array<{ id: string; label: string; subtitle?: string }> = [];
    if (includeAllOption && !q) {
      rows.push({ id: "", label: allOptionLabel });
    }
    if (!includeAllOption && !q) {
      rows.push({ id: "", label: emptyOptionLabel });
    }
    for (const s of matched) {
      rows.push({ id: s.id, label: s.name });
    }
    return rows;
  }, [allOptionLabel, emptyOptionLabel, includeAllOption, query, sorted]);

  const listVisible = open && options.length > 0 && !disabled;
  const optionsKey = options.map((option) => option.id).join("\0");
  const [appliedOptionsKey, setAppliedOptionsKey] = useState(optionsKey);
  if (optionsKey !== appliedOptionsKey) {
    setAppliedOptionsKey(optionsKey);
    setHighlightedIndex(0);
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      const listbox = document.getElementById(listboxId);
      if (listbox?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listboxId]);

  const pick = useCallback(
    (id: string, label: string) => {
      onChange(id);
      setQuery(label);
      setOpen(false);
      setHighlightedIndex(0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!options.length) return;

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
        const chosen = options[highlightedIndex];
        if (chosen) pick(chosen.id, chosen.label);
        return;
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        setQuery(selected?.name ?? "");
      }
    },
    [highlightedIndex, listVisible, open, options, pick, selected]
  );

  return (
    <div ref={ref} className="relative min-w-0">
      <div ref={anchorRef} className="relative min-w-0">
      <label htmlFor={inputId} className="sr-only">
        {includeAllOption ? "Filtr dostawcy" : "Wybór dostawcy"}
      </label>
      <input
        id={inputId}
        type="search"
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listVisible ? listboxId : undefined}
        aria-autocomplete="list"
        className={cn(queueToolbarInputClass, "w-full", controlFocusClass)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim()) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <TypeaheadDropdown open={listVisible} listboxId={listboxId} portalled anchorRef={anchorRef}>
        {options.map((opt, index) => (
          <TypeaheadOption
            key={opt.id || `empty-${opt.label}`}
            optionId={`${listboxId}-opt-${index}`}
            title={opt.label}
            subtitle={opt.subtitle}
            highlighted={highlightedIndex === index}
            onHighlight={() => setHighlightedIndex(index)}
            onSelect={() => pick(opt.id, opt.label)}
          />
        ))}
      </TypeaheadDropdown>
      </div>
    </div>
  );
}
