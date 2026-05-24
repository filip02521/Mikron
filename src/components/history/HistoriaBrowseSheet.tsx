"use client";

import { useMemo, useState } from "react";
import type { IndividualOrder } from "@/types/database";
import {
  matchesIndividualSearch,
  matchesNormalSearch,
} from "@/lib/orders/history-search";
import { HistoriaIndividualTable } from "@/components/history/HistoriaIndividualTable";
import {
  HistoriaNormalTable,
  type NormalHistoryRow,
} from "@/components/history/HistoriaNormalTable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";

export function HistoriaBrowseSheet({
  open,
  kind,
  individual,
  normal,
  canManageHistory,
  pending,
  onClose,
  onRemoveIndividual,
  onRemoveNormal,
}: {
  open: boolean;
  kind: "individual" | "normal";
  individual: IndividualOrder[];
  normal: NormalHistoryRow[];
  canManageHistory: boolean;
  pending: boolean;
  onClose: () => void;
  onRemoveIndividual: (id: string) => void;
  onRemoveNormal: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredIndividual = useMemo(
    () => individual.filter((o) => matchesIndividualSearch(o, query)),
    [individual, query]
  );
  const filteredNormal = useMemo(
    () => normal.filter((h) => matchesNormalSearch(h, query)),
    [normal, query]
  );

  if (!open) return null;

  const isIndividual = kind === "individual";
  const total = isIndividual ? individual.length : normal.length;
  const shown = isIndividual ? filteredIndividual.length : filteredNormal.length;
  const title = isIndividual ? "Historia indywidualna" : "Zamówienia standardowe";
  const searchPlaceholder = isIndividual
    ? "Nazwa produktu, symbol, dostawca, handlowiec…"
    : "Użytkownik, dostawca, akcja…";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-pointer bg-slate-900/30"
        aria-label="Zamknij historię"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-xl"
        aria-labelledby="historia-sheet-title"
      >
        <header className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="historia-sheet-title"
                className="text-base font-semibold text-slate-900"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {query.trim()
                  ? `${shown} z ${total} wpisów (ostatnie 6 miesięcy)`
                  : `${total} wpisów z ostatnich 6 miesięcy`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Zamknij
            </Button>
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Szukaj
            </span>
            <Input
              type="search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </label>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {isIndividual ? (
            !individual.length ? (
              <EmptyState title="Brak wpisów" />
            ) : !filteredIndividual.length ? (
              <EmptyState
                title="Brak wyników"
                description={`Nie znaleziono pasujących do „${query.trim()}”.`}
              />
            ) : (
              <HistoriaIndividualTable
                rows={filteredIndividual}
                canManageHistory={canManageHistory}
                pending={pending}
                onRemove={onRemoveIndividual}
              />
            )
          ) : !normal.length ? (
            <EmptyState title="Brak wpisów" />
          ) : !filteredNormal.length ? (
            <EmptyState
              title="Brak wyników"
              description={`Nie znaleziono pasujących do „${query.trim()}”.`}
            />
          ) : (
            <HistoriaNormalTable
              rows={filteredNormal}
              canManageHistory={canManageHistory}
              pending={pending}
              onRemove={onRemoveNormal}
            />
          )}
        </div>
      </aside>
    </>
  );
}
