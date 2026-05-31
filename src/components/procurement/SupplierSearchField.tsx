"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { locationLabel } from "@/lib/display-labels";
import { panelToolbarSearchInputClass } from "@/lib/ui/ontime-theme";
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
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 12);
    return suppliers
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, suppliers]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const isToolbar = appearance === "toolbar";

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
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && filtered.length > 0 ? (
          <ul className="absolute inset-x-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    onSelect(s.id);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="text-xs text-slate-500">
                    {locationLabel(s.location)}
                    {s.vacationNote ? " · urlop" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
