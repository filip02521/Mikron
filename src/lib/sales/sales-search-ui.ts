/** Placeholder wyszukiwarki z opcjonalnym skrótem /. */
export function salesSearchPlaceholder(base: string, withShortcut = true): string {
  const trimmed = base.trim().replace(/\s*—\s*skrót\s*\/\s*$/i, "");
  return withShortcut ? `${trimmed} — skrót /` : trimmed;
}
