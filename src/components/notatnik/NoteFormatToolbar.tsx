"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/cn";
import { applyNoteTextFormat, type NoteTextFormatAction } from "@/lib/sales/note-body-format";

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
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-100/80 hover:text-slate-700 disabled:opacity-40"
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
  embedded,
  className,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  embedded?: boolean;
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
    <div
      className={cn(
        "flex items-center gap-0.5",
        embedded
          ? "border-t border-slate-100/70 bg-slate-50/40 px-1.5 py-0.5"
          : "border-t border-slate-100/80 pt-1",
        className
      )}
    >
      <FormatButton
        label="•"
        title="Lista punktowana"
        disabled={disabled}
        onClick={() => run("bullet")}
      />
      <FormatButton
        label="1."
        title="Lista numerowana"
        disabled={disabled}
        onClick={() => run("number")}
      />
      <FormatButton
        label="B"
        title="Pogrubienie (Ctrl+B)"
        disabled={disabled}
        onClick={() => run("bold")}
      />
    </div>
  );
}

/** Obramowanie pola tekstowego z wbudowanym paskiem formatowania. */
export const NOTE_COMPOSE_TEXTAREA_SHELL_CLASS = cn(
  "overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm",
  "focus-within:border-indigo-500 focus-within:outline-none focus-within:ring-1 focus-within:ring-sky-500/15"
);

/** Textarea wewnątrz {@link NOTE_COMPOSE_TEXTAREA_SHELL_CLASS} — bez własnej ramki. */
export const NOTE_COMPOSE_TEXTAREA_INNER_CLASS =
  "w-full resize-y border-0 bg-transparent px-2.5 py-1.5 text-sm leading-relaxed text-slate-900 shadow-none focus:outline-none focus:ring-0";
