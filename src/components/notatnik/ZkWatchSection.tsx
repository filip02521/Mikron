"use client";

import { useMemo, useRef, useState } from "react";
import {
  actionAddZkWatchByNumber,
  actionAddZkWatchBySubiektDokId,
} from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { validateZkQueryForSubmit } from "@/lib/subiekt/zk-search";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { sortZkWatches } from "@/lib/sales/zk-watch-sort";
import {
  filterZkWatchesByClientQuery,
  type ZkWatchOrderHints,
} from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchCard } from "./ZkWatchCard";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_INPUT_NARROW_CLASS,
  NOTATNIK_SEARCH_CLASS,
  NOTATNIK_ZK_LIST_CLASS,
} from "./notatnik-layout";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";

function formatIssuedAt(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return null;
  return `${d}.${m}.${y}`;
}

export function ZkWatchSection({
  watches,
  zkHintsByWatchId,
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
  zkHintsByWatchId?: Map<string, ZkWatchOrderHints>;
  readOnly?: boolean;
  tourPreview?: boolean;
  embedded?: boolean;
  compact?: boolean;
  subiektReachable?: boolean;
  subiektBlockedHint?: string;
  onWatchAdded?: (watch: SalesZkWatch) => void;
  onWatchClosed?: (watchId: string) => void;
  onWatchRefreshed?: (watch: SalesZkWatch) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chooseHint, setChooseHint] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ZkSearchCandidate[]>([]);
  const canAddZk = subiektReachable;

  const filteredWatches = useMemo(
    () => filterZkWatchesByClientQuery(watches, listFilter),
    [watches, listFilter]
  );
  const listFilterActive = listFilter.trim().length > 0;

  function clearChoose() {
    setCandidates([]);
    setChooseHint(null);
  }

  async function submit(nextQuery?: string) {
    const value = (nextQuery ?? query).trim();
    if (!value || loading || readOnly || tourPreview || !canAddZk) return;

    const validated = validateZkQueryForSubmit(value);
    if (!validated.ok) {
      setError(validated.message);
      clearChoose();
      return;
    }

    setLoading(true);
    setError(null);
    clearChoose();
    try {
      const result = await actionAddZkWatchByNumber(value);
      if (result.kind === "choose") {
        setCandidates(result.candidates);
        setChooseHint(result.hint);
        return;
      }
      setQuery("");
      onWatchAdded?.(result.watch);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać zamówienia.");
    } finally {
      setLoading(false);
    }
  }

  async function pickCandidate(candidate: ZkSearchCandidate) {
    if (loading || readOnly || tourPreview || !canAddZk) return;
    setLoading(true);
    setError(null);
    try {
      const { watch } = await actionAddZkWatchBySubiektDokId(candidate.subiektDokId);
      setQuery("");
      clearChoose();
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
          <h2 className={salesTypography.blockTitle}>Czeka na towar</h2>
          <p className={cn("mt-0.5", salesTypography.sectionHint)}>
            Krótki numer (min. 2 znaki) szuka w ostatnich 30 dniach. Pełny format np.{" "}
            234/M/03/2026 przeszukuje tylko marzec 2026.
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
                canAddZk ? "np. 23 lub 234/M/03/2026" : "Dodawanie ZK wymaga połączenia z systemem"
              }
              value={query}
              disabled={loading || !canAddZk}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
                if (candidates.length) clearChoose();
              }}
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
          {chooseHint && candidates.length > 0 ? (
            <div className="rounded-md border border-indigo-200 bg-indigo-50/60 p-2.5">
              <p className="text-xs font-medium text-indigo-950">{chooseHint}</p>
              <ul className="mt-2 space-y-1.5">
                {candidates.map((candidate) => {
                  const issued = formatIssuedAt(candidate.issuedAt);
                  return (
                    <li key={candidate.subiektDokId}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void pickCandidate(candidate)}
                        className="flex w-full flex-col rounded-md border border-white/80 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:opacity-60"
                      >
                        <span className="text-sm font-semibold text-slate-900">
                          {candidate.zkNumber.replace(/^ZK\s*/i, "")}
                        </span>
                        <span className="text-xs text-slate-600">{candidate.clientLabel}</span>
                        {candidate.lineSummary || issued ? (
                          <span className="mt-0.5 text-[11px] text-slate-500">
                            {[issued ? `Wystawiono ${issued}` : null, candidate.lineSummary]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs text-indigo-700 hover:text-indigo-900"
                onClick={clearChoose}
              >
                Anuluj wybór
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {watches.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            placeholder="Filtruj po kliencie lub numerze ZK…"
            className={NOTATNIK_SEARCH_CLASS}
            autoComplete="off"
            spellCheck={false}
          />
          {listFilterActive ? (
            <button
              type="button"
              className="text-xs text-indigo-700 hover:text-indigo-900"
              onClick={() => setListFilter("")}
            >
              Wyczyść filtr
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {watches.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-center text-xs text-slate-500">
          Brak zamówień klienta czekających na towar.
        </p>
      ) : filteredWatches.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-center text-xs text-slate-500">
          Brak ZK pasujących do filtra „{listFilter.trim()}”.
        </p>
      ) : (
        <div className={embedded ? undefined : mojeShipmentSectionShellClass}>
          <ul className={NOTATNIK_ZK_LIST_CLASS}>
            {sortZkWatches(filteredWatches).map((watch) => (
              <li key={watch.id} id={`watch-${watch.id}`}>
                <ZkWatchCard
                  watch={watch}
                  orderHints={zkHintsByWatchId?.get(watch.id)}
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
        </div>
      )}
    </div>
  );
}
