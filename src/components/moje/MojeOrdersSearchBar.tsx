"use client";

import { useEffect, useId } from "react";
import { Input } from "@/components/ui/Field";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

export function MojeOrdersSearchBar({
  value,
  onChange,
  matchCount,
  totalCount,
  archiveMatchCount = 0,
  enableShortcut = true,
}: {
  value: string;
  onChange: (next: string) => void;
  matchCount: number;
  totalCount: number;
  archiveMatchCount?: number;
  enableShortcut?: boolean;
}) {
  const inputId = useId();
  const trimmed = value.trim();
  const active = trimmed.length > 0;
  const activeListEmpty = active && matchCount === 0;

  useEffect(() => {
    if (!enableShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      document.getElementById(inputId)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut, inputId]);

  return (
    <div className={cn("border-b border-slate-100 bg-white py-2.5", salesChromeInsetClass)}>
      <div className="flex flex-col gap-2">
        <div className="relative min-w-0 flex-1">
          <label
            htmlFor={inputId}
            className={cn(salesTypography.sectionLabel, "mb-1 block normal-case text-slate-700")}
          >
            Szukaj w prośbach
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <IconSearch size={18} strokeWidth={2} />
            </span>
            <Input
              id={inputId}
              type="search"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && value) {
                  e.preventDefault();
                  onChange("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Produkt, dostawca, klient, symbol, PLU…"
              className="pl-10"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
          </div>
        </div>
        {active ? (
          <button
            type="button"
            className={cn(
              "shrink-0 self-start rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700",
              "hover:bg-slate-100 min-h-11 sm:min-h-[2.5rem]"
            )}
            onClick={() => onChange("")}
          >
            Wyczyść filtr
          </button>
        ) : null}
      </div>
      {active ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600" aria-live="polite">
          Aktywne:{" "}
          <span className="font-semibold tabular-nums text-slate-900">{matchCount}</span>
          {" z "}
          <span className="font-semibold tabular-nums text-slate-900">{totalCount}</span>
          {archiveMatchCount > 0 ? (
            <>
              {" · archiwum: "}
              <span className="font-semibold tabular-nums text-slate-900">
                {archiveMatchCount}
              </span>
            </>
          ) : null}
          {activeListEmpty && archiveMatchCount > 0 ? (
            <span className="mt-1 block text-slate-500">
              W aktywnych prośbach brak wyników — sprawdź sekcję „Ostatnio zakończone” poniżej.
            </span>
          ) : (
            <span className="mt-1 block text-slate-500">
              Szukamy w produktach z rozwiniętej listy i w archiwum.
            </span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Szukaj po produkcie, dostawcy, kliencie, symbolu lub kodzie PLU.
          <span className="hidden sm:inline">
            {" "}
            Skrót:{" "}
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">
              /
            </kbd>
          </span>
        </p>
      )}
    </div>
  );
}

export function MojeOrdersSearchEmptyHint({
  query,
  onClear,
  archiveOnly = false,
}: {
  query: string;
  onClear: () => void;
  archiveOnly?: boolean;
}) {
  return (
    <p className="border-b border-slate-100 px-3 py-4 text-sm text-slate-600 sm:px-4">
      {archiveOnly ? (
        <>
          W aktywnych prośbach brak wyników dla „
          <span className="font-medium text-slate-900">{query}</span>”.
        </>
      ) : (
        <>
          Brak wyników dla „<span className="font-medium text-slate-900">{query}</span>”.
        </>
      )}{" "}
      <button type="button" className={brandLinkSubtleClass} onClick={onClear}>
        Wyczyść wyszukiwanie
      </button>
    </p>
  );
}
