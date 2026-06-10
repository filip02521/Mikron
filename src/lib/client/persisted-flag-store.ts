/** localStorage boolean flag — SSR-safe via useSyncExternalStore snapshots. */
export function createPersistedFlagStore(storageKey: string) {
  const listeners = new Set<() => void>();

  function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) onStoreChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  function getSnapshot(): boolean {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }

  function getServerSnapshot(): boolean {
    return false;
  }

  function setValue(value: boolean) {
    try {
      localStorage.setItem(storageKey, value ? "1" : "0");
    } catch {
      /* ignore */
    }
    listeners.forEach((listener) => listener());
  }

  return { subscribe, getSnapshot, getServerSnapshot, setValue };
}
