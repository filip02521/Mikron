"use client";

import { useEffect, useId } from "react";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";

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
    <div className="border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            Szukaj w moich zamówieniach
          </label>
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" strokeLinecap="round" />
            </svg>
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
            placeholder="Szukaj: produkt, dostawca, klient, symbol…"
            className="pl-10"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        {active ? (
          <button
            type="button"
            className={cn(
              "shrink-0 self-start rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700",
              "hover:bg-slate-100 sm:min-h-[2.5rem]"
            )}
            onClick={() => onChange("")}
          >
            Wyczyść
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
          Szukaj po produkcie, dostawcy, kliencie lub symbolu.
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
  onClearFilter,
  hasInboxFilter,
  archiveOnly = false,
}: {
  query: string;
  onClear: () => void;
  onClearFilter?: () => void;
  hasInboxFilter?: boolean;
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
      {hasInboxFilter && onClearFilter ? (
        <>
          {" "}
          lub{" "}
          <button type="button" className={brandLinkSubtleClass} onClick={onClearFilter}>
            usuń filtr kategorii
          </button>
        </>
      ) : null}
    </p>
  );
}
