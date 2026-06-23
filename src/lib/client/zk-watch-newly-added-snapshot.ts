export type ZkNewlyAddedSnapshot = string[];

const storageKey = (salesPersonId: string) => `notatnik-zk-newly-added-${salesPersonId}`;

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadZkNewlyAddedSnapshot(salesPersonId: string): ZkNewlyAddedSnapshot {
  const storage = readStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(salesPersonId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  } catch {
    return [];
  }
}

export function saveZkNewlyAddedSnapshot(
  salesPersonId: string,
  snapshot: ZkNewlyAddedSnapshot
): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    if (!snapshot.length) {
      storage.removeItem(storageKey(salesPersonId));
      return;
    }
    storage.setItem(storageKey(salesPersonId), JSON.stringify(snapshot));
  } catch {
    /* ignore quota / private mode */
  }
}

export function markZkWatchNewlyAdded(salesPersonId: string, watchId: string): void {
  const snapshot = loadZkNewlyAddedSnapshot(salesPersonId);
  if (snapshot.includes(watchId)) return;
  saveZkNewlyAddedSnapshot(salesPersonId, [watchId, ...snapshot]);
}

export function clearNewlyAddedZkWatch(salesPersonId: string, watchId: string): void {
  const snapshot = loadZkNewlyAddedSnapshot(salesPersonId);
  if (!snapshot.includes(watchId)) return;
  saveZkNewlyAddedSnapshot(
    salesPersonId,
    snapshot.filter((id) => id !== watchId)
  );
}

export function reconcileZkNewlyAddedSnapshot(
  snapshot: ZkNewlyAddedSnapshot,
  validWatchIds: ReadonlySet<string>
): ZkNewlyAddedSnapshot {
  return snapshot.filter((id) => validWatchIds.has(id));
}

export function isZkWatchNewlyAdded(snapshot: ZkNewlyAddedSnapshot, watchId: string): boolean {
  return snapshot.includes(watchId);
}
