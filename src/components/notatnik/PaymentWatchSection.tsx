"use client";

import { useRef, useState } from "react";
import { actionAddPaymentWatchByZkNumber } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { sortPaymentWatches } from "@/lib/sales/payment-watch-sort";
import type { SalesPaymentWatch } from "@/types/database";
import { PaymentWatchCard } from "./PaymentWatchCard";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_INPUT_NARROW_CLASS,
  NOTATNIK_ZK_LIST_CLASS,
} from "./notatnik-layout";

export function PaymentWatchSection({
  watches,
  readOnly,
  embedded,
  compact,
  onWatchAdded,
  onWatchSettled,
  onWatchRefreshed,
}: {
  watches: SalesPaymentWatch[];
  readOnly?: boolean;
  embedded?: boolean;
  compact?: boolean;
  onWatchAdded?: (watch: SalesPaymentWatch) => void;
  onWatchSettled?: (watchId: string) => void;
  onWatchRefreshed?: (watch: SalesPaymentWatch) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextQuery?: string) {
    const value = (nextQuery ?? query).trim();
    if (!value || loading || readOnly) return;
    setLoading(true);
    setError(null);
    try {
      const { watch } = await actionAddPaymentWatchByZkNumber(value);
      setQuery("");
      onWatchAdded?.(watch);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać ZK.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? "space-y-3" : "space-y-4"}>
      {!embedded ? (
        <div>
          <h2 className="text-base font-semibold text-slate-900">Czeka na zapłatę</h2>
          <p className="mt-1 text-sm text-slate-500">
            Wpisz numer ZK — klient i pełny numer wczytają się z Subiekta.
          </p>
        </div>
      ) : null}

      {!readOnly ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="np. 153157/M/04/2026"
            value={query}
            disabled={loading}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(NOTATNIK_INPUT_CLASS, NOTATNIK_INPUT_NARROW_CLASS)}
          />
          <Button type="submit" size="sm" disabled={loading || !query.trim()}>
            {loading ? "Szukam…" : "Dodaj ZK"}
          </Button>
        </form>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {watches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
          Brak ZK oczekujących na zapłatę.
        </p>
      ) : (
        <ul className={NOTATNIK_ZK_LIST_CLASS}>
          {sortPaymentWatches(watches).map((watch) => (
            <li key={watch.id} id={`watch-${watch.id}`}>
              <PaymentWatchCard
                watch={watch}
                readOnly={readOnly}
                compact={compact}
                onSettled={() => onWatchSettled?.(watch.id)}
                onRefreshed={onWatchRefreshed}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
