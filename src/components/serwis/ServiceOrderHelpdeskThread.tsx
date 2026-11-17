"use client";

import { useEffect, useRef, useState } from "react";
import { actionServiceHelpdeskThread } from "@/app/actions/service-orders";
import { IconMessageSquare } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { HelpdeskMessage } from "@/lib/mikran-shop/helpdesk-parse";
import { formatHelpdeskWhen } from "@/lib/orders/service-related-cases";

type ThreadState = { kind: "loading" } | { kind: "ok"; messages: HelpdeskMessage[] } | { kind: "error"; message: string };

/**
 * Cała rozmowa ze zgłoszenia helpdesku pod jednym przyciskiem — serwisant czyta ją w OnTime zamiast w panelu sklepu.
 * Wątek pobiera się przy otwarciu okna (za każdym razem świeży: klient mógł właśnie odpisać).
 */
export function ServiceOrderHelpdeskThread({
  helpdeskId,
  className,
  compact = false,
}: {
  helpdeskId: number;
  className?: string;
  /** Krótki przycisk w rzędzie innych (okno przyjęcia); w karcie zlecenia — pełna szerokość z numerem. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={compact ? "sm" : "md"}
        className={cn("gap-2", !compact && "min-h-11 w-full justify-start", className)}
        onClick={() => setOpen(true)}
      >
        <IconMessageSquare size={16} aria-hidden className="shrink-0" />
        {compact ? "Cała rozmowa" : `Rozmowa z klientem — zgłoszenie #${helpdeskId}`}
      </Button>
      {open ? <HelpdeskThreadDialog helpdeskId={helpdeskId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function HelpdeskThreadDialog({ helpdeskId, onClose }: { helpdeskId: number; onClose: () => void }) {
  const [state, setState] = useState<ThreadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    actionServiceHelpdeskThread(helpdeskId).then(
      (res) => alive && setState(res.ok ? { kind: "ok", messages: res.messages } : { kind: "error", message: res.message }),
      () => alive && setState({ kind: "error", message: "Nie udało się pobrać rozmowy ze zgłoszenia — brak połączenia z serwerem." })
    );
    return () => {
      alive = false;
    };
  }, [helpdeskId, attempt]);

  // Jak w czacie: otwiera się na najnowszej wiadomości, starsze wyżej.
  useEffect(() => {
    if (state.kind === "ok") endRef.current?.scrollIntoView({ block: "end" });
  }, [state]);

  const count = state.kind === "ok" ? state.messages.length : null;
  return (
    <ModalShell
      open
      tier="top"
      size="lg"
      className="touch-ui"
      onClose={onClose}
      title={`Rozmowa z klientem — zgłoszenie #${helpdeskId}`}
      // Własne id: okno otwiera się nad oknem przyjęcia, a wspólne „modal-title” dałoby obu ten sam tytuł.
      titleId={`helpdesk-thread-title-${helpdeskId}`}
      description={count ? `${count} ${polishPluralWord(count, "wiadomość", "wiadomości", "wiadomości")} z helpdesku mikran.pl, najnowsza na dole.` : undefined}
      bodyClassName="px-4 py-4 sm:px-6"
      footer={
        <div className="flex w-full justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Zamknij
          </Button>
        </div>
      }
    >
      {state.kind === "loading" ? (
        <div role="status" className="flex items-center gap-3 py-6">
          <BrandLoader size="sm" tile={false} />
          <span className="text-[0.8125rem] text-slate-600">Pobieram rozmowę z helpdesku mikran.pl…</span>
        </div>
      ) : state.kind === "error" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
          <p className="text-[0.8125rem] text-amber-900">{state.message}</p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            Spróbuj ponownie
          </Button>
        </div>
      ) : !state.messages.length ? (
        <p className="py-2 text-[0.8125rem] text-slate-600">W zgłoszeniu nie ma jeszcze wiadomości.</p>
      ) : (
        <ol className="space-y-3">
          {state.messages.map((m, i) => (
            <MessageBubble key={m.id ?? `${m.at}-${i}`} m={m} />
          ))}
        </ol>
      )}
      <div ref={endRef} />
    </ModalShell>
  );
}

/** Klient po lewej, serwis po prawej; autoodpowiedź sklepu przygaszona, bo nikt jej nie pisał. */
function MessageBubble({ m }: { m: HelpdeskMessage }) {
  const who = m.auto ? "Autoodpowiedź" : m.staff ? "Serwis" : "Klient";
  return (
    <li className={cn("flex flex-col", m.staff ? "items-end" : "items-start")}>
      <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 px-1", m.staff && "justify-end")}>
        <span className="text-xs font-semibold text-slate-700">
          {who}
          {m.author && !m.auto ? <span className="font-normal text-slate-500"> · {m.author}</span> : null}
        </span>
        {m.at ? <span className="text-xs tabular-nums text-slate-500">{formatHelpdeskWhen(m.at)}</span> : null}
        {m.hidden ? <Badge variant="warning">ukryty</Badge> : null}
        {m.status ? <Badge>{m.status}</Badge> : null}
      </div>
      <p
        className={cn(
          "mt-1 max-w-[88%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-relaxed",
          m.auto
            ? "border border-dashed border-slate-300 bg-transparent text-slate-500"
            : m.staff
              ? "rounded-tr-md bg-indigo-50 text-slate-900"
              : "rounded-tl-md border border-slate-200 bg-card text-slate-900"
        )}
      >
        {m.text}
      </p>
    </li>
  );
}
