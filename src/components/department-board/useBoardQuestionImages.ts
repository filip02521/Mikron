"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMPRESS_IMAGE_MAX_INPUT_BYTES,
  compressImageFile,
} from "@/lib/client/compress-image";
import {
  BOARD_DOCUMENT_MAX_BYTES,
  BOARD_DOCUMENT_MAX_COUNT,
  BOARD_DOCUMENT_MAX_TOTAL_BYTES,
  BOARD_IMAGE_MAX_COUNT,
  boardDocumentFileType,
} from "@/lib/department-board/attachments";
import type { BoardQuestionImageDraft } from "@/components/department-board/BoardQuestionImagesField";
import { useLatest } from "@/hooks/useLatest";

function newDraftKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Dokument dołączony do pytania / odpowiedzi (PDF, Excel, Word, CSV) — bez podglądu i kompresji. */
export type BoardDocumentDraft = { key: string; file: File };

/**
 * Załączniki z jednego miejsca (przycisk, przeciągnięcie, Ctrl+V): zdjęcia idą kompresją (do 3),
 * dokumenty bez zmian (do 5). Każdy odrzucony plik ma własny powód w `issues` — dodane pliki zostają.
 */
export function useBoardQuestionImages() {
  const [images, setImages] = useState<BoardQuestionImageDraft[]>([]);
  const [docs, setDocs] = useState<BoardDocumentDraft[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  /** Zdjęcia w trakcie kompresji — kafelki „przygotowuję” w tacy. */
  const [pendingImages, setPendingImages] = useState(0);
  const imagesRef = useLatest(images);
  // Liczniki synchroniczne: dwa dodania w jednym renderze (wklejenie w trakcie kompresji) widzą wzajemnie swoje pliki.
  const imageCount = useRef(0);
  const compressingCount = useRef(0);
  const docCount = useRef(0);
  const docBytes = useRef(0);

  // Zamknięcie formularza / karty — zwolnij podglądy (blob URL).
  useEffect(
    () => () => {
      for (const img of imagesRef.current) URL.revokeObjectURL(img.previewUrl);
    },
    [imagesRef]
  );

  const clearImages = useCallback(() => {
    for (const img of imagesRef.current) {
      URL.revokeObjectURL(img.previewUrl);
    }
    setImages([]);
    setDocs([]);
    setIssues([]);
    imageCount.current = 0;
    docCount.current = 0;
    docBytes.current = 0;
  }, [imagesRef]);

  const removeImage = useCallback((key: string) => {
    setImages((prev) => {
      const next: BoardQuestionImageDraft[] = [];
      for (const img of prev) {
        if (img.key === key) URL.revokeObjectURL(img.previewUrl);
        else next.push(img);
      }
      imageCount.current = next.length;
      return next;
    });
  }, []);

  const removeDoc = useCallback((key: string) => {
    setDocs((prev) => {
      const next = prev.filter((d) => d.key !== key);
      docCount.current = next.length;
      docBytes.current = next.reduce((n, d) => n + d.file.size, 0);
      return next;
    });
  }, []);

  const dismissIssues = useCallback(() => setIssues([]), []);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const all = Array.from(incoming);
      if (!all.length) return;
      const found: string[] = [];

      // Dokumenty: bez kompresji, każdy sprawdzony osobno (typ, pusty, rozmiar, limit liczby).

      const acceptedDocs: BoardDocumentDraft[] = [];
      const imageCandidates: File[] = [];
      for (const file of all) {
        if (file.type.toLowerCase().startsWith("image/")) {
          imageCandidates.push(file);
          continue;
        }
        if (!boardDocumentFileType(file.name)) {
          found.push(`„${file.name}”: tego typu nie można dołączyć - zdjęcia, PDF, Excel, Word albo CSV.`);
        } else if (!(file.size > 0)) {
          found.push(`„${file.name}” jest pusty.`);
        } else if (file.size > BOARD_DOCUMENT_MAX_BYTES) {
          found.push(`„${file.name}” ma ponad ${BOARD_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB.`);
        } else if (docCount.current >= BOARD_DOCUMENT_MAX_COUNT) {
          found.push(`„${file.name}” pominięty - najwyżej ${BOARD_DOCUMENT_MAX_COUNT} plików.`);
        } else if (docBytes.current + file.size > BOARD_DOCUMENT_MAX_TOTAL_BYTES) {
          found.push(`„${file.name}” pominięty - pliki razem nie mogą przekraczać ${BOARD_DOCUMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB.`);
        } else {
          docCount.current += 1;
          docBytes.current += file.size;
          acceptedDocs.push({ key: newDraftKey(), file });
        }
      }
      if (acceptedDocs.length) setDocs((prev) => [...prev, ...acceptedDocs]);

      // Zdjęcia: tyle, ile zostało miejsc; reszta z powodem.
      const toCompress: File[] = [];
      for (const file of imageCandidates) {
        if (file.size > COMPRESS_IMAGE_MAX_INPUT_BYTES) {
          found.push(`„${file.name}” ma ponad 20 MB - zrób mniejsze zdjęcie.`);
        } else if (imageCount.current + compressingCount.current + toCompress.length >= BOARD_IMAGE_MAX_COUNT) {
          found.push(`„${file.name}” pominięte - najwyżej ${BOARD_IMAGE_MAX_COUNT} zdjęcia.`);
        } else {
          toCompress.push(file);
        }
      }
      // Dopisujemy (każdy komunikat nazywa plik) — szybkie kolejne dodanie nie kasuje powodów poprzedniego.
      if (found.length) setIssues((prev) => [...prev, ...found.filter((m) => !prev.includes(m))]);
      if (!toCompress.length) return;

      compressingCount.current += toCompress.length;
      setPendingImages((n) => n + toCompress.length);
      const created: BoardQuestionImageDraft[] = [];
      const failed: string[] = [];
      for (const file of toCompress) {
        try {
          const blob = await compressImageFile(file);
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          created.push({ key: newDraftKey(), file: compressed, previewUrl: URL.createObjectURL(compressed) });
        } catch {
          failed.push(`Nie udało się przygotować zdjęcia „${file.name}” - spróbuj innego pliku.`);
        } finally {
          setPendingImages((n) => Math.max(0, n - 1));
        }
      }
      // Miejsce zarezerwowane przed kompresją przechodzi na gotowe zdjęcia w tym samym kroku — bez okna wyścigu.
      compressingCount.current -= toCompress.length;
      imageCount.current += created.length;
      if (failed.length) setIssues((prev) => [...prev, ...failed]);
      if (created.length) setImages((prev) => [...prev, ...created]);
    },
    []
  );

  return {
    images,
    docs,
    issues,
    dismissIssues,
    pendingImages,
    compressing: pendingImages > 0,
    addFiles,
    removeImage,
    removeDoc,
    clearImages,
    imageFiles: images.map((i) => i.file),
    docFiles: docs.map((d) => d.file),
    /** Razem bajtów do wysłania (ostrzeżenie o limicie proxy na produkcji). */
    totalBytes: images.reduce((n, i) => n + i.file.size, 0) + docs.reduce((n, d) => n + d.file.size, 0),
  };
}
