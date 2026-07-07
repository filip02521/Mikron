import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

const STORAGE_KEY = "teeth-auto-refresh";

export const teethAutoRefreshStore = createPersistedFlagStore(STORAGE_KEY);
