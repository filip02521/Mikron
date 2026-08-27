/**
 * Walidacja treści karteczek notatnika (sales / operations).
 * Zasada: tytuł obowiązkowy, treść może być pusta.
 */

export const NOTE_TITLE_REQUIRED_MESSAGE = "Podaj tytuł notatki.";

/** Normalizuje tytuł — pusty / same spacje → null. */
export function normalizeNoteTitle(
  title: string | null | undefined
): string | null {
  const t = String(title ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * Normalizuje treść do zapisu.
 * Pusta / whitespace-only → "" (dozwolone przy obecnym tytule).
 */
export function normalizeNoteBody(body: string | null | undefined): string {
  return String(body ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function resolveNoteCreateFields(input: {
  body: string;
  title?: string | null;
}): { title: string; body: string } {
  const title = normalizeNoteTitle(input.title);
  if (!title) {
    throw new Error(NOTE_TITLE_REQUIRED_MESSAGE);
  }
  return {
    title,
    body: normalizeNoteBody(input.body),
  };
}

/**
 * Patch treści przy update.
 * Przy zmianie title/body wynikowy tytuł musi być niepusty; body może być "".
 * Gdy nie ruszamy title/body (np. tylko color) — zwraca pusty obiekt pól treści.
 */
export function resolveNoteUpdateContentFields(input: {
  currentTitle: string | null | undefined;
  title?: string | null;
  body?: string;
}): { title?: string | null; body?: string } {
  const touchesTitle = input.title !== undefined;
  const touchesBody = input.body !== undefined;
  if (!touchesTitle && !touchesBody) return {};

  const nextTitle = touchesTitle
    ? normalizeNoteTitle(input.title)
    : normalizeNoteTitle(input.currentTitle);

  if (!nextTitle) {
    throw new Error(NOTE_TITLE_REQUIRED_MESSAGE);
  }

  const patch: { title?: string | null; body?: string } = {};
  if (touchesTitle) patch.title = nextTitle;
  if (touchesBody) patch.body = normalizeNoteBody(input.body);
  return patch;
}
