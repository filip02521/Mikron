"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { Button } from "@/components/ui/Button";
import { IconCamera, IconChevronDown } from "@/components/icons/StrokeIcons";
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
import type { DepartmentBoardQuestion } from "@/lib/data/department-board-shared";
import { BoardQuestionProductChip } from "@/components/department-board/BoardQuestionProductChip";
import { BoardQuestionProductContext } from "@/components/department-board/BoardQuestionProductContext";
import { BoardThreadMessage } from "@/components/department-board/BoardThreadMessage";
import { BoardReplyComposer } from "@/components/department-board/BoardReplyComposer";
import { useBoardQuestionImages } from "@/components/department-board/useBoardQuestionImages";
import { boardQuestionHasProduct } from "@/lib/department-board/question-product";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  actionArchiveQuestion,
  actionCloseQuestion,
  actionDeleteClosedQuestion,
  actionMarkQuestionThreadSeen,
  actionReopenQuestion,
  actionReplyToQuestion,
} from "@/app/actions/department-board";
import { isStaleAnsweredQuestion } from "@/lib/department-board/attention";

function photoLabel(count: number): string {
  return count === 1 ? "zdjęcie" : count < 5 ? `${count} zdjęcia` : `${count} zdjęć`;
}

/** Podgląd treści wpisu w zwiniętym wierszu — samo zdjęcie też coś mówi. */
function postPreviewText(body: string, photoCount: number): string {
  const text = body.trim();
  if (!photoCount) return text;
  const photos = `[${photoLabel(photoCount)}]`;
  return text ? `${photos} ${text}` : photos;
}

function procurementReplyLabel(indexAmongProcurement: number): string {
  return indexAmongProcurement === 0 ? "Odpowiedź" : "Doprecyzowanie";
}

export function QuestionThreadCard({
  question,
  canReply = false,
  canArchive = false,
  canClose = false,
  canReopen = false,
  canDeleteClosed = false,
  audience = "procurement",
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
  canClose?: boolean;
  canReopen?: boolean;
  /** Administrator — trwałe usunięcie zakończonego wątku. */
  canDeleteClosed?: boolean;
  audience?: "sales" | "procurement";
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
  const {
    images: replyImages,
    imagesError: replyImagesError,
    compressing: replyCompressing,
    addFiles: addReplyImages,
    removeImage: removeReplyImage,
    clearImages: clearReplyImages,
    imageFiles: replyImageFiles,
  } = useBoardQuestionImages();
  const [error, setError] = useState<string | null>(null);
  const expandedByUserRef = useRef(false);
  const markSeenRequestedRef = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const author = questionAuthorLabel(question.sales_person, question.author);
  const isOpen = question.status === "open";
  const isClosed = question.archived_at != null;
  const replyCount = question.posts.length;
  const closedByLabel = question.closed_by_profile
    ? authorLabelFromProfile(question.closed_by_profile)
    : null;
  const showUnseen = unseenReply && !locallySeen;
  const hasProduct = boardQuestionHasProduct(question);
  const stale = isStaleAnsweredQuestion(question);
  const threadPhotoCount =
    (question.attachments?.length ?? 0) +
    question.posts.reduce((sum, post) => sum + (post.attachments?.length ?? 0), 0);

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
      return `${prefix} ${postPreviewText(
        latestActivityPost.body,
        latestActivityPost.attachments?.length ?? 0
      )}`;
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
      await actionReplyToQuestion(question.id, reply, replyImageFiles);
      setReply("");
      clearReplyImages();
      setInlineReply(false);
      onChanged?.();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się wysłać odpowiedzi."));
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
      setError(userFacingErrorText(e, "Nie udało się zarchiwizować."));
    } finally {
      setBusy(false);
    }
  }

  async function closeThread() {
    setBusy(true);
    setError(null);
    try {
      await actionCloseQuestion(question.id);
      onChanged?.();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się zamknąć wątku."));
    } finally {
      setBusy(false);
    }
  }

  async function reopenThread() {
    setBusy(true);
    setError(null);
    try {
      await actionReopenQuestion(question.id);
      onChanged?.();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się otworzyć wątku."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteClosedThread() {
    if (busy) return;
    if (
      !window.confirm(
        "Usunąć ten zakończony wątek na stałe? Tej operacji nie można cofnąć."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await actionDeleteClosedQuestion(question.id);
      onChanged?.();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się usunąć wątku."));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = isClosed
    ? "Zakończone"
    : isOpen
      ? "Bez odpowiedzi"
      : showUnseen
        ? "Nowa odpowiedź"
        : replyCount > 0
          ? boardReplyCountLabel(replyCount)
          : "Odpowiedziano";

  const replyLabel = audience === "sales"
    ? "Twoja wiadomość"
    : isOpen
      ? "Odpowiedź działu zakupów"
      : "Doprecyzowanie";

  const showInlineReplyForm = inlineReply && !expanded && canReply;

  const replyComposer = (id: string) => (
    <BoardReplyComposer
      id={id}
      label={replyLabel}
      value={reply}
      onChange={setReply}
      images={replyImages}
      imagesError={replyImagesError}
      compressing={replyCompressing}
      onAddFiles={addReplyImages}
      onRemoveImage={removeReplyImage}
      busy={busy}
      onSubmit={() => void submitReply()}
      error={error}
    />
  );
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
                {threadPhotoCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"
                    title={`W wątku: ${photoLabel(threadPhotoCount)}`}
                  >
                    <IconCamera size={12} className="shrink-0" aria-hidden />
                    <span className="tabular-nums">{threadPhotoCount}</span>
                    <span className="sr-only">zdjęć w wątku</span>
                  </span>
                ) : null}
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

        {canReply && !expanded && !isClosed ? (
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
          {replyComposer(`inline-reply-${question.id}`)}
        </div>
      ) : null}

      {expanded ? (
        <div className={boardQuestionExpandedShellClass}>
        {hasProduct ? (
          <BoardQuestionProductContext
            product={question}
            showQuickProsba={audience === "sales"}
            threadId={question.id}
          />
        ) : null}

        <BoardThreadMessage
          tone="question"
          authorLabel={author}
          body={question.body}
          createdAt={question.created_at}
          attachments={question.attachments}
        />

        {question.posts.length === 0 ? (
          <p className={boardAwaitingReplyClass}>Dział zakupów jeszcze nie odpowiedział.</p>
        ) : (
          <div className="space-y-3">
            {question.posts.map((post) => {
              const fromOps = isOperationsAuthorRole(post.author?.role ?? null);
              const replyKind = fromOps
                ? procurementReplyLabel(procurementReplyIndex++)
                : "Doprecyzowanie handlowca";
              return (
                <BoardThreadMessage
                  key={post.id}
                  tone={fromOps ? "procurement" : "sales"}
                  authorLabel={
                    fromOps
                      ? BOARD_PROCUREMENT_AUTHOR_LABEL
                      : questionAuthorLabel(
                          post.author?.sales_person ?? question.sales_person,
                          post.author,
                        )
                  }
                  body={post.body}
                  createdAt={post.created_at}
                  replyKind={replyKind}
                  attachments={post.attachments}
                />
              );
            })}
          </div>
        )}

        {canReply && !isClosed ? (
          <div className={boardReplyFormShellClass}>{replyComposer(`reply-${question.id}`)}</div>
        ) : null}

        {error && !showInlineReplyForm && !(canReply && !isClosed) ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : null}

        {isClosed ? (
          <p className="text-xs text-slate-400">
            {closedByLabel
              ? `Zamknięto: ${closedByLabel}`
              : "Zamknięto automatycznie"}
            {question.archived_at ? ` · ${formatBoardDate(question.archived_at)}` : ""}
          </p>
        ) : null}

        {isClosed && (canReopen || canDeleteClosed) ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {canReopen ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-indigo-600"
                disabled={busy}
                onClick={() => void reopenThread()}
              >
                Otwórz ponownie
              </Button>
            ) : null}
            {canDeleteClosed ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-red-600 hover:text-red-700"
                disabled={busy}
                onClick={() => void deleteClosedThread()}
              >
                Usuń
              </Button>
            ) : null}
          </div>
        ) : null}

        {canClose && !isClosed ? (
          <div className="pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-400"
              disabled={busy}
              onClick={() => void closeThread()}
            >
              Zamknij wątek
            </Button>
          </div>
        ) : null}

        {canArchive && !isClosed ? (
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
