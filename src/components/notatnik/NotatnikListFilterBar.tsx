"use client";

import { useEffect, useId } from "react";
import { Input } from "@/components/ui/Field";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

export function NotatnikListFilterBar({
  value,
  onChange,
  matchCount,
  totalCount,
  placeholder = "Szukaj po kliencie, numerze ZK lub produkcie…",
  idleHint = "Filtruj listę ZK po kliencie, numerze lub skrócie produktu.",
  activeHint = "Wyniki z aktywnej listy ZK.",
  emptyMatchHint = "Brak dopasowań — sprawdź numer ZK, nazwę klienta lub fragment produktu.",
  searchLabel = "Szukaj na liście ZK",
  visibleLabel,
  enableShortcut = true,
  embedded = false,
  bleed = false,
  showIdleHint = true,
  showActiveDetail = true,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  matchCount: number;
  totalCount: number;
  placeholder?: string;
  idleHint?: string;
  activeHint?: string;
  emptyMatchHint?: string;
  searchLabel?: string;
  /** Widoczny nagłówek nad polem (zamiast samego sr-only) — czytelniejsze dla użytkowników. */
  visibleLabel?: string;
  enableShortcut?: boolean;
  embedded?: boolean;
  /** Pełna szerokość w panelu z paddingiem rodzica — wymaga `px-3 sm:px-4` u nadkomponentu. */
  bleed?: boolean;
  /** Akapit pod polem gdy brak frazy — domyślnie włączony (ZK, plan). */
  showIdleHint?: boolean;
  /** Drugi wiersz pod licznikiem wyników. */
  showActiveDetail?: boolean;
  /** W pasku narzędzi listy — bez własnego tła i etykiety nad polem. */
  compact?: boolean;
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
    <div
      className={cn(
        compact
          ? "min-w-0"
          : cn(
              "border-b border-slate-100 bg-white",
              embedded
                ? cn(
                    "pb-2.5 pt-0",
                    bleed ? "-mx-3 px-3 sm:-mx-4 sm:px-4" : cn(salesChromeInsetClass, "pt-3")
                  )
                : cn(salesChromeInsetClass, "py-2.5")
            )
      )}
    >
      <div className={cn("flex flex-col gap-2", compact && "sm:flex-row sm:items-center")}>
        <div className="relative min-w-0 flex-1">
          {visibleLabel && !compact ? (
            <label
              htmlFor={inputId}
              className={cn(salesTypography.sectionLabel, "mb-1 block normal-case text-slate-700")}
            >
              {visibleLabel}
            </label>
          ) : (
            <label htmlFor={inputId} className="sr-only">
              {searchLabel}
            </label>
          )}
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
              placeholder={placeholder}
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
              "hover:bg-slate-100 min-h-11 sm:min-h-[2.5rem]",
              compact && "self-stretch sm:self-auto"
            )}
            onClick={() => onChange("")}
          >
            Wyczyść
          </button>
        ) : null}
      </div>
      {!compact && active ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600" aria-live="polite">
          Wyniki:{" "}
          <span className="font-semibold tabular-nums text-slate-900">{matchCount}</span>
          {" z "}
          <span className="font-semibold tabular-nums text-slate-900">{totalCount}</span>
          {activeListEmpty ? (
            <span className="mt-1 block text-slate-500">
              {emptyMatchHint}{" "}
              <button type="button" className={brandLinkSubtleClass} onClick={() => onChange("")}>
                Wyczyść wyszukiwanie
              </button>
            </span>
          ) : (
            showActiveDetail ? (
              <span className="mt-1 block text-slate-500">{activeHint}</span>
            ) : null
          )}
        </p>
      ) : !compact && showIdleHint ? (
        <p className="mt-2 text-xs text-slate-500">
          {idleHint}
          {enableShortcut ? (
            <span className="hidden sm:inline">
              {" "}
              Skrót:{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">
                /
              </kbd>
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
