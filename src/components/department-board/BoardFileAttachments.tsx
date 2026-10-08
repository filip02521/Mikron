"use client";

import { useState } from "react";
import { actionGetBoardQuestionImageUrl } from "@/app/actions/department-board";
import { IconPaperclip } from "@/components/icons/StrokeIcons";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { DepartmentBoardThreadAttachment } from "@/types/database";

function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/** Pliki w wątku (np. oferta dostawcy w PDF) — link powstaje dopiero przy kliknięciu (podpisany, na godzinę). */
export function BoardFileAttachments({
  attachments,
  className,
}: {
  attachments: DepartmentBoardThreadAttachment[];
  className?: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(att: DepartmentBoardThreadAttachment) {
    setBusyId(att.id);
    setError(null);
    try {
      const { url, error: urlError } = await actionGetBoardQuestionImageUrl(att.id);
      if (!url) {
        setError(urlError ?? "Nie udało się otworzyć pliku.");
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      // PDF w nowej karcie, reszta (Excel, Word) jako plik z prawdziwą nazwą.
      if (att.mime_type === "application/pdf") {
        link.target = "_blank";
        link.rel = "noopener";
      } else {
        link.download = att.file_name || "plik";
      }
      link.click();
    } catch {
      setError("Nie udało się otworzyć pliku.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <li key={att.id}>
            <button
              type="button"
              onClick={() => void open(att)}
              disabled={busyId === att.id}
              className={cn(
                "inline-flex max-w-72 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition-all duration-200 hover:bg-slate-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60"
              )}
              title={att.file_name}
            >
              {busyId === att.id ? <Spinner size="sm" /> : <IconPaperclip size={13} className="shrink-0 text-slate-400" aria-hidden />}
              <span className="truncate font-medium">{att.file_name}</span>
              {att.byte_size ? <span className="shrink-0 tabular-nums text-slate-400">{fileSize(att.byte_size)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-1 text-xs text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
