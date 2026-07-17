import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

const STORAGE_KEY = "uniform-background";

/** Flaga: true → jednolite tło (bez okręgów), false → tarcze widoczne. */
export const uniformBackgroundStore = createPersistedFlagStore(STORAGE_KEY);
