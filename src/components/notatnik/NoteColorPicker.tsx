"use client";

import type { ReactNode } from "react";
import { IconPin, IconTrash2 } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import type { SalesNoteColor } from "@/types/database";
import { NOTE_COLOR_OPTIONS, NOTE_COLOR_SWATCH } from "./note-styles";

export function NoteColorPicker({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: SalesNoteColor;
  onChange: (color: SalesNoteColor) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center overflow-visible",
        sm ? "gap-1.5 py-0.5 pl-0.5 pr-1" : "gap-2 py-1 pl-0.5 pr-1.5"
      )}
      role="group"
      aria-label="Kolor notatki"
    >
      {NOTE_COLOR_OPTIONS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            disabled={disabled}
            aria-label={color}
            aria-pressed={selected}
            onClick={() => onChange(color)}
            className={cn(
              "rounded-full border-2 transition-all disabled:opacity-50",
              sm ? "h-[1.125rem] w-[1.125rem]" : "h-6 w-6",
              NOTE_COLOR_SWATCH[color],
              selected
                ? "border-slate-700 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
                : "border-white/80 hover:border-slate-400"
            )}
          />
        );
      })}
    </div>
  );
}

function NoteAction({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-black/5 hover:text-slate-900 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function NoteDeleteAction({
  onClick,
  disabled,
  title,
  ariaLabel,
  className,
  iconSize = 15,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  className?: string;
  iconSize?: number;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50",
        className
      )}
    >
      <IconTrash2 size={iconSize} strokeWidth={2.25} aria-hidden />
    </button>
  );
}

export function NoteDeleteIconButton({
  onClick,
  disabled,
  title,
  ariaLabel,
  className,
  iconSize,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  className?: string;
  iconSize?: number;
}) {
  return (
    <NoteDeleteAction
      onClick={onClick}
      disabled={disabled}
      title={title}
      ariaLabel={ariaLabel}
      className={className}
      iconSize={iconSize}
    />
  );
}

export function NoteCardToolbar({
  pinned,
  saving,
  onEdit,
  onTogglePin,
  onArchive,
  hideDelete = false,
}: {
  pinned: boolean;
  saving?: boolean;
  onEdit: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  hideDelete?: boolean;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-0.5">
      <NoteAction onClick={onEdit} disabled={saving}>
        Edytuj
      </NoteAction>
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <NoteAction onClick={onTogglePin} disabled={saving}>
        <span className="inline-flex items-center gap-1">
          <IconPin
            size={12}
            strokeWidth={2.5}
            className={cn(pinned ? "text-indigo-700" : "text-slate-500")}
            aria-hidden
          />
          {pinned ? "Odepnij" : "Przypnij"}
        </span>
      </NoteAction>
      {hideDelete ? null : (
        <>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <NoteDeleteAction
            onClick={onArchive}
            disabled={saving}
            title="Usuń notatkę (trafi do archiwum)"
            ariaLabel="Usuń notatkę"
            className="ml-auto h-7 w-7"
          />
        </>
      )}
    </div>
  );
}
