"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMPRESS_IMAGE_MAX_INPUT_BYTES,
  compressImageFile,
} from "@/lib/client/compress-image";
import {
  BOARD_IMAGE_MAX_COUNT,
  validateBoardImageBatch,
} from "@/lib/department-board/attachments";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import type { BoardQuestionImageDraft } from "@/components/department-board/BoardQuestionImagesField";

function newDraftKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useBoardQuestionImages() {
  const [images, setImages] = useState<BoardQuestionImageDraft[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) URL.revokeObjectURL(img.previewUrl);
    };
  }, []);

  const clearImages = useCallback(() => {
    setImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.previewUrl);
      return [];
    });
    setImagesError(null);
  }, []);

  const removeImage = useCallback((key: string) => {
    setImages((prev) => {
      const next: BoardQuestionImageDraft[] = [];
      for (const img of prev) {
        if (img.key === key) URL.revokeObjectURL(img.previewUrl);
        else next.push(img);
      }
      return next;
    });
    setImagesError(null);
  }, []);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (!list.length) return;

    setImagesError(null);
    setCompressing(true);
    try {
      const currentCount = imagesRef.current.length;
      const slots = BOARD_IMAGE_MAX_COUNT - currentCount;
      if (slots <= 0) {
        setImagesError(DEPARTMENT_BOARD_QUESTIONS_FORM.imagesTooMany);
        return;
      }

      const selected = list.slice(0, slots);
      if (list.length > slots) {
        setImagesError(DEPARTMENT_BOARD_QUESTIONS_FORM.imagesTooMany);
      }

      const created: BoardQuestionImageDraft[] = [];
      for (const file of selected) {
        if (!file.type.startsWith("image/")) {
          setImagesError("Dozwolone są tylko pliki graficzne (JPEG, PNG, WebP).");
          continue;
        }
        if (file.size > COMPRESS_IMAGE_MAX_INPUT_BYTES) {
          setImagesError("Plik jest za duży (max 20 MB przed kompresją).");
          continue;
        }
        try {
          const blob = await compressImageFile(file);
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") + ".jpg",
            { type: "image/jpeg", lastModified: Date.now() }
          );
          created.push({
            key: newDraftKey(),
            file: compressed,
            previewUrl: URL.createObjectURL(compressed),
          });
        } catch {
          setImagesError("Nie udało się przetworzyć jednego ze zdjęć.");
        }
      }

      if (!created.length) return;

      const merged = [...imagesRef.current, ...created];
      const batchErr = validateBoardImageBatch(merged.length);
      if (batchErr) {
        for (const img of created) URL.revokeObjectURL(img.previewUrl);
        setImagesError(batchErr);
        return;
      }
      setImages(merged);
    } finally {
      setCompressing(false);
    }
  }, []);

  return {
    images,
    imagesError,
    compressing,
    addFiles,
    removeImage,
    clearImages,
    imageFiles: images.map((i) => i.file),
  };
}
