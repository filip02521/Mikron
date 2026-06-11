"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  authorLabelFromProfile,
  boardReplyCountLabel,
  formatBoardDate,
  isOperationsAuthorRole,
  questionAuthorLabel,
} from "@/lib/department-board/format";
import {
  BOARD_PROCUREMENT_AUTHOR_LABEL,
  boardAnswerBlockClass,
  boardAnswerPreviewPrefixClass,
  boardAuthorPillClass,
  boardAwaitingReplyClass,
  boardBlockKindLabelClass,
  boardProcurementPillClass,
  boardQuestionBlockClass,
  boardQuestionEmbeddedShellClass,
  boardQuestionPreviewPrefixClass,
  boardQuestionStatusAnsweredClass,
  boardQuestionStatusOpenClass,
  boardQuestionUnseenBadgeClass,
} from "@/lib/department-board/department-board-thread-styles";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import { NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  actionArchiveQuestion,
  actionMarkQuestionThreadSeen,
  actionReplyToQuestion,
} from "@/app/actions/department-board";

function ThreadMessageBlock({
  kind,
  authorLabel,
  authorPillClass,
  shellClass,
  kindLabel,
  body,
}: {
  kind: "question" | "answer";
  authorLabel: string;
  authorPillClass: string;
  shellClass: string;
  kindLabel: string;
  body: string;
}) {
  return (
    <div className={shellClass}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={boardBlockKindLabelClass}>{kindLabel}</span>
        <span className={authorPillClass}>{authorLabel}</span>
      </div>
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed",
          kind === "question" ? "text-slate-800" : "text-indigo-950"
        )}
      >
        {body}
      </p>
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

  const author = questionAuthorLabel(question.sales_person, question.author);
  const isOpen = question.status === "open";
  const replyCount = question.posts.length;
  const showUnseen = unseenReply && !locallySeen;
  const firstAnswerPreview = useMemo(
    () => question.posts.find((post) => isOperationsAuthorRole(post.author?.role ?? null)) ?? question.posts[0],
    [question.posts]
  );

  useEffect(() => {
    setLocallySeen(!unseenReply);
    setExpanded(defaultExpanded);
  }, [question.id, unseenReply, defaultExpanded]);

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

  return (
    <article
      id={`question-${question.id}`}
      className={cn(
        embedded
          ? boardQuestionEmbeddedShellClass({ unseen: showUnseen, open: isOpen })
          : "rounded-md border border-slate-200/90 bg-white shadow-sm",
        !embedded && isOpen && "ring-1 ring-amber-100"
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "mt-0.5 shrink-0",
            isOpen ? boardQuestionStatusOpenClass : boardQuestionStatusAnsweredClass
          )}
        >
          {isOpen ? "Czeka na odpowiedź" : "Odpowiedziano"}
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {showUnseen ? (
              <span className={boardQuestionUnseenBadgeClass}>Nowa odpowiedź</span>
            ) : null}
            <span className={salesTypography.rowTitle}>{question.title}</span>
          </div>
          <span className={cn(salesTypography.rowMeta, "block")}>
            {author} · {formatBoardDate(question.created_at)}
            {replyCount > 0 ? ` · ${boardReplyCountLabel(replyCount)}` : null}
          </span>
          {!expanded ? (
            <span className="block space-y-1">
              <span className={cn(salesTypography.rowMeta, "block truncate")}>
                <span className={boardQuestionPreviewPrefixClass}>P:</span> {question.body}
              </span>
              {firstAnswerPreview ? (
                <span className={cn(salesTypography.rowMeta, "block truncate")}>
                  <span className={boardAnswerPreviewPrefixClass}>O:</span> {firstAnswerPreview.body}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          <ThreadMessageBlock
            kind="question"
            kindLabel="Pytanie"
            authorLabel={author}
            authorPillClass={boardAuthorPillClass}
            shellClass={boardQuestionBlockClass}
            body={question.body}
          />

          {question.posts.length === 0 ? (
            <p className={boardAwaitingReplyClass}>Jeszcze bez odpowiedzi działu zakupów.</p>
          ) : null}

          {question.posts.map((post) => {
            const fromOps = isOperationsAuthorRole(post.author?.role ?? null);
            return (
              <ThreadMessageBlock
                key={post.id}
                kind="answer"
                kindLabel="Odpowiedź"
                authorLabel={
                  fromOps ? BOARD_PROCUREMENT_AUTHOR_LABEL : authorLabelFromProfile(post.author)
                }
                authorPillClass={fromOps ? boardProcurementPillClass : boardAuthorPillClass}
                shellClass={boardAnswerBlockClass}
                body={post.body}
              />
            );
          })}

          {canReply ? (
            <div className="space-y-2 rounded-md border border-indigo-100 bg-indigo-50/30 p-3">
              <label className="block text-xs font-medium text-indigo-950" htmlFor={`reply-${question.id}`}>
                {isOpen ? "Odpowiedź działu zakupów" : "Dodaj doprecyzowanie (widoczne dla wszystkich)"}
              </label>
              <textarea
                id={`reply-${question.id}`}
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Odpowiedź widoczna dla wszystkich handlowców…"
                className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-sm")}
              />
              <Button size="sm" disabled={busy || !reply.trim()} onClick={() => void submitReply()}>
                {busy ? "Wysyłanie…" : "Wyślij odpowiedź"}
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
