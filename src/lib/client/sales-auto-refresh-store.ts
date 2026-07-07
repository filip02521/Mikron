import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

const STORAGE_KEY = "sales-auto-refresh";

export const salesAutoRefreshStore = createPersistedFlagStore(STORAGE_KEY);
