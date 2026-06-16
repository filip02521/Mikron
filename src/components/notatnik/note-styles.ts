import { cn } from "@/lib/cn";
import type { SalesNoteColor } from "@/types/database";

export const NOTE_COLOR_OPTIONS: SalesNoteColor[] = [
  "default",
  "yellow",
  "green",
  "blue",
  "pink",
];

export const NOTE_COLOR_LABEL: Record<SalesNoteColor, string> = {
  default: "Neutralny",
  yellow: "Żółty",
  green: "Zielony",
  blue: "Niebieski",
  pink: "Różowy",
};

export const NOTE_COLOR_SWATCH: Record<SalesNoteColor, string> = {
  default: "bg-amber-300 ring-amber-200/80",
  yellow: "bg-yellow-300 ring-yellow-200/80",
  green: "bg-emerald-400 ring-emerald-200/80",
  blue: "bg-sky-400 ring-sky-200/80",
  pink: "bg-pink-300 ring-pink-200/80",
};

/** Pastel karteczki — te same tony co {@link NOTE_COLOR_CARD}, delikatny gradient. */
export const NOTE_STICKY_PAPER: Record<SalesNoteColor, string> = {
  default: "from-amber-50 to-amber-100/75 border-amber-200/80",
  yellow: "from-yellow-50 to-yellow-100/70 border-yellow-200/75",
  green: "from-emerald-50 to-emerald-100/65 border-emerald-200/70",
  blue: "from-sky-50 to-sky-100/65 border-sky-200/70",
  pink: "from-pink-50 to-pink-100/60 border-pink-200/70",
};

/** Zachowane dla innych modułów (tablica, operacje). */
export const NOTE_COLOR_CARD: Record<SalesNoteColor, string> = {
  default: "bg-amber-50 border-amber-100",
  yellow: "bg-yellow-50 border-yellow-100",
  green: "bg-emerald-50 border-emerald-100",
  blue: "bg-sky-50 border-sky-100",
  pink: "bg-pink-50 border-pink-100",
};

const STICKY_TILT_VARIANTS = [-2.4, -1.8, -1.2, -0.6, 0.4, 1, 1.6, 2.1, -1.5, 1.9, -0.3, 1.3, -2, 0.8];

/** Deterministyczny kąt przechylenia karteczki (°) — stabilny dla danego id. */
export function noteStickyTiltDeg(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return STICKY_TILT_VARIANTS[Math.abs(hash) % STICKY_TILT_VARIANTS.length]!;
}

export function noteStickyPaperClass(
  color: SalesNoteColor,
  options?: {
    pinned?: boolean;
    followUpDue?: boolean;
    focused?: boolean;
    dragOver?: boolean;
    isDragging?: boolean;
    editing?: boolean;
    archived?: boolean;
    placeholder?: boolean;
  }
): string {
  return cn(
    "relative flex w-full flex-col overflow-visible rounded-md border bg-gradient-to-br",
    "shadow-sm shadow-slate-900/10",
    "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-3 before:rounded-t-md before:bg-gradient-to-b before:from-white/40 before:to-transparent",
    NOTE_STICKY_PAPER[color],
    options?.placeholder &&
      "border-dashed border-indigo-200/80 from-indigo-50/50 to-white/90 shadow-none",
    options?.archived && "opacity-85 saturate-[0.9]",
    options?.pinned && !options?.editing && "shadow-md shadow-slate-900/12",
    options?.followUpDue &&
      !options?.editing &&
      "ring-2 ring-violet-400/40 ring-offset-1 ring-offset-indigo-50/50",
    options?.focused && "shadow-md shadow-indigo-900/10 ring-2 ring-indigo-300/50",
    options?.dragOver && "ring-2 ring-indigo-400/45",
    options?.isDragging && "opacity-80 shadow-lg shadow-slate-900/15",
    options?.editing && "shadow-md shadow-slate-900/12 ring-1 ring-indigo-200/60"
  );
}

/** Separator sekcji wewnątrz tablicy karteczek. */
export const noteStickyBoardDividerClass = "border-t border-indigo-100/80";
