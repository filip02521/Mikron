"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  IconCamera,
  IconAlertCircle,
  IconCircleCheck,
} from "@/components/icons/StrokeIcons";
import { TEETH_LINE_DEFINITIONS } from "@/lib/teeth/teeth-lines-data";
import type { TeethProductLine, TeethGroupDraft } from "@/lib/teeth/teeth-catalog";
import { cn } from "@/lib/cn";
import { saveTeethOcrProsbaPrefill } from "@/lib/orders/teeth-ocr-prosba-prefill";

export type TeethOcrGroup = TeethGroupDraft & {
  productLine: TeethProductLine;
};

type WizardStep = "idle" | "uploading" | "detecting" | "review" | "reading" | "done" | "error";

type DetectedLine = {
  productLine: TeethProductLine;
  label: string;
  confidence: number;
  selected: boolean;
  note?: string;
};

type LineReadStatus = {
  productLine: TeethProductLine;
  status: "pending" | "reading" | "done" | "error";
  groupCount: number;
  error?: string;
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

const STEP_LABELS = ["Wgraj zdjęcie", "Wykrywanie", "Potwierdzenie", "Odczyt"] as const;

function StepIndicator({ currentStep }: { currentStep: "detecting" | "review" | "reading" | "done" }) {
  const stepIndex = currentStep === "detecting" ? 1 : currentStep === "review" ? 2 : currentStep === "reading" ? 3 : 3;
  return (
    <div className="flex items-center gap-1.5 px-5 py-3 sm:px-6">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              i <= stepIndex
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`text-[11px] font-medium ${
              i <= stepIndex ? "text-slate-700" : "text-slate-400"
            }`}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <span className="mx-0.5 h-px w-4 bg-slate-200" />
          )}
        </div>
      ))}
    </div>
  );
}

export function TeethOcrWizard({
  open,
  onClose,
  onResult,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  onResult?: (groups: TeethOcrGroup[], detectedProductLines: string[], imagePath: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [detectedLines, setDetectedLines] = useState<DetectedLine[]>([]);
  const [lineStatuses, setLineStatuses] = useState<LineReadStatus[]>([]);
  const [resultGroups, setResultGroups] = useState<TeethOcrGroup[]>([]);
  const [resultImagePath, setResultImagePath] = useState<string | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const compressedBlobRef = useRef<Blob | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setDetectedLines([]);
    setLineStatuses([]);
    setResultGroups([]);
    setResultImagePath(null);
    setShowAddLine(false);
    setIsDragging(false);
    compressedBlobRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_CLIENT_FILE_BYTES) {
        setError("Plik jest za duży. Maksymalny rozmiar to 20 MB.");
        return;
      }

      setStep("uploading");
      try {
        const compressed = await compressImage(file);
        compressedBlobRef.current = compressed;
        setStep("detecting");

        const formData = new FormData();
        formData.append("image", compressed, "teeth-order.jpg");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120_000);
        let res: Response;
        try {
          res = await fetch("/api/teeth-vision-detect", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          let errorMsg = "Nie udało się rozpoznać linii na zdjęciu";
          try {
            const errData = await res.json();
            errorMsg = errData.error ?? errorMsg;
          } catch {}
          setError(errorMsg);
          setStep("error");
          return;
        }

        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Nie udało się rozpoznać linii na zdjęciu");
          setStep("error");
          return;
        }

        const lines: DetectedLine[] = (data.lines ?? []).map((l: { productLine: TeethProductLine; label: string; confidence: number; note?: string }) => ({
          productLine: l.productLine,
          label: l.label,
          confidence: l.confidence,
          selected: l.confidence > 0.5,
          note: l.note,
        }));

        setDetectedLines(lines);
        setStep("review");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setError("Przekroczono czas oczekiwania. Spróbuj ponownie.");
        } else {
          setError("Nie udało się przeanalizować zdjęcia. Spróbuj ponownie.");
        }
        setStep("error");
      }
    },
    [],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const toggleLine = useCallback((productLine: TeethProductLine) => {
    setDetectedLines((prev) =>
      prev.map((l) => (l.productLine === productLine ? { ...l, selected: !l.selected } : l)),
    );
  }, []);

  const addLineManually = useCallback((productLine: TeethProductLine) => {
    setDetectedLines((prev) => {
      if (prev.some((l) => l.productLine === productLine)) return prev;
      const def = TEETH_LINE_DEFINITIONS.find((d) => d.id === productLine);
      return [
        ...prev,
        {
          productLine,
          label: def?.label ?? productLine,
          confidence: 1,
          selected: true,
          note: "Dodano ręcznie",
        },
      ];
    });
    setShowAddLine(false);
  }, []);

  const startReading = useCallback(async () => {
    const selectedLines = detectedLines.filter((l) => l.selected);
    if (selectedLines.length === 0) return;

    if (!compressedBlobRef.current) {
      setError("Brak zdjęcia. Wgraj ponownie.");
      setStep("error");
      return;
    }

    setStep("reading");
    const statuses: LineReadStatus[] = selectedLines.map((l) => ({
      productLine: l.productLine,
      status: "reading",
      groupCount: 0,
    }));
    setLineStatuses(statuses);

    const formData = new FormData();
    formData.append("image", compressedBlobRef.current, "teeth-order.jpg");
    formData.append("lines", JSON.stringify(selectedLines.map((l) => l.productLine)));

    try {
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
        let errorMsg = "Nie udało się odczytać pozycji ze zdjęcia";
        try {
          const errData = await res.json();
          errorMsg = errData.error ?? errorMsg;
        } catch {}
        setError(errorMsg);
        setStep("error");
        return;
      }

      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Nie udało się odczytać pozycji ze zdjęcia");
        setStep("error");
        return;
      }

      const groups = data.groups as TeethOcrGroup[];
      const imagePath = (data.imagePath as string | null) ?? null;
      const apiErrors: Array<{ line: string; error: string }> = data.errors ?? [];

      setLineStatuses((prev) =>
        prev.map((s) => {
          const hasGroups = groups.some((g) => g.productLine === s.productLine);
          const apiError = apiErrors.find((e) => e.line === s.productLine);
          if (apiError && !hasGroups) {
            return { ...s, status: "error", groupCount: 0, error: apiError.error };
          }
          if (hasGroups) {
            return {
              ...s,
              status: "done",
              groupCount: groups.filter((g) => g.productLine === s.productLine).length,
            };
          }
          return { ...s, status: "error", groupCount: 0, error: apiError?.error ?? "Brak pozycji" };
        }),
      );

      setResultGroups(groups);
      setResultImagePath(imagePath);
      setStep("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Przekroczono czas oczekiwania na odczyt. Spróbuj ponownie.");
      } else {
        setError("Nie udało się odczytać pozycji. Spróbuj ponownie.");
      }
      setStep("error");
    }
  }, [detectedLines]);

  const handleDone = useCallback(() => {
    if (onResult) {
      onResult(resultGroups, detectedLines.filter((l) => l.selected).map((l) => l.productLine), resultImagePath);
      reset();
      onClose();
    } else {
      saveTeethOcrProsbaPrefill(resultGroups, resultImagePath);
      window.location.href = "/prosba";
    }
  }, [resultGroups, detectedLines, resultImagePath, onResult, reset, onClose]);

  const isBusy = step === "uploading" || step === "detecting" || step === "reading";

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Odczyt zębów ze zdjęcia"
      titleHint="Funkcja testowa — dwufazowe rozpoznawanie: najpierw linie produktów, potem szczegóły per linia."
      size="md"
      tier="overlay"
      disableBackdropClose={isBusy}
      loadingMessage={null}
      footer={
        step === "review" ? (
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Anuluj
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={startReading}
              disabled={detectedLines.filter((l) => l.selected).length === 0}
            >
              Rozpocznij odczyt ({detectedLines.filter((l) => l.selected).length})
            </Button>
          </div>
        ) : step === "done" ? (
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Odrzuć
            </Button>
            <Button variant="primary" size="sm" onClick={handleDone}>
              {onResult ? `Wczytaj do listy (${resultGroups.length} pozycji)` : "Przejdź do prośby →"}
            </Button>
          </div>
        ) : step === "error" ? (
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Zamknij
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                inputRef.current?.click();
              }}
            >
              Spróbuj ponownie
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* Step indicator */}
      {(step === "detecting" || step === "review" || step === "reading" || step === "done") && (
        <StepIndicator currentStep={step as "detecting" | "review" | "reading" | "done"} />
      )}

      <div className="px-5 py-4 sm:px-6">
        {/* Idle / uploading — upload + drag & drop zone */}
        {(step === "idle" || step === "uploading") && (
          <div
            className={cn(
              "flex flex-col items-center gap-4 rounded-xl border-2 border-dashed py-10 transition-colors duration-200",
              isDragging
                ? "border-indigo-400 bg-indigo-50/60"
                : "border-slate-200 bg-slate-50/40",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || step === "uploading"}
                onClick={() => inputRef.current?.click()}
                aria-label="Wgraj zdjęcie kartki zamówienia"
                aria-busy={step === "uploading"}
              >
                {step === "uploading" ? (
                  <Spinner size="sm" className="border-indigo-200 border-t-indigo-600" />
                ) : (
                  <IconCamera size={16} />
                )}
                {step === "uploading" ? "Kompresja zdjęcia…" : "Wybierz zdjęcie"}
              </Button>
              <span className="group relative inline-flex">
                <span
                  className="cursor-help rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 transition-colors group-hover:bg-indigo-100"
                >
                  Beta
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-max max-w-[min(100vw,18rem)] rounded-md border border-indigo-200/90 bg-indigo-50/95 px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-indigo-900 shadow-md group-hover:block group-focus-within:block"
                >
                  To funkcja testowa — sczytywanie listy zębów ze zdjęcia za pomocą AI. Wynik zawsze sprawdź przed zapisaniem.
                </span>
              </span>
            </div>
            <p className="text-center text-xs text-slate-500">
              {isDragging
                ? "Upuść zdjęcie tutaj"
                : "Zrób zdjęcie odręcznie wypełnionej kartki zamówienia zębów lub przeciągnij plik tutaj."}
            </p>
            <p className="text-center text-[11px] text-slate-400">
              System najpierw rozpozna linie produktów, a potem odczyta pozycje.
            </p>
          </div>
        )}

        {/* Detecting */}
        {step === "detecting" && (
          <div className="flex animate-[fadeIn_0.2s_ease-out] flex-col items-center gap-3 py-8">
            <Spinner size="md" />
            <p className="text-sm text-slate-600">Rozpoznaję linie produktów na kartce…</p>
          </div>
        )}

        {/* Review — confirm detected lines */}
        {step === "review" && (
          <div className="animate-[fadeIn_0.2s_ease-out] space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Wykryte linie produktów:
            </h3>
            {detectedLines.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Nie rozpoznano żadnej linii. Dodaj ręcznie lub spróbuj inne zdjęcie.
              </div>
            ) : (
              <div className="space-y-2">
                {detectedLines.map((line) => (
                  <label
                    key={line.productLine}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
                  >
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={() => toggleLine(line.productLine)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{line.label}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            line.confidence > 0.7
                              ? "bg-green-100 text-green-700"
                              : line.confidence > 0.5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {Math.round(line.confidence * 100)}%
                        </span>
                      </div>
                      {line.note && (
                        <p className="mt-0.5 text-[11px] text-slate-500">{line.note}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Add line manually */}
            <div className="pt-1">
              {!showAddLine ? (
                <button
                  type="button"
                  onClick={() => setShowAddLine(true)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  + Dodaj linię ręcznie
                </button>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                    onChange={(e) => {
                      if (e.target.value) addLineManually(e.target.value as TeethProductLine);
                      e.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Wybierz linię…
                    </option>
                    {TEETH_LINE_DEFINITIONS.map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddLine(false)}
                    className="mt-1 text-[11px] text-slate-500 hover:text-slate-700"
                  >
                    Anuluj
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reading — per-line progress */}
        {step === "reading" && (
          <div className="animate-[fadeIn_0.2s_ease-out] space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Odczytuję pozycje per linia…
            </h3>
            <div className="space-y-2">
              {lineStatuses.map((ls) => {
                const lineDef = detectedLines.find((l) => l.productLine === ls.productLine);
                return (
                  <div
                    key={ls.productLine}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                  >
                    {ls.status === "reading" && (
                      <Spinner size="sm" className="border-slate-200 border-t-indigo-600" />
                    )}
                    {ls.status === "done" && (
                      <IconCircleCheck size={16} className="text-green-600" />
                    )}
                    {ls.status === "error" && (
                      <IconAlertCircle size={16} className="text-red-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800">
                        {lineDef?.label ?? ls.productLine}
                      </span>
                      {ls.status === "reading" && (
                        <span className="ml-2 text-xs text-slate-500">Odczytuję…</span>
                      )}
                      {ls.status === "done" && (
                        <span className="ml-2 text-xs text-green-600">
                          ✓ {ls.groupCount} {ls.groupCount === 1 ? "pozycja" : "pozycji"}
                        </span>
                      )}
                      {ls.status === "error" && (
                        <span className="ml-2 text-xs text-red-500">
                          ✗ {ls.error ?? "Nie odczytano"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Done — summary */}
        {step === "done" && (
          <div className="animate-[fadeIn_0.2s_ease-out] space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <IconCircleCheck size={18} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">
                  Rozpoznano {resultGroups.length} pozycji w{" "}
                  {detectedLines.filter((l) => l.selected).length} liniach
                </span>
              </div>
              {!onResult && (
                <p className="mt-1.5 text-xs text-green-700">
                  Kliknij &ldquo;Przejdź do prośby&rdquo;, aby wczytać pozycje do formularza prośby. Możesz je tam edytować przed wysłaniem.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              {lineStatuses.map((ls) => {
                const lineDef = detectedLines.find((l) => l.productLine === ls.productLine);
                return (
                  <div
                    key={ls.productLine}
                    className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700">
                      {lineDef?.label ?? ls.productLine}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        ls.status === "done"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {ls.status === "done"
                        ? `${ls.groupCount} pozycji`
                        : "błąd odczytu"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="flex animate-[fadeIn_0.2s_ease-out] flex-col items-center gap-3 py-8">
            <IconAlertCircle size={32} className="text-amber-500" />
            <p className="text-center text-sm text-slate-600 max-w-xs">{error}</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </ModalShell>
  );
}
