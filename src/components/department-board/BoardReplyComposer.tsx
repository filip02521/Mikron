"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconCamera } from "@/components/icons/StrokeIcons";
import {
  BoardImageDraftThumbs,
  type BoardQuestionImageDraft,
} from "@/components/department-board/BoardQuestionImagesField";
import { NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import {
  BOARD_IMAGE_ACCEPT,
  BOARD_IMAGE_MAX_COUNT,
  imageFilesFromClipboardData,
} from "@/lib/department-board/attachments";
import { DEPARTMENT_BOARD_REPLY_COMPOSER as COPY } from "@/lib/department-board/copy";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Odpowiedź w wątku Tablicy: tekst i/lub do 3 zdjęć.
 * Zdjęcie: przycisk, wklejenie ze schowka (Ctrl+V) albo przeciągnięcie pliku.
 */
export function BoardReplyComposer({
  id,
  label,
  value,
  onChange,
  images,
  imagesError,
  compressing,
  onAddFiles,
  onRemoveImage,
  busy,
  onSubmit,
  error,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  images: BoardQuestionImageDraft[];
  imagesError: string | null;
  compressing: boolean;
  onAddFiles: (files: FileList | File[]) => void | Promise<void>;
  onRemoveImage: (key: string) => void;
  busy: boolean;
  onSubmit: () => void;
  error?: string | null;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const canAddImage = images.length < BOARD_IMAGE_MAX_COUNT && !busy;
  const canSubmit = !busy && !compressing && (value.trim().length > 0 || images.length > 0);

  function handlePaste(event: ClipboardEvent) {
    const files = imageFilesFromClipboardData(event.clipboardData);
    // Przy komplecie zdjęć hook i tak pokaże „maksymalnie 3” — nie ignorujemy po cichu.
    if (!files.length || busy) return;
    event.preventDefault();
    void onAddFiles(files);
  }

  function handleDragEnter(event: DragEvent) {
    if (!dragHasFiles(event) || busy) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent) {
    if (!dragHasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent) {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    const files = Array.from(event.dataTransfer.files).filter((f) =>
      f.type.toLowerCase().startsWith("image/")
    );
    if (files.length) void onAddFiles(files);
  }

  return (
    <div
      className={cn("relative", className)}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        if (dragHasFiles(e) && !busy) e.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label
        className={cn(salesTypography.rowMeta, "block font-medium text-indigo-700")}
        htmlFor={id}
      >
        {label}
      </label>

      <div className="relative mt-2">
        <textarea
          id={id}
          rows={3}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={images.length ? COPY.placeholderWithImages : COPY.placeholder}
          className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-sm")}
        />
        {dragging ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-indigo-400 bg-indigo-50/90 text-sm font-medium text-indigo-700"
            aria-hidden
          >
            <IconCamera size={16} className="mr-1.5" />
            {COPY.dropHere}
          </div>
        ) : null}
      </div>

      {images.length || compressing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <BoardImageDraftThumbs
            images={images}
            disabled={busy}
            onRemove={onRemoveImage}
            size="sm"
          />
          {compressing ? (
            <span className="flex h-16 items-center gap-1.5 px-1 text-[11px] text-slate-500">
              <Spinner size="sm" />
              {COPY.compressing}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={BOARD_IMAGE_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          disabled={!canAddImage}
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
          disabled={!canAddImage}
          aria-label={COPY.attachAriaLabel}
          onClick={() => inputRef.current?.click()}
        >
          <IconCamera size={14} className="shrink-0" />
          {COPY.attach}
          {images.length ? (
            <span className="tabular-nums text-slate-400">
              {images.length}/{BOARD_IMAGE_MAX_COUNT}
            </span>
          ) : null}
        </Button>
        <span className="hidden text-[11px] text-slate-400 sm:inline">{COPY.hint}</span>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={!canSubmit}
          title={COPY.shortcut}
          onClick={onSubmit}
        >
          {busy ? (images.length ? COPY.sendingImages : COPY.sending) : COPY.send}
        </Button>
      </div>

      {imagesError ? <p className="mt-1.5 text-xs text-amber-700">{imagesError}</p> : null}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
