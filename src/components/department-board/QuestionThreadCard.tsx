"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  boardQuestionPreviewClass,
  boardQuestionAuthorNameClass,
  boardQuestionCollapsedMetaClass,
  boardQuestionRowClass,
  boardQuestionRowHeaderExpandedClass,
  boardQuestionStatusBadgeClass,
  boardQuestionUnseenDotClass,
  boardReplyFormShellClass,
} from "@/lib/department-board/department-board-thread-styles";
import {
  boardQuestionExpandedShellClass,
  boardQuestionInlineReplyShellClass,
  boardQuestionRowHeaderClass,
} from "@/lib/department-board/department-board-questions-ui";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import { NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { BoardQuestionProductChip } from "@/components/department-board/BoardQuestionProductChip";
import { BoardQuestionProductContext } from "@/components/department-board/BoardQuestionProductContext";
import { BoardThreadMessage } from "@/components/department-board/BoardThreadMessage";
import { boardQuestionHasProduct } from "@/lib/department-board/question-product";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  actionArchiveQuestion,
  actionMarkQuestionThreadSeen,
  actionReplyToQuestion,
} from "@/app/actions/department-board";
import { isStaleAnsweredQuestion } from "@/lib/department-board/attention";

function procurementReplyLabel(indexAmongProcurement: number): string {
  return indexAmongProcurement === 0 ? "Odpowiedź" : "Doprecyzowanie";
}

export function QuestionThreadCard({
  question,
  canReply = false,
  canArchive = false,
  defaultExpanded = false,
  embedded = false,
  unseenReply = false,
  autoMarkSeen = false,
  rowAlternate = false,
  onChanged,
}: {
  question: DepartmentBoardQuestion;
  canReply?: boolean;
  canArchive?: boolean;
  defaultExpanded?: boolean;
  embedded?: boolean;
  unseenReply?: boolean;
  autoMarkSeen?: boolean;
  /** Co drugi wiersz na liście (zebra). */
  rowAlternate?: boolean;
  onChanged?: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [inlineReply, setInlineReply] = useState(false);
  const [locallySeen, setLocallySeen] = useState(!unseenReply);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expandedByUserRef = useRef(false);
  const markSeenRequestedRef = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const author = questionAuthorLabel(question.sales_person, question.author);
  const isOpen = question.status === "open";
  const replyCount = question.posts.length;
  const showUnseen = unseenReply && !locallySeen;
  const hasProduct = boardQuestionHasProduct(question);
  const stale = isStaleAnsweredQuestion(question);

  const latestActivityPost = useMemo(() => {
    if (question.posts.length === 0) return null;
    return question.posts.reduce((latest, post) =>
      post.created_at > latest.created_at ? post : latest
    );
  }, [question.posts]);

  const previewLine = useMemo(() => {
    if (expanded) return null;
    if (latestActivityPost) {
      const fromOps = isOperationsAuthorRole(latestActivityPost.author?.role ?? null);
      const prefix = fromOps ? "Ostatnia odpowiedź:" : "Ostatnia wiadomość:";
      return `${prefix} ${latestActivityPost.body}`;
    }
    return `Pytanie: ${question.body}`;
  }, [expanded, latestActivityPost, question.body]);

  let procurementReplyIndex = 0;

  useEffect(() => {
    if (!expanded || !autoMarkSeen || !showUnseen || question.posts.length === 0) return;
    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.45);
        if (!visible || markSeenRequestedRef.current) return;
        markSeenRequestedRef.current = true;
        void actionMarkQuestionThreadSeen(question.id)
          .then(() => {
            setLocallySeen(true);
            onChanged?.();
          })
          .catch(() => {
            markSeenRequestedRef.current = false;
          });
      },
      { threshold: [0.45, 0.6] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    expanded,
    autoMarkSeen,
    showUnseen,
    question.id,
    question.posts.length,
    onChanged,
  ]);

  function toggleExpanded() {
    expandedByUserRef.current = true;
    setExpanded((open) => {
      if (!open) {
        setInlineReply(false);
      }
      return !open;
    });
  }

  async function submitReply() {
    setBusy(true);
    setError(null);
    try {
      await actionReplyToQuestion(question.id, reply);
      setReply("");
      setInlineReply(false);
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

  const showInlineReplyForm = inlineReply && !expanded && canReply;
  const expandLabel = `Pytanie: ${question.title}`;

  return (
    <article
      ref={cardRef}
      id={`question-${question.id}`}
      className={cn(
        embedded
          ? boardQuestionRowClass({
              unseen: showUnseen,
              open: isOpen,
              expanded,
              alternate: rowAlternate,
              stale,
            })
          : "rounded-md border border-slate-200/90 bg-white shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2 pr-3 sm:gap-2.5 sm:pr-4",
          expanded && embedded && boardQuestionRowHeaderExpandedClass
        )}
      >
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 text-left py-3 sm:py-3.5",
            "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25",
            boardQuestionRowHeaderClass
          )}
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={expandLabel}
        >
          <span className="flex items-start gap-2.5 sm:gap-3">
            <IconChevronDown
              open={expanded}
              size={16}
              className={cn(
                "mt-0.5 shrink-0 text-slate-400 transition-transform duration-300 ease-out motion-reduce:transition-none",
                expanded && "text-indigo-500"
              )}
            />
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {showUnseen ? (
                  <span className={boardQuestionUnseenDotClass} aria-hidden />
                ) : null}
                <span className={cn(salesTypography.rowTitle, "min-w-0 truncate")}>
                  {question.title}
                </span>
                {hasProduct ? (
                  <BoardQuestionProductChip product={question} compact className="max-w-[min(100%,14rem)]" />
                ) : null}
                <span
                  className={boardQuestionStatusBadgeClass({ unseen: showUnseen, open: isOpen })}
                >
                  {statusLabel}
                </span>
              </span>
              <span
                className={cn(
                  salesTypography.rowBody,
                  "block font-medium",
                  expanded ? "text-slate-700" : boardQuestionCollapsedMetaClass
                )}
              >
                Dodał/a:{" "}
                <span className={boardQuestionAuthorNameClass}>{author}</span>
                <span className="text-slate-400"> · </span>
                {formatBoardDate(question.created_at)}
              </span>
              {previewLine ? (
                <span className={boardQuestionPreviewClass}>{previewLine}</span>
              ) : null}
            </span>
          </span>
        </button>

        {canReply && !expanded ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3 shrink-0 sm:mt-3.5"
            disabled={busy}
            onClick={() => {
              setInlineReply((v) => !v);
              setError(null);
            }}
          >
            {inlineReply ? "Anuluj" : "Odpowiedz"}
          </Button>
        ) : null}
      </div>

      {showInlineReplyForm ? (
        <div className={boardQuestionInlineReplyShellClass}>
          <label
            className={cn(salesTypography.rowMeta, "block font-medium text-indigo-700")}
            htmlFor={`inline-reply-${question.id}`}
          >
            {isOpen ? "Odpowiedź działu zakupów" : "Doprecyzowanie"}
          </label>
          <textarea
            id={`inline-reply-${question.id}`}
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Treść wiadomości…"
            className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-sm")}
          />
          <Button size="sm" disabled={busy || !reply.trim()} onClick={() => void submitReply()}>
            {busy ? "Wysyłanie…" : "Wyślij"}
          </Button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}

      {expanded ? (
        <div className={boardQuestionExpandedShellClass}>
        {hasProduct ? <BoardQuestionProductContext product={question} /> : null}

        <BoardThreadMessage
          tone="question"
          authorLabel={author}
          body={question.body}
          createdAt={question.created_at}
        />

        {question.posts.length === 0 ? (
          <p className={boardAwaitingReplyClass}>Dział zakupów jeszcze nie odpowiedział.</p>
        ) : (
          <div className="space-y-3">
            {question.posts.map((post) => {
              const fromOps = isOperationsAuthorRole(post.author?.role ?? null);
              const replyKind = fromOps
                ? procurementReplyLabel(procurementReplyIndex++)
                : undefined;
              return (
                <BoardThreadMessage
                  key={post.id}
                  tone={fromOps ? "procurement" : "sales"}
                  authorLabel={
                    fromOps
                      ? BOARD_PROCUREMENT_AUTHOR_LABEL
                      : authorLabelFromProfile(post.author)
                  }
                  body={post.body}
                  createdAt={post.created_at}
                  replyKind={replyKind}
                />
              );
            })}
          </div>
        )}

        {canReply ? (
          <div className={boardReplyFormShellClass}>
            <label
              className={cn(salesTypography.rowMeta, "block font-medium text-indigo-700")}
              htmlFor={`reply-${question.id}`}
            >
              {isOpen ? "Odpowiedź działu zakupów" : "Doprecyzowanie"}
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

        {error && !showInlineReplyForm ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : null}

        {canArchive ? (
          <div className="pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-400"
              disabled={busy}
              onClick={() => void archive()}
            >
              Archiwizuj pytanie
            </Button>
          </div>
        ) : null}
        </div>
      ) : null}
    </article>
  );
}
