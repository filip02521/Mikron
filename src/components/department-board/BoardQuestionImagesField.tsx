"use client";

import { useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { IconPaperclip } from "@/components/icons/StrokeIcons";
import { BoardAttachmentTray } from "@/components/department-board/BoardAttachmentTray";
import type { BoardDocumentDraft } from "@/components/department-board/useBoardQuestionImages";
import { BOARD_FILE_ACCEPT } from "@/lib/department-board/attachments";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import { boardQuestionsFieldLabelClass } from "@/lib/department-board/department-board-questions-ui";
import { cn } from "@/lib/cn";

export type BoardQuestionImageDraft = {
  /** Stabilny klucz w UI (nie id z bazy). */
  key: string;
  file: File;
  previewUrl: string;
};

/**
 * „Zdjęcia i pliki” w formularzu pytania. Pusty stan to przerywany obszar do kliknięcia (przeciąganie
 * i Ctrl+V obsługuje cały formularz — `dragging` podświetla ten obszar); z załącznikami — taca i „Dodaj kolejne”.
 */
export function BoardQuestionImagesField({
  images,
  docs,
  pendingImages = 0,
  issues = [],
  onDismissIssues,
  totalBytes,
  disabled,
  sending,
  dragging,
  onAddFiles,
  onRemove,
  onRemoveDoc,
}: {
  images: BoardQuestionImageDraft[];
  docs: BoardDocumentDraft[];
  pendingImages?: number;
  issues?: string[];
  onDismissIssues?: () => void;
  totalBytes: number;
  disabled?: boolean;
  sending?: boolean;
  /** Plik przeciągany nad formularzem. */
  dragging?: boolean;
  onAddFiles: (files: FileList | File[]) => void | Promise<void>;
  onRemove: (key: string) => void;
  onRemoveDoc: (key: string) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const empty = images.length + docs.length + pendingImages === 0;
  const pick = () => inputRef.current?.click();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className={boardQuestionsFieldLabelClass}>
          {DEPARTMENT_BOARD_QUESTIONS_FORM.imagesLabel}
        </label>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={BOARD_FILE_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-describedby={hintId}
        disabled={disabled}
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void onAddFiles(list);
          e.target.value = "";
        }}
      />

      {empty || dragging ? (
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          aria-describedby={hintId}
          className={cn(
            "mt-1.5 flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-4 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60",
            dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
          )}
        >
          <IconPaperclip size={18} className={dragging ? "text-indigo-700" : "text-slate-500"} aria-hidden />
          <span className={cn("text-sm font-medium", dragging ? "text-indigo-800" : "text-slate-800")}>
            {dragging ? DEPARTMENT_BOARD_QUESTIONS_FORM.imagesDropHere : DEPARTMENT_BOARD_QUESTIONS_FORM.imagesAdd}
          </span>
          <span id={hintId} className="text-xs text-slate-500">
            {DEPARTMENT_BOARD_QUESTIONS_FORM.imagesHint}
          </span>
        </button>
      ) : (
        <p id={hintId} className="mt-0.5 text-[0.6875rem] leading-snug text-slate-500">
          {DEPARTMENT_BOARD_QUESTIONS_FORM.imagesHint}
        </p>
      )}

      <BoardAttachmentTray
        images={images}
        docs={docs}
        pendingImages={pendingImages}
        issues={issues}
        onDismissIssues={onDismissIssues}
        onRemoveImage={onRemove}
        onRemoveDoc={onRemoveDoc}
        disabled={disabled}
        sending={sending}
        totalBytes={totalBytes}
        className="mt-2"
      />

      {!empty && !dragging ? (
        <Button type="button" size="sm" variant="secondary" className="mt-2 max-sm:min-h-10" disabled={disabled} onClick={pick}>
          <IconPaperclip size={14} className="shrink-0" aria-hidden />
          {DEPARTMENT_BOARD_QUESTIONS_FORM.imagesAddMore}
        </Button>
      ) : null}
    </div>
  );
}
