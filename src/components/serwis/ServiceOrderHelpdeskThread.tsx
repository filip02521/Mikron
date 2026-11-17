"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { actionServiceHelpdeskReply, actionServiceHelpdeskThread } from "@/app/actions/service-orders";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { IconCircleCheck, IconMessageSquare } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { HelpdeskMessage } from "@/lib/mikran-shop/helpdesk-parse";
import { formatHelpdeskWhen } from "@/lib/orders/service-related-cases";
import { fieldLabelClass } from "@/lib/ui/serwis-theme";

type ThreadState =
  | { kind: "loading" }
  | { kind: "ok"; messages: HelpdeskMessage[]; canReply: boolean }
  | { kind: "error"; message: string };

/** Najdłuższa odpowiedź z OnTime (jak HELPDESK_REPLY_MAX po stronie serwera). */
const REPLY_MAX = 4000;

/**
 * Cała rozmowa ze zgłoszenia helpdesku pod jednym przyciskiem — serwisant czyta ją i odpowiada klientowi w OnTime
 * zamiast w panelu sklepu. Wątek pobiera się przy otwarciu okna (za każdym razem świeży: klient mógł właśnie odpisać).
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
  // Niewysłana odpowiedź przeżywa zamknięcie okna — przypadkowe „Zamknij” nie kasuje pisanego tekstu.
  const [draft, setDraft] = useState("");
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
        {draft.trim() ? <span className="text-xs font-normal text-slate-500">· szkic odpowiedzi</span> : null}
      </Button>
      {open ? <HelpdeskThreadDialog helpdeskId={helpdeskId} draft={draft} setDraft={setDraft} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function HelpdeskThreadDialog({
  helpdeskId,
  draft,
  setDraft,
  onClose,
}: {
  helpdeskId: number;
  draft: string;
  setDraft: (v: string) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<ThreadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    actionServiceHelpdeskThread(helpdeskId).then(
      (res) =>
        alive &&
        setState(res.ok ? { kind: "ok", messages: res.messages, canReply: res.canReply } : { kind: "error", message: res.message }),
      () => alive && setState({ kind: "error", message: "Nie udało się pobrać rozmowy ze zgłoszenia — brak połączenia z serwerem." })
    );
    return () => {
      alive = false;
    };
  }, [helpdeskId, attempt]);

  // Jak w czacie: otwiera się na najnowszej wiadomości, starsze wyżej.
  const messageCount = state.kind === "ok" ? state.messages.length : 0;
  useEffect(() => {
    if (messageCount) endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

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
      description={
        messageCount
          ? `${messageCount} ${polishPluralWord(messageCount, "wiadomość", "wiadomości", "wiadomości")} z helpdesku mikran.pl, najnowsza na dole.`
          : undefined
      }
      bodyClassName="px-4 py-4 sm:px-6"
      footer={
        state.kind === "ok" ? (
          <ReplyBox
            helpdeskId={helpdeskId}
            canReply={state.canReply}
            draft={draft}
            setDraft={setDraft}
            onClose={onClose}
            onSent={(messages) => messages && setState({ kind: "ok", messages, canReply: true })}
          />
        ) : (
          <div className="flex w-full justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Zamknij
            </Button>
          </div>
        )
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

/**
 * Odpowiedź do klienta. Każdy element mówi, co się stanie: wybór maila zmienia opis pod nim i napis na przycisku
 * („Wyślij i powiadom mailem” / „Zapisz w zgłoszeniu bez maila”).
 */
function ReplyBox({
  helpdeskId,
  canReply,
  draft,
  setDraft,
  onClose,
  onSent,
}: {
  helpdeskId: number;
  canReply: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onClose: () => void;
  onSent: (messages: HelpdeskMessage[] | null) => void;
}) {
  const { readOnly } = useAdminPanelPreview();
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  const close = (
    <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
      Zamknij
    </Button>
  );
  if (readOnly || !canReply) {
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p className="mr-auto min-w-0 flex-1 text-[0.8125rem] text-slate-600">
          {readOnly
            ? "Podgląd administratora — odpowiada serwisant."
            : "Odpowiadanie z OnTime jest wyłączone na tym serwerze — odpowiedz w panelu sklepu mikran.pl."}
        </p>
        {close}
      </div>
    );
  }

  const send = () => {
    setError(null);
    setSent(null);
    if (!draft.trim()) {
      setError("Wpisz treść odpowiedzi.");
      return;
    }
    const withMail = notify;
    start(async () => {
      const res = await actionServiceHelpdeskReply(helpdeskId, draft, withMail).catch(() => ({
        ok: false as const,
        message: "Brak połączenia z serwerem — nie wiadomo, czy odpowiedź poszła. Otwórz rozmowę ponownie i sprawdź, zanim wyślesz drugi raz.",
      }));
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDraft("");
      onSent(res.messages);
      setSent(
        (withMail ? "Wysłano — klient dostał maila i widzi odpowiedź w zgłoszeniu." : "Zapisano w zgłoszeniu bez maila.") +
          (res.messages ? "" : " Rozmowy nie udało się odświeżyć — zamknij i otwórz ją ponownie, nie wysyłaj drugi raz.")
      );
    });
  };

  return (
    <div className="w-full space-y-2">
      <label htmlFor={`${id}-reply`} className={fieldLabelClass}>
        Odpowiedź do klienta
      </label>
      <textarea
        id={`${id}-reply`}
        value={draft}
        maxLength={REPLY_MAX}
        rows={3}
        disabled={pending}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
          setSent(null);
        }}
        placeholder="Np. Część już dotarła, naprawa skończy się w piątek."
        className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 sm:text-[0.9375rem]"
      />
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5">
        <input
          type="checkbox"
          checked={notify}
          disabled={pending}
          onChange={(e) => setNotify(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600"
        />
        <span className="min-w-0 text-[0.8125rem]">
          <span className="font-medium text-slate-900">Wyślij klientowi maila z tą odpowiedzią</span>
          <span className="block text-slate-600">
            {notify
              ? "Klient dostanie maila i zobaczy odpowiedź w zgłoszeniu na mikran.pl."
              : "Bez maila — klient zobaczy odpowiedź tylko, gdy sam wejdzie w zgłoszenie na mikran.pl."}{" "}
            Status zgłoszenia się nie zmienia.
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[0.8125rem] text-red-700">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[0.8125rem] text-emerald-900">
          <IconCircleCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-700" />
          <span>{sent}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {close}
        <Button type="button" onClick={send} disabled={pending} className="gap-2">
          {pending ? <Spinner size="sm" /> : null}
          {pending ? "Wysyłam…" : notify ? "Wyślij i powiadom mailem" : "Zapisz w zgłoszeniu bez maila"}
        </Button>
      </div>
    </div>
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
