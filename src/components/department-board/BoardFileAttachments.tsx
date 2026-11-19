"use client";

import { useState } from "react";
import { actionGetBoardQuestionImageUrl } from "@/app/actions/department-board";
import { IconDownload, IconEye } from "@/components/icons/StrokeIcons";
import { Spinner } from "@/components/ui/Spinner";
import { boardFileTypeLabel, formatBoardFileSize } from "@/lib/department-board/attachments";
import { cn } from "@/lib/cn";
import type { DepartmentBoardThreadAttachment } from "@/types/database";

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
        {attachments.map((att) => {
          const pdf = att.mime_type === "application/pdf";
          return (
            <li key={att.id} className="w-full max-w-[19rem] sm:w-auto">
              <button
                type="button"
                onClick={() => void open(att)}
                disabled={busyId === att.id}
                aria-label={`${pdf ? "Otwórz" : "Pobierz"} ${att.file_name}`}
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center gap-2.5 rounded-md border border-slate-200 bg-card py-2 pl-2.5 pr-3 text-left transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[0.625rem] font-semibold tracking-tight text-slate-700"
                  aria-hidden
                >
                  {boardFileTypeLabel(att.file_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-medium leading-snug text-slate-900">{att.file_name}</span>
                  {att.byte_size ? (
                    <span className="block text-[0.6875rem] tabular-nums text-slate-500">{formatBoardFileSize(att.byte_size)}</span>
                  ) : null}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-700" aria-hidden>
                  {busyId === att.id ? <Spinner size="sm" /> : pdf ? <IconEye size={14} /> : <IconDownload size={14} />}
                  {pdf ? "Otwórz" : "Pobierz"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-1 text-xs text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
