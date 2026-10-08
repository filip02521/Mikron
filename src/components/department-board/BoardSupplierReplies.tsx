"use client";

import { parseFromHeader } from "@/lib/supplier-mail/match";
import { useCallback, useEffect, useState } from "react";
import {
  actionBoardInquiryReplies,
  actionSuggestBoardAnswerFromSupplier,
} from "@/app/actions/department-board-inquiry";
import type { BoardSupplierFileRef } from "@/app/actions/department-board";
import { IconPaperclip } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  BOARD_SUPPLIER_FILE_MAX_BYTES,
  BOARD_SUPPLIER_FILE_MAX_COUNT,
  boardSupplierFileType,
} from "@/lib/department-board/attachments";
import type { GmailReply } from "@/lib/google/gmail";
import type { BoardInquiryReplies } from "@/lib/google/gmail-connections";

const dateTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** „Anna Schmidt <a@renfert.de>” → „Anna Schmidt” (bez nazwy — sam adres). */
function senderName(from: string): string {
  const { email, name } = parseFromHeader(from);
  return name || email || "Dostawca";
}

/**
 * Wątek pytania (zakupy): odpowiedź dostawcy na „Zapytaj dostawcę” prosto z Gmaila
 * i propozycja odpowiedzi dla handlowca — wstawiana do pola odpowiedzi, wysyła człowiek.
 */
export function BoardSupplierReplies({
  threadId,
  onUseAnswer,
  refreshKey = "",
  attachedKeys = [],
  onToggleFile,
}: {
  threadId: string;
  /** Wstawia tekst do pola odpowiedzi w wątku. */
  onUseAnswer: (text: string) => void;
  /** Zmienia się, gdy synchronizacja poczty przyniesie nową odpowiedź — wtedy odczyt z Gmaila od nowa. */
  refreshKey?: string;
  /** Pliki już dołączone do odpowiedzi (klucz `inquiryId|replyId|nazwa`). */
  attachedKeys?: readonly string[];
  onToggleFile?: (file: BoardSupplierFileRef) => void;
}) {
  const [items, setItems] = useState<BoardInquiryReplies[] | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stan ustawiany dopiero w .then — efekt przy rozwinięciu wątku nie robi synchronicznego setState.
  const load = useCallback(
    () =>
      actionBoardInquiryReplies(threadId)
        .then((res) => {
          setError(res.ok ? null : res.message);
          if (res.ok) {
            setItems(res.items);
            setAiAvailable(res.aiAvailable);
          }
        })
        .catch(() => setError("Nie udało się odczytać odpowiedzi dostawcy z Gmaila.")),
    [threadId]
  );

  useEffect(() => {
    void load();
    // refreshKey — nowa odpowiedź dostawcy po odświeżeniu tablicy.
  }, [load, refreshKey]);

  if (error) return <p className="text-xs text-rose-800">{error}</p>;
  if (items == null) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500" role="status">
        <Spinner size="sm" />
        Sprawdzam odpowiedź dostawcy w Gmailu…
      </p>
    );
  }

  const supplierReply = (i: BoardInquiryReplies) =>
    i.status === "read" ? i.replies.filter((r) => r.kind === "supplier").at(-1) : undefined;
  // Zwrot / autoodpowiedź bez odpowiedzi dostawcy — informacja, bez propozycji dla handlowca.
  const otherNote = (i: BoardInquiryReplies) => {
    if (i.status !== "read" || supplierReply(i)) return null;
    const last = i.replies.filter((r) => r.kind === "bounce" || r.kind === "auto").at(-1);
    if (!last) return null;
    return last.kind === "bounce"
      ? {
          bounce: true,
          text: `Mail do ${i.supplierName} nie doszedł (zwrot z serwera poczty) - sprawdź adres i wyślij zapytanie ponownie.`,
        }
      : {
          bounce: false,
          text: `${i.supplierName}: autoodpowiedź${last.snippet ? ` - „${last.snippet}”` : ""}. Na prawdziwą odpowiedź trzeba poczekać.`,
        };
  };
  const withReplies = items.filter((i) => supplierReply(i));
  const notes = items.map((i) => ({ i, note: otherNote(i) })).filter((n) => n.note);
  const unavailable = items.filter((i) => i.status === "unavailable");
  if (!withReplies.length && !notes.length && !unavailable.length) return null;

  return (
    <div className="space-y-2">
      {withReplies.map((inquiry) =>
        inquiry.status === "read" ? (
          <SupplierReplyCard
            key={inquiry.inquiryId}
            threadId={threadId}
            inquiry={inquiry}
            reply={supplierReply(inquiry)!}
            olderCount={inquiry.replies.filter((r) => r.kind === "supplier").length - 1}
            aiAvailable={aiAvailable}
            onUseAnswer={onUseAnswer}
            attachedKeys={attachedKeys}
            onToggleFile={onToggleFile}
          />
        ) : null
      )}
      {notes.map(({ i, note }) => (
        <p
          key={`note-${i.inquiryId}`}
          className={cn(
            "rounded-md px-3 py-2 text-xs ring-1",
            note!.bounce ? "bg-red-50 text-red-800 ring-red-200" : "bg-slate-50 text-slate-700 ring-slate-200"
          )}
        >
          {note!.text}
        </p>
      ))}
      {unavailable.map((inquiry) =>
        inquiry.status === "unavailable" ? (
          <p key={inquiry.inquiryId} className="text-xs text-slate-500">
            Odpowiedź od {inquiry.supplierName}: {inquiry.reason}
          </p>
        ) : null
      )}
    </div>
  );
}

function SupplierReplyCard({
  threadId,
  inquiry,
  reply,
  olderCount,
  aiAvailable,
  onUseAnswer,
  attachedKeys,
  onToggleFile,
}: {
  threadId: string;
  inquiry: BoardInquiryReplies;
  reply: GmailReply;
  olderCount: number;
  aiAvailable: boolean;
  onUseAnswer: (text: string) => void;
  attachedKeys: readonly string[];
  onToggleFile?: (file: BoardSupplierFileRef) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const text = reply.text?.trim() || reply.snippet;
  const long = text.length > 420 || text.split("\n").length > 8;

  const suggest = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await actionSuggestBoardAnswerFromSupplier({ threadId, inquiryId: inquiry.inquiryId, replyId: reply.id });
      if (res.ok) {
        onUseAnswer(res.answer);
        const read = res.readPdfs.length ? ` AI przeczytało: ${res.readPdfs.join(", ")}.` : "";
        const skipped = res.skippedPdfs.length ? ` Pominięte (za duże lub nieczytelne): ${res.skippedPdfs.join(", ")}.` : "";
        setNote({
          tone: "ok",
          text: `Propozycja jest w polu odpowiedzi - sprawdź ją i dopisz cenę dla klienta, jeśli trzeba.${read}${skipped}`,
        });
      } else setNote({ tone: "error", text: res.message });
    } catch {
      setNote({ tone: "error", text: "Nie udało się przygotować propozycji. Spróbuj ponownie." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={`Odpowiedź dostawcy ${inquiry.supplierName}`}
      className="rounded-md border border-emerald-200/80 bg-emerald-50/40 px-3 py-2.5"
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="font-semibold text-emerald-900">Dostawca {inquiry.supplierName} odpisał</span>
        <span className="tabular-nums text-slate-500">
          {senderName(reply.from)} · {dateTime.format(new Date(reply.at))}
        </span>
      </p>
      <p
        className={cn(
          "mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-slate-800",
          long && !showAll && "line-clamp-6"
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className="mt-0.5 text-xs font-medium text-indigo-700 hover:underline"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Zwiń" : "Pokaż całość"}
        </button>
      ) : null}
      {reply.files?.length && onToggleFile ? (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-slate-600">Załączniki - dołącz do odpowiedzi dla handlowca:</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {reply.files.map((f, i) => {
              const ref = { inquiryId: inquiry.inquiryId, replyId: reply.id, filename: f.filename };
              const key = `${ref.inquiryId}|${ref.replyId}|${ref.filename}`;
              const attached = attachedKeys.includes(key);
              const supported = Boolean(boardSupplierFileType(f.filename));
              const tooBig = f.size > BOARD_SUPPLIER_FILE_MAX_BYTES;
              const disabled =
                !supported || tooBig || (!attached && attachedKeys.length >= BOARD_SUPPLIER_FILE_MAX_COUNT);
              return (
                <li key={`${f.filename}-${i}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={attached}
                    onClick={() => onToggleFile(ref)}
                    title={
                      !supported
                        ? "Tego typu pliku nie można dołączyć (PDF, zdjęcia, Excel, Word, CSV)"
                        : tooBig
                          ? "Plik jest za duży (max 15 MB) - prześlij go handlowcowi z Gmaila"
                          : attached
                            ? "Kliknij, żeby usunąć z odpowiedzi"
                            : "Dołącz do odpowiedzi"
                    }
                    className={cn(
                      "inline-flex max-w-72 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                      attached
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <IconPaperclip size={12} className="shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate">{f.filename}</span>
                    <span className="shrink-0 font-medium">{attached ? "Dołączony" : "Dołącz"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : reply.attachments.length ? (
        <p className="mt-1 break-all text-[11px] text-slate-500">Załączniki: {reply.attachments.join(", ")}</p>
      ) : null}
      {olderCount > 0 ? (
        <p className="mt-1 text-[11px] text-slate-500">Wcześniejsze odpowiedzi ({olderCount}) są w Gmailu.</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {aiAvailable ? (
          <Button type="button" size="sm" disabled={busy} aria-busy={busy} onClick={() => void suggest()}>
            {busy ? "Przygotowuję…" : "Zaproponuj odpowiedź dla handlowca"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant={aiAvailable ? "ghost" : "secondary"}
          disabled={busy}
          onClick={() => {
            onUseAnswer(`${inquiry.supplierName} odpisał:\n${text}`);
            setNote({ tone: "ok", text: "Treść maila jest w polu odpowiedzi - skróć ją przed wysłaniem." });
          }}
        >
          Wstaw treść maila
        </Button>
        {inquiry.gmailUrl ? (
          <a
            href={inquiry.gmailUrl}
            target="_blank"
            rel="noopener"
            className="text-xs font-medium text-indigo-700 hover:underline"
          >
            Otwórz w Gmailu
          </a>
        ) : null}
      </div>
      {note ? (
        <p className={cn("mt-1.5 text-xs", note.tone === "ok" ? "text-emerald-800" : "text-rose-800")} role="status">
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
