"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Field";
import {
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import {
  filterSalesPeopleByQuery,
  normalizeSalesPeopleForPicker,
  type SalesPersonPickRow,
} from "@/lib/orders/sales-people-picker";

export function SalesPersonPickerField({
  people,
  value,
  onChange,
  disabled,
  placeholder = "Szukaj handlowca…",
}: {
  people: SalesPersonPickRow[];
  value: string;
  onChange: (salesPersonId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const normalized = useMemo(() => normalizeSalesPeopleForPicker(people), [people]);
  const selected = useMemo(
    () => normalized.find((p) => p.id === value),
    [normalized, value]
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(
    () => filterSalesPeopleByQuery(normalized, query, 15),
    [normalized, query]
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const displayValue = open ? query : (selected?.name ?? "");

  const select = (row: SalesPersonPickRow) => {
    onChange(row.id);
    setQuery(row.name);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Input
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          if (value && v !== selected?.name) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selected?.name ?? query);
        }}
      />
      <TypeaheadDropdown
        open={open && (matches.length > 0 || query.length > 0)}
        className="left-0 right-0 z-20"
        emptyMessage={
          query.trim() ? "Brak handlowca — sprawdź pisownię" : "Wpisz fragment imienia"
        }
      >
        {query.trim() ? null : (
          <TypeaheadSectionLabel>Najczęściej wybierani — wpisz, aby zawęzić</TypeaheadSectionLabel>
        )}
        {matches.map((p) => (
          <TypeaheadOption
            key={p.id}
            title={p.name}
            subtitle={p.email ?? undefined}
            onSelect={() => select(p)}
          />
        ))}
        {value ? (
          <button
            type="button"
            className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50"
            onClick={clear}
          >
            Wyczyść wybór
          </button>
        ) : null}
      </TypeaheadDropdown>
    </div>
  );
}
