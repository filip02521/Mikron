export type ZkNewLinesSnapshot = Record<string, string[]>;

const storageKey = (salesPersonId: string) => `notatnik-zk-new-lines-${salesPersonId}`;

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadZkNewLinesSnapshot(salesPersonId: string): ZkNewLinesSnapshot {
  const storage = readStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(storageKey(salesPersonId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ZkNewLinesSnapshot = {};
    for (const [watchId, keys] of Object.entries(parsed)) {
      if (!Array.isArray(keys)) continue;
      const lineKeys = keys.filter(
        (key): key is string => typeof key === "string" && key.trim().length > 0
      );
      if (lineKeys.length) out[watchId] = lineKeys;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveZkNewLinesSnapshot(
  salesPersonId: string,
  snapshot: ZkNewLinesSnapshot
): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(salesPersonId), JSON.stringify(snapshot));
  } catch {
    /* ignore quota / private mode */
  }
}

export function setUnseenNewZkLineKeys(
  salesPersonId: string,
  watchId: string,
  lineKeys: string[]
): void {
  if (!lineKeys.length) return;
  const snapshot = loadZkNewLinesSnapshot(salesPersonId);
  snapshot[watchId] = [...new Set(lineKeys)];
  saveZkNewLinesSnapshot(salesPersonId, snapshot);
}

export function clearUnseenNewZkLineKeys(salesPersonId: string, watchId: string): void {
  const snapshot = loadZkNewLinesSnapshot(salesPersonId);
  if (!(watchId in snapshot)) return;
  delete snapshot[watchId];
  saveZkNewLinesSnapshot(salesPersonId, snapshot);
}

export function removeUnseenNewZkLineKeys(
  salesPersonId: string,
  watchId: string,
  lineKeysToRemove: string[]
): void {
  if (!lineKeysToRemove.length) return;
  const snapshot = loadZkNewLinesSnapshot(salesPersonId);
  const existing = snapshot[watchId];
  if (!existing?.length) return;
  const remove = new Set(lineKeysToRemove);
  const next = existing.filter((key) => !remove.has(key));
  if (next.length) snapshot[watchId] = next;
  else delete snapshot[watchId];
  saveZkNewLinesSnapshot(salesPersonId, snapshot);
}

export function hasUnseenNewZkLines(snapshot: ZkNewLinesSnapshot, watchId: string): boolean {
  return (snapshot[watchId]?.length ?? 0) > 0;
}
