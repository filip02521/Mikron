"use client";

import { useId, type RefObject } from "react";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

function formatIssuedAt(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return null;
  return `${d}.${m}.${y}`;
}

export function ZkWatchAddBar({
  inputRef,
  query,
  loading,
  canAdd,
  subiektBlockedHint,
  chooseHint,
  candidates,
  onQueryChange,
  onSubmit,
  onPickCandidate,
  onClearChoose,
}: {
  inputRef?: RefObject<HTMLInputElement | null>;
  query: string;
  loading: boolean;
  canAdd: boolean;
  subiektBlockedHint?: string;
  chooseHint: string | null;
  candidates: ZkSearchCandidate[];
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onPickCandidate: (candidate: ZkSearchCandidate) => void;
  onClearChoose: () => void;
}) {
  const inputId = useId();

  return (
    <div className="space-y-2">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className={cn(salesTypography.sectionLabel, "mb-1 block normal-case")}>
            Dodaj ZK z Subiekta
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <IconSearch size={18} strokeWidth={2} />
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={
                canAdd ? "np. 23 lub 234/M/03/2026" : "Dodawanie ZK wymaga połączenia z systemem"
              }
              value={query}
              disabled={loading || !canAdd}
              onChange={(e) => onQueryChange(e.target.value)}
              className={cn(fieldControlClass("default", "pl-10"), !canAdd && "cursor-not-allowed opacity-60")}
              aria-disabled={!canAdd}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            Krótki numer (min. 2 znaki) szuka w ostatnich 30 dniach. Pełny format np. 234/M/03/2026
            przeszukuje tylko dany miesiąc.
          </p>
        </div>
        <Button
          type="submit"
          size="sm"
          className="min-h-11 w-full shrink-0 sm:mt-[1.375rem] sm:min-h-[2.5rem] sm:w-auto"
          disabled={loading || !query.trim() || !canAdd}
          title={
            !canAdd
              ? "Brak połączenia z systemem magazynowym — dodawanie ZK jest niedostępne"
              : undefined
          }
        >
          {loading ? "Szukam…" : "Dodaj"}
        </Button>
      </form>

      {!canAdd ? (
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
                    onClick={() => onPickCandidate(candidate)}
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
            onClick={onClearChoose}
          >
            Anuluj wybór
          </button>
        </div>
      ) : null}
    </div>
  );
}
