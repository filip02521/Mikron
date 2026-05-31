"use client";

import { useRef, useState } from "react";
import { actionAddZkWatchByNumber } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { sortZkWatches } from "@/lib/sales/zk-watch-sort";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchCard } from "./ZkWatchCard";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_INPUT_NARROW_CLASS,
  NOTATNIK_ZK_LIST_CLASS,
} from "./notatnik-layout";

export function ZkWatchSection({
  watches,
  readOnly,
  tourPreview = false,
  embedded,
  compact,
  subiektReachable = true,
  subiektBlockedHint,
  onWatchAdded,
  onWatchClosed,
  onWatchRefreshed,
}: {
  watches: SalesZkWatch[];
  readOnly?: boolean;
  tourPreview?: boolean;
  embedded?: boolean;
  compact?: boolean;
  /** false = brak połączenia z Subiektem — formularz dodawania ZK wyłączony. */
  subiektReachable?: boolean;
  subiektBlockedHint?: string;
  onWatchAdded?: (watch: SalesZkWatch) => void;
  onWatchClosed?: (watchId: string) => void;
  onWatchRefreshed?: (watch: SalesZkWatch) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAddZk = subiektReachable;

  async function submit(nextQuery?: string) {
    const value = (nextQuery ?? query).trim();
    if (!value || loading || readOnly || tourPreview || !canAddZk) return;
    setLoading(true);
    setError(null);
    try {
      const { watch } = await actionAddZkWatchByNumber(value);
      setQuery("");
      onWatchAdded?.(watch);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zamówienia.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? "space-y-3" : "space-y-4"}>
      {!embedded ? (
        <div>
          <h2 className="text-base font-semibold text-slate-900">Czeka na towar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Wpisz numer zamówienia klienta (ZK) — dane wczytają się automatycznie.
          </p>
        </div>
      ) : null}

      {!readOnly && !tourPreview ? (
        <div className="space-y-2">
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
              placeholder={
                canAddZk ? "np. 153157/M/04/2026" : "Dodawanie ZK wymaga połączenia z systemem"
              }
              value={query}
              disabled={loading || !canAddZk}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                NOTATNIK_INPUT_CLASS,
                NOTATNIK_INPUT_NARROW_CLASS,
                !canAddZk && "cursor-not-allowed opacity-60"
              )}
              aria-disabled={!canAddZk}
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !query.trim() || !canAddZk}
              title={
                !canAddZk
                  ? "Brak połączenia z systemem magazynowym — dodawanie ZK jest niedostępne"
                  : undefined
              }
            >
              {loading ? "Szukam…" : "Dodaj"}
            </Button>
          </form>
          {!canAddZk ? (
            <p className="text-xs leading-relaxed text-amber-900/90">
              {subiektBlockedHint ??
                "Dodawanie ZK wymaga połączenia z systemem magazynowym — poczekaj na przywrócenie połączenia."}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {watches.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
          Brak zamówień klienta czekających na towar.
        </p>
      ) : (
        <ul className={NOTATNIK_ZK_LIST_CLASS}>
          {sortZkWatches(watches).map((watch) => (
            <li key={watch.id} id={`watch-${watch.id}`}>
              <ZkWatchCard
                watch={watch}
                readOnly={readOnly}
                tourPreview={tourPreview}
                compact={compact}
                subiektReachable={subiektReachable}
                onClosed={() => onWatchClosed?.(watch.id)}
                onRefreshed={onWatchRefreshed}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
