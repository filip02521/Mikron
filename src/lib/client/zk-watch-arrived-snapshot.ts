const storageKey = (salesPersonId: string) => `notatnik-zk-arrived-${salesPersonId}`;

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadZkArrivedSnapshot(salesPersonId: string): Record<string, number> {
  const storage = readStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(storageKey(salesPersonId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [id, count] of Object.entries(parsed)) {
      if (typeof count === "number" && Number.isFinite(count)) out[id] = count;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveZkArrivedSnapshot(
  salesPersonId: string,
  snapshot: Record<string, number>
): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(salesPersonId), JSON.stringify(snapshot));
  } catch {
    /* ignore quota / private mode */
  }
}
