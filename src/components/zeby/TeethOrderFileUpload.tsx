"use client";

import { useRef, useState } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import {
  actionUploadTeethOrderFile,
  actionRemoveTeethOrderFile,
  actionGetTeethOrderFileUrl,
} from "@/app/actions/teeth-orders";
import { Spinner } from "@/components/ui/Spinner";
import { IconDownload, IconFilePlus, IconTrash2 } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

const ACCEPTED_TYPES = ".xml,.xlsx,.xls,.pdf";

export function TeethOrderFileUpload({
  orderId,
  existingFileName,
  required = false,
  locked = false,
  onUploaded,
  onRemoved,
}: {
  orderId: string;
  existingFileName?: string | null;
  /** Podświetla brak pliku (wymagany przed oznaczeniem). */
  required?: boolean;
  /** Po oznaczeniu jako zamówione — tylko pobieranie, bez zmiany pliku. */
  locked?: boolean;
  onUploaded?: (fileName: string) => void;
  onRemoved?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(existingFileName ?? null);
  const [error, setError] = useState<string | null>(null);
  const [syncedFrom, setSyncedFrom] = useState({ orderId, existingFileName });

  if (orderId !== syncedFrom.orderId || existingFileName !== syncedFrom.existingFileName) {
    setSyncedFrom({ orderId, existingFileName });
    setFileName(existingFileName ?? null);
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const result = await actionUploadTeethOrderFile(orderId, file);
      if (result.success && result.fileName) {
        setFileName(result.fileName);
        onUploaded?.(result.fileName);
      } else {
        setError(result.error ?? "Nie udało się wgrać pliku.");
      }
    } catch (err) {
      setError(userFacingErrorText(err, "Nie udało się wgrać pliku."));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await actionRemoveTeethOrderFile(orderId);
      if (result.success) {
        setFileName(null);
        onRemoved?.();
      } else {
        setError(result.error ?? "Nie udało się usunąć pliku.");
      }
    } catch (err) {
      setError(userFacingErrorText(err, "Nie udało się usunąć pliku."));
    } finally {
      setPending(false);
    }
  };

  const handleDownload = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await actionGetTeethOrderFileUrl(orderId);
      if (result.url) {
        const a = document.createElement("a");
        a.href = result.url;
        a.download = result.fileName ?? fileName ?? "zamowienie";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setError("Nie udało się pobrać pliku.");
      }
    } catch {
      setError("Nie udało się pobrać pliku.");
    } finally {
      setPending(false);
    }
  };

  if (fileName) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={handleDownload}
            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 text-[11px] font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 disabled:opacity-50"
            title={`Pobierz: ${fileName}`}
          >
            {pending ? (
              <Spinner size="sm" />
            ) : (
              <IconDownload size={13} strokeWidth={2} className="shrink-0" />
            )}
            <span className="min-w-0 truncate">{fileName}</span>
          </button>
          {!locked ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleRemove}
              className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
              title="Usuń plik"
            >
              <IconTrash2 size={13} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {error ? <span className="text-[10px] leading-snug text-red-600">{error}</span> : null}
      </div>
    );
  }

  if (locked) {
    return (
      <span className="text-[11px] text-slate-400" title="Plik niedostępny">
        —
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm transition-colors disabled:opacity-50",
          required
            ? "border-amber-300/90 bg-amber-50 text-amber-900 ring-1 ring-amber-200/70 hover:bg-amber-100/80"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
        title="Załącz plik zamówienia (Excel, PDF lub XML) — wymagany przed oznaczeniem"
      >
        {pending ? <Spinner size="sm" /> : <IconFilePlus size={13} strokeWidth={2} />}
        {required ? "Wymagany plik" : "Załącz plik"}
      </button>
      {error ? <span className="text-[10px] leading-snug text-red-600">{error}</span> : null}
    </div>
  );
}
