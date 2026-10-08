"use client";

import { actionResolveAwaitingSupplier } from "@/app/actions/gmail";
import { BoardSupplierReplies } from "@/components/department-board/BoardSupplierReplies";
import { businessDaysLabel, businessDaysSince } from "@/lib/suppliers/awaiting-supplier";
import { useEffect, useMemo, useRef, useState } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { Button } from "@/components/ui/Button";
import { IconCamera, IconChevronDown } from "@/components/icons/StrokeIcons";
import {
  authorLabelFromProfile,
  formatBoardDate,
  formatBoardShortDate,
  isOperationsAuthorRole,
  questionAuthorLabel,
} from "@/lib/department-board/format";
import {
  BOARD_PROCUREMENT_AUTHOR_LABEL,
  boardAwaitingReplyClass,
  boardQuestionPreviewClass,
  boardQuestionAuthorNameClass,
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
import { BoardQuestionProductContext } from "@/components/department-board/BoardQuestionProductContext";
import { BoardThreadMessage } from "@/components/department-board/BoardThreadMessage";
import { BoardReplyComposer } from "@/components/department-board/BoardReplyComposer";
import { SupplierInquiryDialog } from "@/components/department-board/SupplierInquiryDialog";
import { inquiryNeedsAttention, pendingSupplierInquiry } from "@/lib/department-board/supplier-inquiry";
import { isBoardImageAttachment } from "@/lib/department-board/attachments";
import { useBoardQuestionImages } from "@/components/department-board/useBoardQuestionImages";
import {
  boardQuestionHasProduct,
} from "@/lib/department-board/question-product";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  actionArchiveQuestion,
  actionCloseQuestion,
  actionDeleteClosedQuestion,
  actionMarkQuestionThreadSeen,
  actionReopenQuestion,
  actionReplyToQuestion,
  type BoardSupplierFileRef,
} from "@/app/actions/department-board";
import { isStaleAnsweredQuestion } from "@/lib/department-board/attention";
import { askConfirm } from "@/components/ui/ConfirmHost";
import { polishPluralWord } from "@/lib/email/polish-plural";

function photoLabel(count: number): string {
  return count === 1 ? "zdjęcie" : `${count} ${polishPluralWord(count, "zdjęcie", "zdjęcia", "zdjęć")}`;
}

/** Podgląd treści wpisu w zwiniętym wierszu — samo zdjęcie też coś mówi. */
function postPreviewText(body: string, photoCount: number, fileCount = 0): string {
  const text = body.trim();
  const tags = [
    photoCount ? `[${photoLabel(photoCount)}]` : null,
    fileCount ? `[${fileCount === 1 ? "plik" : `pliki: ${fileCount}`}]` : null,
  ].filter(Boolean);
  return [...tags, text].filter(Boolean).join(" ");
}

function supplierFileKey(f: BoardSupplierFileRef): string {
  return `${f.inquiryId}|${f.replyId}|${f.filename}`;
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
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [locallySeen, setLocallySeen] = useState(!unseenReply);
  const [reply, setReply] = useState("");
  /** Załączniki z maila dostawcy dołączone do odpowiedzi (plik pobiera serwer przy wysyłce). */
  const [supplierFiles, setSupplierFiles] = useState<BoardSupplierFileRef[]>([]);
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
  const closedByLabel = question.closed_by_profile
    ? authorLabelFromProfile(question.closed_by_profile)
    : null;
  const showUnseen = unseenReply && !locallySeen;
  const hasProduct = boardQuestionHasProduct(question);
  const stale = isStaleAnsweredQuestion(question);
  const pendingInquiry = isClosed ? null : pendingSupplierInquiry(question.supplierInquiries);
  // Odpowiedź dostawcy z Poczty (synchronizacja Gmaila w tle) — zakupy widzą ją na liście bez rozwijania.
  const supplierAnswered =
    isClosed || audience !== "procurement" ? null : (question.supplierInquiries ?? []).find(inquiryNeedsAttention) ?? null;
  const threadPhotoCount = [...(question.attachments ?? []), ...question.posts.flatMap((post) => post.attachments ?? [])].filter(
    (a) => isBoardImageAttachment(a.mime_type)
  ).length;

  const latestActivityPost = useMemo(() => {
    if (question.posts.length === 0) return null;
    return question.posts.reduce((latest, post) =>
      post.created_at > latest.created_at ? post : latest
    );
  }, [question.posts]);

  /** Druga linia wiersza jak w czacie: kto napisał ostatni i co. */
  const preview = useMemo(() => {
    if (latestActivityPost) {
      const fromOps = isOperationsAuthorRole(latestActivityPost.author?.role ?? null);
      return {
        who: fromOps
          ? "Zakupy"
          : questionAuthorLabel(
              latestActivityPost.author?.sales_person ?? question.sales_person,
              latestActivityPost.author
            ),
        text: postPreviewText(
          latestActivityPost.body,
          (latestActivityPost.attachments ?? []).filter((a) => isBoardImageAttachment(a.mime_type)).length,
          (latestActivityPost.attachments ?? []).filter((a) => !isBoardImageAttachment(a.mime_type)).length
        ),
      };
    }
    // Bez odpowiedzi: autor jest już w pierwszej linii — sama treść.
    return { who: null, text: question.body };
  }, [latestActivityPost, question.body, question.sales_person]);
  const lastActivityAt = latestActivityPost?.created_at ?? question.created_at;
  /** Produkt w wierszu tylko gdy nie ma go już w tytule. */
  const productSymbolHint =
    hasProduct && question.product_symbol?.trim() && !question.title.includes(question.product_symbol.trim())
      ? question.product_symbol.trim()
      : null;

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
      await actionReplyToQuestion(question.id, reply, replyImageFiles, supplierFiles);
      setReply("");
      setSupplierFiles([]);
      clearReplyImages();
      setInlineReply(false);
      onChanged?.();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się wysłać odpowiedzi."));
    } finally {
      setBusy(false);
    }
  }

  /** Dostawca odpowiedział poza mailem — koniec czekania bez wpisu w wątku. */
  async function endSupplierWait(inquiryId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await actionResolveAwaitingSupplier({ kind: "inquiry", id: inquiryId });
      if (!res.ok && !/już zamknięta/.test(res.message)) setError(res.message);
      else onChanged?.();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się zakończyć czekania."));
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
      !(await askConfirm({
        title: "Usunąć zakończony wątek?",
        message: "Usunięcie jest trwałe — tej operacji nie można cofnąć.",
        confirmLabel: "Usuń na stałe",
        danger: true,
      }))
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

  // Status w wierszu tylko gdy wymaga uwagi; resztę mówi filtr i pasek po lewej.
  const statusLabel = isClosed
    ? null
    : supplierAnswered
      ? supplierAnswered.bounced
        ? "Mail do dostawcy nie doszedł"
        : "Dostawca odpisał"
      : isOpen
      ? pendingInquiry
        ? "Czeka na dostawcę"
        : "Bez odpowiedzi"
      : showUnseen
        ? "Nowa odpowiedź"
        : pendingInquiry
          ? "Czeka na dostawcę"
          : null;

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
      extraFiles={supplierFiles.map((f) => ({ key: supplierFileKey(f), name: f.filename }))}
      onRemoveExtraFile={(key) => setSupplierFiles((prev) => prev.filter((f) => supplierFileKey(f) !== key))}
    />
  );
  const expandLabel = `Pytanie: ${question.title}`;

  return (
    <article
      ref={cardRef}
      id={`question-${question.id}`}
      className={cn(
        "group",
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
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex min-w-0 items-center gap-2">
                {showUnseen ? (
                  <span className={boardQuestionUnseenDotClass} aria-hidden />
                ) : null}
                <span className={cn(salesTypography.rowTitle, "min-w-0 flex-1 truncate")}>
                  {question.title}
                </span>
                {statusLabel ? (
                  <span
                    className={
                      supplierAnswered
                        ? cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1",
                            supplierAnswered.bounced
                              ? "bg-red-50 text-red-800 ring-red-200"
                              : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                          )
                        : boardQuestionStatusBadgeClass({ unseen: showUnseen, open: isOpen })
                    }
                    title={
                      supplierAnswered
                        ? `${supplierAnswered.supplierName} · ${formatBoardDate(supplierAnswered.replyAt!)}`
                        : undefined
                    }
                  >
                    {statusLabel}
                  </span>
                ) : null}
                {threadPhotoCount > 0 ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500"
                    title={`W wątku: ${photoLabel(threadPhotoCount)}`}
                  >
                    <IconCamera size={12} className="shrink-0" aria-hidden />
                    <span className="tabular-nums">{threadPhotoCount}</span>
                    <span className="sr-only">zdjęć w wątku</span>
                  </span>
                ) : null}
                {!expanded ? (
                  <span className="hidden max-w-[9rem] shrink-0 truncate text-xs font-medium text-slate-600 sm:inline">
                    {author}
                  </span>
                ) : null}
                <span
                  className="shrink-0 text-[11px] tabular-nums text-slate-500"
                  title={`Ostatnia aktywność: ${formatBoardDate(lastActivityAt)}`}
                >
                  {formatBoardShortDate(lastActivityAt)}
                </span>
              </span>
              {expanded ? (
                <span className={cn(salesTypography.rowBody, "block text-slate-600")}>
                  <span className={boardQuestionAuthorNameClass}>{author}</span>
                  <span className="ml-2 tabular-nums">{formatBoardDate(question.created_at)}</span>
                </span>
              ) : (
                <span className={boardQuestionPreviewClass}>
                  {productSymbolHint ? (
                    <span className="mr-2 rounded border border-slate-200 bg-slate-50 px-1 py-px font-mono text-[10.5px] text-slate-600">
                      {productSymbolHint}
                    </span>
                  ) : null}
                  {/* Telefon: autor tylko tu (w 1. linii brak miejsca). */}
                  {preview.who ? (
                    <>
                      <span className="font-semibold text-slate-700">{preview.who}:</span>{" "}
                    </>
                  ) : (
                    <span className="font-semibold text-slate-700 sm:hidden">{author}: </span>
                  )}
                  {preview.text}
                </span>
              )}
            </span>
          </span>
        </button>

        {canReply && !expanded && !isClosed ? (
          // Szybka odpowiedź: na komputerze po najechaniu / fokusie; na telefonie — po rozwinięciu.
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn(
              "mt-3 hidden shrink-0 sm:mt-3.5 sm:inline-flex",
              !inlineReply &&
                "sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            )}
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
          audience === "sales" && !pendingInquiry ? (
            <p className={boardAwaitingReplyClass}>Dział zakupów jeszcze nie odpowiedział.</p>
          ) : null
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

        {audience === "procurement" && !isClosed && question.supplierInquiries?.length ? (
          <BoardSupplierReplies
            threadId={question.id}
            refreshKey={(question.supplierInquiries ?? []).map((i) => i.replyAt ?? "").join("|")}
            attachedKeys={supplierFiles.map(supplierFileKey)}
            onToggleFile={(file) =>
              setSupplierFiles((prev) =>
                prev.some((f) => supplierFileKey(f) === supplierFileKey(file))
                  ? prev.filter((f) => supplierFileKey(f) !== supplierFileKey(file))
                  : [...prev, file]
              )
            }
            onUseAnswer={(text) => {
              // Nie nadpisuje tego, co już ktoś zaczął pisać — dokleja pod spodem.
              setReply((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text));
              // Pole odpowiedzi pod spodem — od razu do poprawki.
              requestAnimationFrame(() => document.getElementById(`reply-${question.id}`)?.focus());
            }}
          />
        ) : null}

        {pendingInquiry ? (
          <p className={boardAwaitingReplyClass}>
            {audience === "sales" ? "Zakupy zapytały dostawcę" : "Zapytanie wysłane do dostawcy"}{" "}
            <span className="font-medium text-slate-700">{pendingInquiry.supplierName}</span> ·{" "}
            {formatBoardDate(pendingInquiry.sentAt)}
            {!pendingInquiry.replyAt && businessDaysSince(new Date(pendingInquiry.sentAt)) > 0
              ? ` (czeka ${businessDaysLabel(businessDaysSince(new Date(pendingInquiry.sentAt)))})`
              : ""}
            .{" "}
            {audience === "sales"
              ? "Odpowiedź pojawi się w tym wątku."
              : pendingInquiry.replyAt
                ? `${pendingInquiry.bounced ? "Mail wrócił" : "Dostawca odpisał"} ${formatBoardDate(pendingInquiry.replyAt)} - odpowiedz handlowcowi, żeby zamknąć sprawę.`
                : "Gdy dostawca odpisze, jego mail pokaże się tutaj (sprawdzamy co kilka minut) - Twoja odpowiedź handlowcowi zakończy czekanie."}
            {audience === "procurement" && canReply ? (
              <>
                {" "}
                <button
                  type="button"
                  className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void endSupplierWait(pendingInquiry.id)}
                  title="Dostawca odpowiedział inną drogą (telefon, portal) - zapytanie znika z listy „Czeka na dostawcę”"
                >
                  Zakończ czekanie
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        {canReply && !isClosed ? (
          <div className={boardReplyFormShellClass}>{replyComposer(`reply-${question.id}`)}</div>
        ) : null}

        {canReply && !isClosed && audience === "procurement" ? (
          <div className="pt-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setInquiryOpen(true)}
            >
              Zapytaj dostawcę
            </Button>
          </div>
        ) : null}

        {inquiryOpen ? (
          <SupplierInquiryDialog
            threadId={question.id}
            onClose={() => setInquiryOpen(false)}
            onSent={() => onChanged?.()}
          />
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
