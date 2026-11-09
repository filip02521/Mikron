"use client";

import { useRef, type ClipboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { changeWithEmoticons } from "@/lib/ui/emoticons";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { IconPaperclip } from "@/components/icons/StrokeIcons";
import { BoardAttachmentTray, useBoardFileDrop } from "@/components/department-board/BoardAttachmentTray";
import type { BoardQuestionImageDraft } from "@/components/department-board/BoardQuestionImagesField";
import type { BoardDocumentDraft } from "@/components/department-board/useBoardQuestionImages";
import { NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { BOARD_FILE_ACCEPT, boardFilesFromClipboardData } from "@/lib/department-board/attachments";
import { DEPARTMENT_BOARD_REPLY_COMPOSER as COPY } from "@/lib/department-board/copy";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

/**
 * Odpowiedź w wątku Tablicy: tekst i/lub do 3 zdjęć i do 5 plików (PDF, Excel, Word, CSV).
 * Załącznik: przycisk, przeciągnięcie na całe pole odpowiedzi albo Ctrl+V (zrzut lub skopiowany plik).
 */
export function BoardReplyComposer({
  id,
  label,
  value,
  onChange,
  images,
  docs,
  pendingImages = 0,
  issues = [],
  onDismissIssues,
  onAddFiles,
  onRemoveImage,
  onRemoveDoc,
  totalBytes,
  busy,
  onSubmit,
  error,
  className,
  extraFiles = [],
  onRemoveExtraFile,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  images: BoardQuestionImageDraft[];
  docs: BoardDocumentDraft[];
  pendingImages?: number;
  issues?: string[];
  onDismissIssues?: () => void;
  onAddFiles: (files: FileList | File[]) => void | Promise<void>;
  onRemoveImage: (key: string) => void;
  onRemoveDoc: (key: string) => void;
  totalBytes: number;
  busy: boolean;
  onSubmit: () => void;
  error?: string | null;
  className?: string;
  /** Pliki od dostawcy dołączone z jego maila (pobiera je serwer przy wysyłce). */
  extraFiles?: { key: string; name: string }[];
  onRemoveExtraFile?: (key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { dragging, dropProps } = useBoardFileDrop({ disabled: busy, onFiles: (files) => void onAddFiles(files) });
  const hasAttachments = images.length + docs.length + extraFiles.length > 0;
  const canSubmit = !busy && pendingImages === 0 && (value.trim().length > 0 || hasAttachments);

  function handlePaste(event: ClipboardEvent) {
    const files = boardFilesFromClipboardData(event.clipboardData);
    // Tylko pliki — zwykły tekst wkleja się normalnie; limity i powody pokazuje taca.
    if (!files.length || busy) return;
    event.preventDefault();
    void onAddFiles(files);
  }

  return (
    <div className={cn("relative", className)} onPaste={handlePaste} {...dropProps}>
      <label className={cn(salesTypography.rowMeta, "block font-medium text-indigo-700")} htmlFor={id}>
        {label}
      </label>

      <div className="relative mt-2">
        <textarea
          ref={textareaRef}
          id={id}
          rows={3}
          value={value}
          disabled={busy}
          onChange={(e) => changeWithEmoticons(e, onChange)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={hasAttachments ? COPY.placeholderWithImages : COPY.placeholder}
          className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-sm")}
        />
        {dragging ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-indigo-500 bg-indigo-50 text-sm font-medium text-indigo-800"
            aria-hidden
          >
            <IconPaperclip size={16} className="mr-1.5" />
            {COPY.dropHere}
          </div>
        ) : null}
      </div>

      <BoardAttachmentTray
        images={images}
        docs={docs}
        pendingImages={pendingImages}
        issues={issues}
        onDismissIssues={onDismissIssues}
        onRemoveImage={onRemoveImage}
        onRemoveDoc={onRemoveDoc}
        disabled={busy}
        sending={busy}
        totalBytes={totalBytes}
        className="mt-2"
      />

      {extraFiles.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Pliki od dostawcy w odpowiedzi">
          {extraFiles.map((f) => (
            <li
              key={f.key}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs text-slate-700"
            >
              <IconPaperclip size={12} className="shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 break-words">
                <span className="text-slate-500">od dostawcy: </span>
                {f.name}
              </span>
              {onRemoveExtraFile ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemoveExtraFile(f.key)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  aria-label={`Usuń ${f.name} z odpowiedzi`}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={BOARD_FILE_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) void onAddFiles(list);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="max-sm:min-h-10"
          disabled={busy}
          aria-label={COPY.attachAriaLabel}
          onClick={() => inputRef.current?.click()}
        >
          <IconPaperclip size={14} className="shrink-0" aria-hidden />
          {COPY.attach}
        </Button>
        <EmojiPicker textareaRef={textareaRef} value={value} onChange={onChange} disabled={busy} />
        <span className="hidden text-[0.6875rem] text-slate-500 sm:inline">{COPY.hint}</span>
        <Button type="button" size="sm" className="ml-auto max-sm:min-h-10" disabled={!canSubmit} title={COPY.shortcut} onClick={onSubmit}>
          {busy ? (hasAttachments ? COPY.sendingImages : COPY.sending) : pendingImages > 0 ? COPY.compressing : COPY.send}
        </Button>
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
