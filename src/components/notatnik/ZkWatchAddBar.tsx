"use client";

import { useId, type RefObject } from "react";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

function formatIssuedAt(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return null;
  return `${d}.${m}.${y}`;
}

/** Formularz dodawania ZK — treść zwijanej sekcji (bez własnego nagłówka). */
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
  layout = "stack",
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
  /** inline — pole i przycisk w jednym rzędzie (pasek narzędzi listy). */
  layout?: "stack" | "inline";
}) {
  const inputId = useId();
  const inline = layout === "inline";

  return (
    <div className="space-y-2">
      <form
        className={cn(
          "flex gap-2",
          inline ? "flex-col sm:flex-row sm:items-center" : "flex-col"
        )}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className={cn("min-w-0", inline && "flex-1")}>
          <label htmlFor={inputId} className="sr-only">
            Numer ZK z Subiekta
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              canAdd ? "np. 234 lub 234/M/03/2026" : "Dodawanie wymaga połączenia z Subiektem"
            }
            title={
              canAdd
                ? "Krótki numer (min. 2 znaki) — ostatnie 30 dni. Pełny format — tylko dany miesiąc."
                : undefined
            }
            value={query}
            disabled={loading || !canAdd}
            onChange={(e) => onQueryChange(e.target.value)}
            className={cn(
              fieldControlClass("default"),
              inline && "w-full",
              !canAdd && "cursor-not-allowed opacity-60"
            )}
            aria-disabled={!canAdd}
          />
          {!inline ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Krótki numer (min. 2 znaki) — ostatnie 30 dni. Pełny format — tylko dany miesiąc.
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          size="sm"
          className={cn(
            "min-h-11 shrink-0 sm:min-h-[2.5rem]",
            inline ? "w-full sm:w-auto" : "w-full sm:w-auto sm:self-start"
          )}
          disabled={loading || !query.trim() || !canAdd}
          title={
            !canAdd
              ? "Brak połączenia z systemem magazynowym — dodawanie ZK jest niedostępne"
              : undefined
          }
        >
          <IconPlusCircle size={16} strokeWidth={2} className="mr-1.5 shrink-0" aria-hidden />
          {loading ? "Szukam…" : inline ? "Dodaj" : "Dodaj do listy"}
        </Button>
      </form>

      {!canAdd ? (
        <p className="text-xs leading-relaxed text-amber-900/90">
          {subiektBlockedHint ??
            "Dodawanie ZK wymaga połączenia z systemem magazynowym — poczekaj na przywrócenie połączenia."}
        </p>
      ) : null}

      {chooseHint && candidates.length > 0 ? (
        <div className="rounded-md border border-slate-200/90 bg-slate-50/80 p-2.5">
          <p className="text-xs font-medium text-slate-800">{chooseHint}</p>
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
            className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
            onClick={onClearChoose}
          >
            Anuluj wybór
          </button>
        </div>
      ) : null}
    </div>
  );
}
