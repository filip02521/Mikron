"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconCamera, IconAlertCircle } from "@/components/icons/StrokeIcons";
import type { TeethProductLine, TeethGroupDraft } from "@/lib/teeth/teeth-catalog";

export type TeethOcrGroup = TeethGroupDraft & {
  productLine: TeethProductLine;
};

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const MAX_CLIENT_FILE_BYTES = 20 * 1024 * 1024;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nie udało się przetworzyć obrazu");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Nie udało się skompresować obrazu"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  return blob;
}

export function TeethVisionUpload({
  productLine,
  onResult,
  disabled,
  shouldReplaceExistingList,
}: {
  productLine?: TeethProductLine;
  onResult: (groups: TeethOcrGroup[], detectedProductLines: string[], imagePath: string | null) => void;
  disabled?: boolean;
  /** Zwraca true jeśli lista jest pusta lub użytkownik potwierdził zastąpienie. Brak = zawsze zastąp. */
  shouldReplaceExistingList?: () => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_CLIENT_FILE_BYTES) {
        setError("Plik jest za duży. Maksymalny rozmiar to 20 MB.");
        return;
      }
      setLoading(true);
      try {
        if (shouldReplaceExistingList && !shouldReplaceExistingList()) {
          return;
        }
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append("image", compressed, "teeth-order.jpg");
        if (productLine) formData.append("productLine", productLine);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 270_000);
        let res: Response;
        try {
          res = await fetch("/api/teeth-vision-ocr", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          let errorMsg = "Nie udało się przeanalizować zdjęcia";
          try {
            const errData = await res.json();
            errorMsg = errData.error ?? errorMsg;
          } catch {
            // response not JSON
          }
          setError(errorMsg);
          return;
        }

        const data = await res.json();

        if (!data.ok) {
          setError(data.error ?? "Nie udało się przeanalizować zdjęcia");
          return;
        }

        const groups = data.groups as TeethOcrGroup[];
        const detectedProductLines = data.detectedProductLines ?? [];
        const imagePath = (data.imagePath as string | null) ?? null;

        if (groups.length === 0) {
          setError("Nie odczytano żadnych pozycji ze zdjęcia. Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie.");
          return;
        }

        onResult(groups, detectedProductLines, imagePath);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setError("Przekroczono czas oczekiwania na analizę zdjęcia. Spróbuj ponownie.");
        } else {
          setError("Nie udało się przeanalizować zdjęcia. Spróbuj ponownie lub wpisz pozycje ręcznie.");
        }
      } finally {
        setLoading(false);
      }
    },
    [productLine, onResult, shouldReplaceExistingList],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          aria-label="Wczytaj listę zębów ze zdjęcia kartki (BETA)"
          aria-busy={loading}
        >
          {loading ? (
            <Spinner size="sm" className="border-indigo-200 border-t-indigo-600" />
          ) : (
            <IconCamera size={16} />
          )}
          {loading ? "Analizuję zdjęcie…" : "Ze zdjęcia"}
        </Button>
        <span className="group relative inline-flex">
          <span
            className="cursor-help rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 transition-colors group-hover:bg-indigo-100"
            aria-label="Funkcja testowa — sczytywanie zębów ze zdjęcia za pomocą AI"
          >
            Beta
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-max max-w-[min(100vw,18rem)] rounded-md border border-indigo-200/90 bg-indigo-50/95 px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-indigo-900 shadow-md group-hover:block group-focus-within:block"
          >
            To funkcja testowa — sczytywanie listy zębów ze zdjęcia za pomocą AI. Może jeszcze nie działać prawidłowo we wszystkich przypadkach. Wynik zawsze sprawdź przed zapisaniem.
          </span>
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {error ? (
        <span
          className="absolute bottom-full left-0 z-10 mb-1 inline-flex w-max max-w-[min(100vw,22rem)] items-start gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/95 px-2 py-1 text-[11px] font-medium text-amber-800 shadow-sm"
          role="alert"
        >
          <IconAlertCircle size={12} className="mt-px shrink-0" />
          <span>{error}</span>
        </span>
      ) : null}
    </div>
  );
}
