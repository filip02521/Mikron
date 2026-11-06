"use client";

import { useState } from "react";
import { actionServiceHelpdeskThread } from "@/app/actions/service-orders";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { HelpdeskMessage } from "@/lib/mikran-shop/helpdesk-parse";
import { formatHelpdeskWhen } from "@/lib/orders/service-related-cases";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { rubricBoxClass, rubricLabelClass } from "@/lib/ui/serwis-theme";

type ThreadState = { kind: "loading" } | { kind: "ok"; messages: HelpdeskMessage[] } | { kind: "error"; message: string };

/**
 * Rozmowa z klientem ze zgłoszenia helpdesku — serwisant czyta ją w karcie zlecenia zamiast przełączać się na panel sklepu.
 * Zwinięta na start; wątek pobiera się przy pierwszym rozwinięciu.
 */
export function ServiceOrderHelpdeskThread({ helpdeskId }: { helpdeskId: number }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ThreadState | null>(null);

  function load() {
    setState({ kind: "loading" });
    actionServiceHelpdeskThread(helpdeskId).then(
      (res) => setState(res.ok ? { kind: "ok", messages: res.messages } : { kind: "error", message: res.message }),
      () => setState({ kind: "error", message: "Nie udało się pobrać rozmowy ze zgłoszenia — brak połączenia z serwerem." })
    );
  }

  function toggle() {
    if (!open && !state) load();
    setOpen((v) => !v);
  }

  const bodyId = `helpdesk-thread-${helpdeskId}`;
  return (
    <section className={rubricBoxClass}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--sv-box)]",
          open && "rounded-b-none border-b border-[var(--sv-rule)]",
          controlFocusClass
        )}
      >
        <IconChevronRight size={16} className={cn("shrink-0 text-slate-500 transition-transform duration-150", open && "rotate-90")} aria-hidden />
        <h3 className={rubricLabelClass}>Rozmowa z klientem · zgłoszenie #{helpdeskId}</h3>
      </button>
      {open ? (
        <div id={bodyId} className="px-3 py-3">
          <ThreadBody state={state} onRetry={load} />
        </div>
      ) : null}
    </section>
  );
}

function ThreadBody({ state, onRetry }: { state: ThreadState | null; onRetry: () => void }) {
  if (!state || state.kind === "loading") {
    return (
      <div role="status" className="flex items-center gap-3 py-1">
        <BrandLoader size="sm" tile={false} />
        <span className="text-[0.8125rem] text-slate-600">Pobieram rozmowę z helpdesku mikran.pl…</span>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[0.8125rem] text-amber-900">{state.message}</p>
        <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onRetry}>
          Spróbuj ponownie
        </Button>
      </div>
    );
  }
  if (!state.messages.length) return <p className="text-[0.8125rem] text-slate-600">W zgłoszeniu nie ma jeszcze wiadomości.</p>;
  // Najnowsza na górze: serwisant otwiera rozmowę, żeby zobaczyć, co klient napisał ostatnio; początek sprawy jest w usterce zlecenia.
  const newestFirst = [...state.messages].reverse();
  return (
    <ol className="-my-2 divide-y divide-[var(--sv-rule)]">
      {newestFirst.map((m, i) => (
        <li key={m.id ?? `${m.at}-${i}`} className="py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[0.8125rem] font-semibold", m.staff ? "text-slate-600" : "text-slate-900")}>
              {m.staff ? "Serwis" : "Klient"}
              {m.author ? <span className="font-normal text-slate-600"> · {m.author}</span> : null}
            </span>
            {m.at ? <span className="text-xs tabular-nums text-slate-600">{formatHelpdeskWhen(m.at)}</span> : null}
            {m.hidden ? <Badge variant="warning">ukryty</Badge> : null}
            {m.status ? <Badge>{m.status}</Badge> : null}
          </div>
          <p className="mt-1 whitespace-pre-line break-words text-[0.8125rem] text-slate-800">{m.text}</p>
        </li>
      ))}
    </ol>
  );
}
