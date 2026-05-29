import type { SalesNoteColor } from "@/types/database";

export const NOTE_COLOR_OPTIONS: SalesNoteColor[] = [
  "default",
  "yellow",
  "green",
  "blue",
  "pink",
];

export const NOTE_COLOR_SWATCH: Record<SalesNoteColor, string> = {
  default: "bg-amber-200",
  yellow: "bg-yellow-200",
  green: "bg-emerald-200",
  blue: "bg-sky-200",
  pink: "bg-pink-200",
};

export const NOTE_COLOR_CARD: Record<SalesNoteColor, string> = {
  default: "bg-amber-50 border-amber-100",
  yellow: "bg-yellow-50 border-yellow-100",
  green: "bg-emerald-50 border-emerald-100",
  blue: "bg-sky-50 border-sky-100",
  pink: "bg-pink-50 border-pink-100",
};
