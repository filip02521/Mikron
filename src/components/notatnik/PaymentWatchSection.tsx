"use client";

import { useRef, useState } from "react";
import { actionAddPaymentWatchByZkNumber } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { sortPaymentWatches } from "@/lib/sales/payment-watch-sort";
import type { SalesPaymentWatch } from "@/types/database";
import { PaymentWatchCard } from "./PaymentWatchCard";

export function PaymentWatchSection({
  watches,
  readOnly,
  onWatchAdded,
  onWatchSettled,
  onWatchRefreshed,
}: {
  watches: SalesPaymentWatch[];
  readOnly?: boolean;
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
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Czeka na zapłatę</h2>
        <p className="mt-1 text-sm text-slate-500">
          Wpisz numer ZK, np. 153157/M/04/2026 — klient i pełny numer wczytają się z Subiekta.
        </p>
      </div>

      {!readOnly ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
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
            placeholder="np. 153157/M/04/2026 lub 153157"
            value={query}
            disabled={loading}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm",
              controlFocusClass
            )}
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="min-h-11 shrink-0 sm:min-w-[7.5rem]"
          >
            {loading ? "Szukam…" : "Dodaj ZK"}
          </Button>
        </form>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {watches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
          Brak ZK oczekujących na zapłatę.
        </p>
      ) : (
        <ul className="space-y-3">
          {sortPaymentWatches(watches).map((watch) => (
            <li key={watch.id}>
              <PaymentWatchCard
                watch={watch}
                readOnly={readOnly}
                onSettled={() => onWatchSettled?.(watch.id)}
                onRefreshed={onWatchRefreshed}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
