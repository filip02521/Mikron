"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/cn";
import { applyNoteTextFormat, type NoteTextFormatAction } from "@/lib/sales/note-body-format";
import { salesTypography } from "@/lib/ui/ontime-theme";

function FormatButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center rounded-md border border-slate-200/90 bg-white px-2 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-900 disabled:opacity-50",
        salesTypography.chrome
      )}
    >
      {label}
    </button>
  );
}

export function NoteFormatToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
  className,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  function run(action: NoteTextFormatAction) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const result = applyNoteTextFormat(value, start, end, action);
    onChange(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className={cn(salesTypography.chrome, "text-slate-500")}>Formatowanie</span>
      <FormatButton
        label="• Lista"
        title="Lista punktowana (- element)"
        disabled={disabled}
        onClick={() => run("bullet")}
      />
      <FormatButton
        label="1. Lista"
        title="Lista numerowana (1. element)"
        disabled={disabled}
        onClick={() => run("number")}
      />
      <FormatButton
        label="B"
        title="Pogrubienie (**tekst**)"
        disabled={disabled}
        onClick={() => run("bold")}
      />
      <span className={cn(salesTypography.chrome, "hidden text-slate-400 sm:inline")}>
        lub wpisz: - punkt, 1. numer, **pogrubienie**
      </span>
    </div>
  );
}
