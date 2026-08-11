"use client";

import { useId, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { IconCamera, IconX } from "@/components/icons/StrokeIcons";
import {
  BOARD_IMAGE_ACCEPT,
  BOARD_IMAGE_MAX_COUNT,
} from "@/lib/department-board/attachments";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import { boardQuestionsFieldLabelClass } from "@/lib/department-board/department-board-questions-ui";
import { cn } from "@/lib/cn";

export type BoardQuestionImageDraft = {
  /** Stabilny klucz w UI (nie id z bazy). */
  key: string;
  file: File;
  previewUrl: string;
};

export function BoardQuestionImagesField({
  images,
  disabled,
  error,
  onAddFiles,
  onRemove,
}: {
  images: BoardQuestionImageDraft[];
  disabled?: boolean;
  error?: string | null;
  onAddFiles: (files: FileList | File[]) => void | Promise<void>;
  onRemove: (key: string) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = BOARD_IMAGE_MAX_COUNT - images.length;
  const canAdd = remaining > 0 && !disabled;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className={boardQuestionsFieldLabelClass}>
          {DEPARTMENT_BOARD_QUESTIONS_FORM.imagesLabel}
        </label>
        <span className="text-[11px] text-slate-400">
          {images.length}/{BOARD_IMAGE_MAX_COUNT}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
        {DEPARTMENT_BOARD_QUESTIONS_FORM.imagesHint}
      </p>

      {images.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {images.map((img, index) => (
            <li
              key={img.key}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            >
              <Image
                src={img.previewUrl}
                alt={`Podgląd zdjęcia ${index + 1}`}
                fill
                unoptimized
                className="object-cover"
              />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                onClick={() => onRemove(img.key)}
                disabled={disabled}
                aria-label={`Usuń zdjęcie ${index + 1}`}
              >
                <IconX size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={BOARD_IMAGE_ACCEPT}
          multiple
          className="sr-only"
          disabled={!canAdd}
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
          disabled={!canAdd}
          className={cn(!canAdd && "opacity-60")}
          onClick={() => inputRef.current?.click()}
        >
          <IconCamera size={14} className="shrink-0" />
          {images.length
            ? DEPARTMENT_BOARD_QUESTIONS_FORM.imagesAddMore
            : DEPARTMENT_BOARD_QUESTIONS_FORM.imagesAdd}
        </Button>
      </div>

      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
