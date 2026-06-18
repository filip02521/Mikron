"use client";

import { useId, type RefObject } from "react";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
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
  onCollapse,
  showCollapse = false,
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
  onCollapse?: () => void;
  showCollapse?: boolean;
}) {
  const inputId = useId();

  return (
    <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/45 p-3 sm:p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className={cn(salesTypography.sectionLabel, "normal-case text-indigo-900/90")}>
            Dodaj ZK z Subiekta
          </p>
          <p className={cn("mt-0.5", salesTypography.sectionHint, "text-indigo-900/75")}>
            Wpisz numer z systemu magazynowego — to nie filtruje listy poniżej.
          </p>
        </div>
        {showCollapse && onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 shrink-0 text-indigo-800 hover:bg-indigo-100/80"
            onClick={onCollapse}
          >
            Zwiń
          </Button>
        ) : null}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="min-w-0">
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
            value={query}
            disabled={loading || !canAdd}
            onChange={(e) => onQueryChange(e.target.value)}
            className={cn(
              fieldControlClass("default"),
              !canAdd && "cursor-not-allowed opacity-60"
            )}
            aria-disabled={!canAdd}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-indigo-900/70">
            Krótki numer (min. 2 znaki) — ostatnie 30 dni. Pełny format — tylko dany miesiąc.
          </p>
        </div>
        <Button
          type="submit"
          size="sm"
          className="min-h-11 w-full sm:min-h-[2.5rem] sm:w-auto sm:self-start"
          disabled={loading || !query.trim() || !canAdd}
          title={
            !canAdd
              ? "Brak połączenia z systemem magazynowym — dodawanie ZK jest niedostępne"
              : undefined
          }
        >
          <IconPlusCircle size={16} strokeWidth={2} className="mr-1.5 shrink-0" aria-hidden />
          {loading ? "Szukam w Subiekcie…" : "Dodaj do listy"}
        </Button>
      </form>

      {!canAdd ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
          {subiektBlockedHint ??
            "Dodawanie ZK wymaga połączenia z systemem magazynowym — poczekaj na przywrócenie połączenia."}
        </p>
      ) : null}

      {chooseHint && candidates.length > 0 ? (
        <div className="mt-3 rounded-md border border-indigo-200/90 bg-white/90 p-2.5">
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
