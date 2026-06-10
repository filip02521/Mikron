"use client";

import { useSyncExternalStore } from "react";
import type { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";

type PersistedFlagStore = ReturnType<typeof createPersistedFlagStore>;

/**
 * Flaga z localStorage bez mismatchu hydratacji — SSR i pierwszy render klienta
 * zawsze false; po mount odczyt z przeglądarki.
 */
export function usePersistedFlag(store: PersistedFlagStore): boolean {
  const stored = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const hydrated = useClientHydrated();
  return hydrated ? stored : false;
}
