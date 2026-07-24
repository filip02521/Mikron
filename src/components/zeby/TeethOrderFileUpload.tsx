"use client";

import { useRef, useState } from "react";
import {
  actionUploadTeethOrderFile,
  actionRemoveTeethOrderFile,
  actionGetTeethOrderFileUrl,
} from "@/app/actions/teeth-orders";
import { Spinner } from "@/components/ui/Spinner";
import { IconFilePlus, IconTrash2 } from "@/components/icons/StrokeIcons";

const ACCEPTED_TYPES = ".xml,.xlsx,.xls,.pdf";

export function TeethOrderFileUpload({
  orderId,
  existingFileName,
  onUploaded,
  onRemoved,
}: {
  orderId: string;
  existingFileName?: string | null;
  onUploaded?: (fileName: string) => void;
  onRemoved?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(existingFileName ?? null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Nie udało się wgrać pliku.");
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
      setError(err instanceof Error ? err.message : "Nie udało się usunąć pliku.");
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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={handleDownload}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 disabled:opacity-50"
          title={`Pobierz: ${fileName}`}
        >
          {pending ? <Spinner size="sm" /> : <IconFilePlus size={14} strokeWidth={2} />}
          <span className="max-w-[120px] truncate">{fileName}</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleRemove}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
          title="Usuń plik"
        >
          <IconTrash2 size={14} strokeWidth={2} />
        </button>
        {error ? (
          <span className="text-[10px] text-red-600">{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
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
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
        title="Załącz plik zamówienia (XML, Excel, PDF)"
      >
        {pending ? <Spinner size="sm" /> : <IconFilePlus size={14} strokeWidth={2} />}
        Załącz plik
      </button>
      {error ? (
        <span className="text-[10px] text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
