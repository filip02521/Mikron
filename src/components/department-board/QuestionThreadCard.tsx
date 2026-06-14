"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import {
  authorLabelFromProfile,
  boardReplyCountLabel,
  formatBoardDate,
  isOperationsAuthorRole,
  questionAuthorLabel,
} from "@/lib/department-board/format";
import {
  BOARD_PROCUREMENT_AUTHOR_LABEL,
  boardAwaitingReplyClass,
  boardQuestionRowClass,
  boardQuestionUnseenDotClass,
} from "@/lib/department-board/department-board-thread-styles";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import { NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { cn } from "@/lib/cn";
import { mojeShipmentExpandedPanelClass, mojeShipmentExpandedRowShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  actionArchiveQuestion,
  actionMarkQuestionThreadSeen,
  actionReplyToQuestion,
} from "@/app/actions/department-board";

function ThreadMessage({
  authorLabel,
  body,
  createdAt,
  tone = "default",
}: {
  authorLabel: string;
  body: string;
  createdAt: string;
  tone?: "default" | "procurement";
}) {
  return (
    <div className="space-y-1">
      <p className={salesTypography.rowMeta}>
        <span
          className={cn(
            "font-medium",
            tone === "procurement" ? "text-indigo-800" : "text-slate-700"
          )}
        >
          {authorLabel}
        </span>
        <span className="text-slate-400"> · </span>
        {formatBoardDate(createdAt)}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{body}</p>
    </div>
  );
}

export function QuestionThreadCard({
  question,
  canReply = false,
  canArchive = false,
  defaultExpanded = false,
  embedded = false,
  unseenReply = false,
  autoMarkSeen = false,
  onChanged,
}: {
  question: DepartmentBoardQuestion;
  canReply?: boolean;
  canArchive?: boolean;
  defaultExpanded?: boolean;
  embedded?: boolean;
  unseenReply?: boolean;
  autoMarkSeen?: boolean;
  onChanged?: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [locallySeen, setLocallySeen] = useState(!unseenReply);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionSyncKey = `${question.id}\0${unseenReply}\0${defaultExpanded}`;
  const [storedQuestionSyncKey, setStoredQuestionSyncKey] = useState(questionSyncKey);
  if (questionSyncKey !== storedQuestionSyncKey) {
    setStoredQuestionSyncKey(questionSyncKey);
    setLocallySeen(!unseenReply);
    setExpanded(defaultExpanded);
  }

  const author = questionAuthorLabel(question.sales_person, question.author);
  const isOpen = question.status === "open";
  const replyCount = question.posts.length;
  const showUnseen = unseenReply && !locallySeen;
  const previewLine = useMemo(() => {
    if (expanded) return null;
    const answer = question.posts.find((post) =>
      isOperationsAuthorRole(post.author?.role ?? null)
    );
    if (answer) return answer.body;
    if (question.posts[0]) return question.posts[0].body;
    return question.body;
  }, [expanded, question.body, question.posts]);

  useEffect(() => {
    if (!expanded || !autoMarkSeen || !showUnseen || question.posts.length === 0) return;
    void actionMarkQuestionThreadSeen(question.id)
      .then(() => {
        setLocallySeen(true);
        onChanged?.();
      })
      .catch(() => {
        /* badge zniknie po odświeżeniu */
      });
  }, [expanded, autoMarkSeen, showUnseen, question.id, question.posts.length, onChanged]);

  async function submitReply() {
    setBusy(true);
    setError(null);
    try {
      await actionReplyToQuestion(question.id, reply);
      setReply("");
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wysłać odpowiedzi.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      await actionArchiveQuestion(question.id);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zarchiwizować.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = isOpen
    ? "Bez odpowiedzi"
    : showUnseen
      ? "Nowa odpowiedź"
      : replyCount > 0
        ? boardReplyCountLabel(replyCount)
        : "Odpowiedziano";

  return (
    <article
      id={`question-${question.id}`}
      className={cn(
        embedded
          ? boardQuestionRowClass({ unseen: showUnseen, open: isOpen, expanded })
          : "rounded-md border border-slate-200/90 bg-white shadow-sm",
        embedded && expanded && mojeShipmentExpandedRowShellClass
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-3 text-left sm:gap-2.5 sm:px-4"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <IconChevronDown
          open={expanded}
          size={16}
          className="mt-0.5 shrink-0 text-slate-400"
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex min-w-0 items-center gap-2">
            {showUnseen ? (
              <span className={boardQuestionUnseenDotClass} aria-hidden />
            ) : null}
            <span className={cn(salesTypography.rowTitle, "min-w-0 truncate")}>
              {question.title}
            </span>
          </span>
          <span className={cn(salesTypography.rowMeta, "block")}>
            {author}
            <span className="text-slate-400"> · </span>
            {formatBoardDate(question.created_at)}
            <span className="text-slate-400"> · </span>
            <span
              className={cn(
                isOpen && "font-medium text-amber-800",
                showUnseen && !isOpen && "font-medium text-sky-700"
              )}
            >
              {statusLabel}
            </span>
          </span>
          {previewLine ? (
            <span className={cn(salesTypography.rowBody, "block truncate")}>{previewLine}</span>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <div className={cn(mojeShipmentExpandedPanelClass, "space-y-4")}>
          <ThreadMessage
            authorLabel={author}
            body={question.body}
            createdAt={question.created_at}
          />

          {question.posts.length === 0 ? (
            <p className={boardAwaitingReplyClass}>Zakupy jeszcze nie odpowiedziały.</p>
          ) : (
            <div className="space-y-4 border-t border-slate-100 pt-3">
              {question.posts.map((post) => {
                const fromOps = isOperationsAuthorRole(post.author?.role ?? null);
                return (
                  <ThreadMessage
                    key={post.id}
                    authorLabel={
                      fromOps
                        ? BOARD_PROCUREMENT_AUTHOR_LABEL
                        : authorLabelFromProfile(post.author)
                    }
                    body={post.body}
                    createdAt={post.created_at}
                    tone={fromOps ? "procurement" : "default"}
                  />
                );
              })}
            </div>
          )}

          {canReply ? (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label
                className={cn(salesTypography.rowMeta, "block font-medium text-slate-600")}
                htmlFor={`reply-${question.id}`}
              >
                {isOpen ? "Odpowiedź zakupów" : "Doprecyzowanie (widoczne dla wszystkich)"}
              </label>
              <textarea
                id={`reply-${question.id}`}
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Treść wiadomości…"
                className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-sm")}
              />
              <Button size="sm" disabled={busy || !reply.trim()} onClick={() => void submitReply()}>
                {busy ? "Wysyłanie…" : "Wyślij"}
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          {canArchive ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void archive()}>
              Archiwizuj pytanie
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
