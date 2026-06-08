"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  authorLabelFromProfile,
  formatBoardDate,
  isOperationsAuthorRole,
  questionAuthorLabel,
} from "@/lib/department-board/format";
import type { DepartmentBoardQuestion } from "@/lib/data/department-board";
import { NOTATNIK_INPUT_CLASS, NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { cn } from "@/lib/cn";
import {
  actionArchiveQuestion,
  actionMarkQuestionThreadSeen,
  actionReplyToQuestion,
} from "@/app/actions/department-board";

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
          ? cn(
              "border-l-[3px] bg-white",
              showUnseen ? "border-l-sky-500 bg-sky-50/25" : "border-l-slate-200"
            )
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
            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isOpen
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-900"
          )}
        >
          {isOpen ? "Pytanie · czeka" : "Odpowiedziane"}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          {showUnseen ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              Nowa odpowiedź
            </span>
          ) : null}
          <span className="block text-sm font-semibold text-slate-900">{question.title}</span>
          <span className="block text-xs text-slate-600">
            {author} · {formatBoardDate(question.created_at)}
            {replyCount > 0
              ? ` · ${replyCount} ${replyCount === 1 ? "odpowiedź" : replyCount < 5 ? "odpowiedzi" : "odpowiedzi"}`
              : null}
          </span>
          {!expanded ? (
            <span className="block truncate text-xs text-slate-500">{question.body}</span>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="rounded-md border border-slate-100 bg-slate-50/80 p-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Pytanie · {author}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {question.body}
            </p>
          </div>

          {question.posts.map((post) => {
            const fromOps = isOperationsAuthorRole(post.author?.role ?? null);
            return (
              <div
                key={post.id}
                className={cn(
                  "rounded-md border p-3",
                  fromOps
                    ? "border-l-4 border-l-indigo-500 border-indigo-100 bg-indigo-50/50"
                    : "border-slate-100 bg-white"
                )}
              >
                <p className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {fromOps ? (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800">
                      Zakupy
                    </span>
                  ) : null}
                  <span>{authorLabelFromProfile(post.author)}</span>
                  <span className="font-normal normal-case text-slate-400">
                    · {formatBoardDate(post.created_at)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {post.body}
                </p>
              </div>
            );
          })}

          {canReply ? (
            <div className="space-y-2 rounded-md border border-indigo-100 bg-indigo-50/30 p-3">
              <label className="block text-xs font-medium text-indigo-950" htmlFor={`reply-${question.id}`}>
                {isOpen ? "Odpowiedź zakupów" : "Dodaj doprecyzowanie (widoczne dla wszystkich)"}
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
