import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

type PersistedFlagStore = ReturnType<typeof createPersistedFlagStore>;

const stores = new Map<string, PersistedFlagStore>();

/** „Nie pokazuj więcej” przy dymku „Nowość” — jedna flaga w localStorage na nowość. */
export function newFeatureDismissedStore(id: string): PersistedFlagStore {
  let store = stores.get(id);
  if (!store) {
    store = createPersistedFlagStore(`new-feature-dismissed:${id}`);
    stores.set(id, store);
  }
  return store;
}
