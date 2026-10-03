"use client";

import { useId, useMemo, useRef, useState } from "react";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type { StockWatchSupplierSignal } from "@/lib/stock-watch/data";

type Option = { id: string; name: string; stockLabel: string };

function rank(s: StockWatchSupplierSignal | undefined): number {
  if (!s) return 0;
  if (s.criticalCount > 0) return 3;
  return s.lineCount > 0 ? 2 : 1;
}

function signalLabel(s: StockWatchSupplierSignal | undefined): { text: string; urgent: boolean } | null {
  if (!s) return null;
  if (s.lineCount === 0 && s.criticalCount === 0) return { text: "nic do zamówienia", urgent: false };
  const parts = [
    s.criticalCount > 0
      ? `${s.criticalCount} ${polishPluralWord(s.criticalCount, "brak", "braki", "braków")}`
      : null,
    s.lineCount > 0 ? `Do ZD ${s.lineCount} poz.` : null,
  ].filter(Boolean);
  return { text: parts.join(" · "), urgent: s.criticalCount > 0 };
}

const fold = (s: string) =>
  s
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Start od dostawcy (zamiast grupy / cechy): wybór uruchamia tę samą ścieżkę co
 * „Przygotuj ZD” w panelu — zakresy, dni zapasu i okno ustawiają się same,
 * a przy otwartej liście Kreator pyta przed jej zastąpieniem.
 * Bez wpisanej frazy: najpilniejsi wg nocnej analizy Braki.
 */
export function ZdEstimateSupplierPicker({
  suppliers,
  signals,
  disabled = false,
}: {
  /** Tylko dostawcy z przypisanym zakresem (bez niego nie ma czego liczyć). */
  suppliers: readonly Option[];
  signals: Record<string, StockWatchSupplierSignal>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const blurTimer = useRef<number | null>(null);

  const options = useMemo(() => {
    const q = fold(query.trim());
    const list = q ? suppliers.filter((s) => fold(s.name).includes(q)) : [...suppliers];
    list.sort(
      (a, b) =>
        rank(signals[b.id]) - rank(signals[a.id]) ||
        (signals[b.id]?.criticalCount ?? 0) - (signals[a.id]?.criticalCount ?? 0) ||
        (signals[b.id]?.lineCount ?? 0) - (signals[a.id]?.lineCount ?? 0) ||
        a.name.localeCompare(b.name, "pl")
    );
    return list.slice(0, 8);
  }, [query, suppliers, signals]);

  const choose = (o: Option | undefined) => {
    if (!o) return;
    setOpen(false);
    // Pełne przejście: Kreator startuje od nowa dla dostawcy (jak „Przygotuj ZD” z panelu).
    window.location.assign(buildZdEstimateLaunchHref(o.id));
  };

  return (
    <div className="relative min-w-0">
      <div className="relative">
        <IconSearch
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          aria-label="Dostawca — zacznij od dostawcy"
          placeholder="Wpisz dostawcę, np. Everall7…"
          disabled={disabled}
          value={query}
          className="h-10 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {!query.trim() && options.length > 0 ? (
            <li className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500" aria-hidden>
              Najpilniejsi wg nocnej analizy
            </li>
          ) : null}
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              Brak dostawcy z przypisanym zakresem o tej nazwie — przypisz w „Dostawcy → Zakresy”.
            </li>
          ) : (
            options.map((o, i) => {
              const sig = signalLabel(signals[o.id]);
              return (
                <li
                  key={o.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm",
                    i === active ? "bg-indigo-50" : "hover:bg-slate-50"
                  )}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{o.name}</span>
                    <span className="block text-xs text-slate-500">{o.stockLabel}</span>
                  </span>
                  {sig ? (
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        sig.urgent ? "font-semibold text-red-700" : "text-slate-600"
                      )}
                    >
                      {sig.text}
                    </span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
