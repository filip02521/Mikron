/** Inicjały do awatara: „Anna Kowalska” → AK, „anna.kowalska@…” → AK, „Anna” → AN. */
export function initialsFromLabel(label: string): string {
  const raw = label.trim();
  if (!raw) return "?";
  const source = raw.includes("@") ? (raw.split("@")[0] ?? "") : raw;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
