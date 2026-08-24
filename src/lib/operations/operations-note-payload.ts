import type { SalesNoteColor } from "@/types/database";

const NOTE_COLORS: readonly SalesNoteColor[] = [
  "default",
  "yellow",
  "green",
  "blue",
  "pink",
];

const FOLLOW_UP_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseOperationsNoteColor(value: unknown): SalesNoteColor {
  if (typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value)) {
    return value as SalesNoteColor;
  }
  throw new Error("Nieprawidłowy kolor notatki.");
}

/** Pusty string / null → brak przypomnienia; inaczej YYYY-MM-DD. */
export function parseOperationsNoteFollowUpAt(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const day = trimmed.slice(0, 10);
  if (!FOLLOW_UP_DATE_RE.test(day)) {
    throw new Error("Nieprawidłowa data przypomnienia.");
  }
  return day;
}

export const OPERATIONS_NOTE_CONFLICT_MESSAGE =
  "Notatka została zmieniona przez kogoś innego — odśwież i spróbuj ponownie.";

export const OPERATIONS_NOTE_ARCHIVED_MUTATE_MESSAGE =
  "Nie można edytować zarchiwizowanej notatki.";
