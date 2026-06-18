/** Usuwa duplikaty po id — pierwszy wpis wygrywa. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Łączy listy po id — nowszy `updated_at` wygrywa (chroni lokalne zmiany przed race z refresh). */
export function mergeRecordsByUpdatedAt<T extends { id: string; updated_at: string }>(
  local: T[],
  server: T[]
): T[] {
  const byId = new Map(server.map((item) => [item.id, item]));
  for (const item of local) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    const localTs = Date.parse(item.updated_at);
    const serverTs = Date.parse(existing.updated_at);
    if (
      Number.isFinite(localTs) &&
      Number.isFinite(serverTs) &&
      localTs >= serverTs
    ) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}
