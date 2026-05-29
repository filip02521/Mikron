"use client";

import { cn } from "@/lib/cn";
import type { SalesNoteColor } from "@/types/database";
import { NOTE_COLOR_OPTIONS, NOTE_COLOR_SWATCH } from "./note-styles";

export function NoteColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: SalesNoteColor;
  onChange: (color: SalesNoteColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Kolor notatki">
      {NOTE_COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cn(
            "h-6 w-6 rounded-full ring-2 ring-offset-1 transition-transform disabled:opacity-50",
            NOTE_COLOR_SWATCH[color],
            value === color ? "scale-110 ring-slate-400" : "ring-transparent hover:scale-105"
          )}
        />
      ))}
    </div>
  );
}
