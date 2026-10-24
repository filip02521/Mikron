"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { actionGetZdProductNote, actionSaveZdProductNote } from "@/app/actions/zd-estimate";
import { IconPencil } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";

const MAX_LEN = 1000;

type LoadState = { key: number; status: "ok"; note: string } | { key: number; status: "error"; message: string };

/**
 * Notatka zakupów przy towarze (np. „taniej od 10 opak.”, „od 20 opak. rabat 5%”) — pod decyzją o ilości,
 * bo dotyczy tego, ile zamówić. Ta sama notatka jest w katalogu produktów admina.
 */
export function ZdProductNote({
  twId,
  symbol,
  name,
  canEdit,
  titleId,
}: {
  twId: number;
  symbol: string | null;
  name: string | null;
  canEdit: boolean;
  titleId: string;
}) {
  const [loaded, setLoaded] = useState<LoadState | null>(null);
  const [editing, setEditing] = useState<{ key: number; draft: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaId = useId();
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void actionGetZdProductNote({ twId }).then(
      (r) => {
        if (cancelled) return;
        setLoaded(r.ok ? { key: twId, status: "ok", note: r.note } : { key: twId, status: "error", message: r.message });
      },
      () => !cancelled && setLoaded({ key: twId, status: "error", message: "Nie udało się wczytać notatki." })
    );
    return () => {
      cancelled = true;
    };
  }, [twId]);

  // Po ←/→ do następnego towaru: stan poprzedniego nie przecieka (ani tekst, ani tryb edycji).
  const state = loaded?.key === twId ? loaded : null;
  const draft = editing?.key === twId ? editing.draft : null;
  const note = state?.status === "ok" ? state.note : "";

  useEffect(() => {
    if (draft != null) areaRef.current?.focus();
  }, [draft != null]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (draft == null) return;
    setError(null);
    startTransition(async () => {
      const r = await actionSaveZdProductNote({ twId, note: draft, symbol, name });
      if (!r.ok) return setError(r.message);
      setLoaded({ key: twId, status: "ok", note: r.note });
      setEditing(null);
    });
  };

  return (
    <section aria-labelledby={`${titleId}-note`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${titleId}-note`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Notatka
        </h3>
        {canEdit && draft == null && state?.status === "ok" && note ? (
          <button
            type="button"
            onClick={() => setEditing({ key: twId, draft: note })}
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <IconPencil size={13} aria-hidden /> Edytuj
          </button>
        ) : null}
      </div>

      {state == null ? (
        <p className="mt-1.5 text-xs text-slate-500" role="status">
          Wczytuję notatkę…
        </p>
      ) : state.status === "error" ? (
        <p className="mt-1.5 text-xs text-amber-800">{state.message}</p>
      ) : draft != null ? (
        <div className="mt-1.5 space-y-2">
          <label htmlFor={textareaId} className="sr-only">
            Notatka do towaru
          </label>
          <textarea
            id={textareaId}
            ref={areaRef}
            value={draft}
            maxLength={MAX_LEN}
            rows={3}
            placeholder="np. taniej od 10 opak. (52 zł zamiast 58 zł), od 20 opak. rabat 5%"
            onChange={(e) => setEditing({ key: twId, draft: e.target.value })}
            onKeyDown={(e) => {
              // Ctrl/⌘+Enter zapisuje; Esc kończy edycję bez zamykania karty.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setEditing(null);
                setError(null);
              }
            }}
            className={fieldControlClass("default", "resize-y text-sm")}
            disabled={pending}
          />
          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={save} disabled={pending} className="max-sm:min-h-10">
              {pending ? <Spinner size="sm" /> : null}
              Zapisz notatkę
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setError(null);
              }}
              disabled={pending}
              className="max-sm:min-h-10"
            >
              Anuluj
            </Button>
            <span className="ml-auto text-xs tabular-nums text-slate-500">
              {draft.length}/{MAX_LEN}
            </span>
          </div>
        </div>
      ) : note ? (
        <p className="mt-1.5 whitespace-pre-line rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800">
          {note}
        </p>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => setEditing({ key: twId, draft: "" })}
          className="mt-1.5 w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          + Dodaj notatkę, np. „taniej od 10 opak.”
        </button>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">Brak notatki.</p>
      )}
    </section>
  );
}
