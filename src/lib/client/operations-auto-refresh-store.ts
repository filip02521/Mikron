import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

const STORAGE_KEY = "operations-auto-refresh";

export const operationsAutoRefreshStore = createPersistedFlagStore(STORAGE_KEY);
