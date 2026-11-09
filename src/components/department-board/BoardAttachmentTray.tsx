"use client";

import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { IconAlertCircle, IconX } from "@/components/icons/StrokeIcons";
import { BrandLoader } from "@/components/ui/BrandLoader";
import type { BoardQuestionImageDraft } from "@/components/department-board/BoardQuestionImagesField";
import type { BoardDocumentDraft } from "@/components/department-board/useBoardQuestionImages";
import {
  BOARD_DOCUMENT_MAX_COUNT,
  BOARD_IMAGE_MAX_COUNT,
  BOARD_PROXY_SOFT_LIMIT_BYTES,
  boardFileTypeLabel,
  formatBoardFileSize,
} from "@/lib/department-board/attachments";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { cn } from "@/lib/cn";

function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Przeciąganie plików na obszar (formularz pytania, odpowiedź): licznik wejść, żeby podświetlenie
 * nie migało nad elementami w środku. `dragging` = pokaż „Upuść tutaj”.
 */
export function useBoardFileDrop({ disabled, onFiles }: { disabled?: boolean; onFiles: (files: File[]) => void }) {
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    dropProps: {
      onDragEnter: (e: DragEvent) => {
        if (!dragHasFiles(e) || disabled) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (e: DragEvent) => {
        if (dragHasFiles(e) && !disabled) e.preventDefault();
      },
      onDragLeave: (e: DragEvent) => {
        if (!dragHasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (e: DragEvent) => {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      },
    },
  };
}

/** „2 pliki i 1 zdjęcie” — podsumowanie przy wysyłce. */
export function boardAttachmentsPhrase(images: number, docs: number): string {
  const parts = [
    docs ? `${docs} ${polishPluralWord(docs, "plik", "pliki", "plików")}` : null,
    images ? `${images} ${polishPluralWord(images, "zdjęcie", "zdjęcia", "zdjęć")}` : null,
  ].filter(Boolean);
  return parts.join(" i ");
}

/**
 * Taca załączników przed wysłaniem: miniatury zdjęć, kafelki plików (typ, pełna nazwa, rozmiar, usuń),
 * zdjęcia w trakcie przygotowania, licznik limitów, powody odrzucenia plików i ostrzeżenie o rozmiarze.
 */
export function BoardAttachmentTray({
  images,
  docs,
  pendingImages = 0,
  issues = [],
  onDismissIssues,
  onRemoveImage,
  onRemoveDoc,
  disabled,
  sending,
  totalBytes,
  className,
}: {
  images: BoardQuestionImageDraft[];
  docs: BoardDocumentDraft[];
  pendingImages?: number;
  issues?: string[];
  onDismissIssues?: () => void;
  onRemoveImage: (key: string) => void;
  onRemoveDoc: (key: string) => void;
  disabled?: boolean;
  /** Trwa wysyłka — kafelki przygaszone, bez usuwania. */
  sending?: boolean;
  totalBytes: number;
  className?: string;
}) {
  const hasItems = images.length + docs.length + pendingImages > 0;
  if (!hasItems && !issues.length) return null;
  const locked = disabled || sending;
  return (
    <div className={cn("space-y-2", className)}>
      {hasItems ? (
        <>
          <p className="text-[0.6875rem] tabular-nums text-slate-500">
            Zdjęcia {images.length + pendingImages}/{BOARD_IMAGE_MAX_COUNT} · Pliki {docs.length}/{BOARD_DOCUMENT_MAX_COUNT}
            {totalBytes > 0 ? ` · razem ${formatBoardFileSize(totalBytes)}` : ""}
          </p>
          <ul className={cn("flex flex-wrap gap-2", sending && "opacity-60")} aria-label="Załączniki do wysłania">
            {images.map((img, index) => (
              <li key={img.key} className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <Image src={img.previewUrl} alt={`Zdjęcie ${index + 1}: ${img.file.name}`} fill unoptimized className="object-cover" />
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => onRemoveImage(img.key)}
                    aria-label={`Usuń zdjęcie ${img.file.name}`}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-scrim/70 max-sm:h-8 max-sm:w-8 text-white hover:bg-scrim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <IconX size={12} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
            {Array.from({ length: pendingImages }, (_, i) => (
              <li
                key={`pending-${i}`}
                className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-slate-300 bg-slate-50 text-[0.625rem] text-slate-500"
                role="status"
              >
                <BrandLoader size="sm" tile={false} />
                zdjęcie…
              </li>
            ))}
            {docs.map((d) => (
              <li
                key={d.key}
                className="flex min-h-16 w-full max-w-[17rem] items-center gap-2.5 rounded-md border border-slate-200 bg-card py-2 pl-2.5 pr-1 sm:w-auto"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[0.625rem] font-semibold tracking-tight text-slate-700"
                  aria-hidden
                >
                  {boardFileTypeLabel(d.file.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-medium leading-snug text-slate-900">{d.file.name}</span>
                  <span className="block text-[0.6875rem] tabular-nums text-slate-500">{formatBoardFileSize(d.file.size)}</span>
                </span>
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => onRemoveDoc(d.key)}
                    aria-label={`Usuń ${d.file.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:h-10 max-sm:w-10"
                  >
                    <IconX size={14} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {issues.length ? (
        <div className="rounded-md bg-amber-50 px-3 py-2" role="alert">
          <ul className="space-y-0.5">
            {issues.map((msg) => (
              <li key={msg} className="flex items-start gap-1.5 text-xs leading-snug text-amber-900">
                <IconAlertCircle size={14} className="mt-px shrink-0 text-amber-500" aria-hidden />
                {msg}
              </li>
            ))}
          </ul>
          {onDismissIssues ? (
            <button
              type="button"
              onClick={onDismissIssues}
              className="mt-1 rounded-sm text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Ukryj
            </button>
          ) : null}
        </div>
      ) : null}

      {totalBytes > BOARD_PROXY_SOFT_LIMIT_BYTES && !sending ? (
        <p className="text-xs text-amber-800">
          Razem {formatBoardFileSize(totalBytes)} - serwer OnTime może odrzucić wysyłkę powyżej ok. 1 MB. Zmniejsz PDF albo wyślij część w kolejnej
          wiadomości.
        </p>
      ) : null}

      {sending && images.length + docs.length > 0 ? (
        <p className="flex items-center gap-2 text-xs text-slate-600" role="status">
          <BrandLoader size="sm" tile={false} />
          Wysyłam {boardAttachmentsPhrase(images.length, docs.length)}
          {totalBytes > 0 ? ` (${formatBoardFileSize(totalBytes)})` : ""}…
        </p>
      ) : null}
    </div>
  );
}
