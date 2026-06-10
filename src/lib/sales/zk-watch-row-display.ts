/** Jednolinijkowy podgląd notatki ZK na liście. */
export function formatZkWatchNotePreview(
  note: string | null | undefined,
  maxLen = 56
): string | null {
  const trimmed = note?.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}
