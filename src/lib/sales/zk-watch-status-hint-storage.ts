import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

export const ZK_WATCH_STATUS_HINT_STORAGE_KEY = "zk-watch-status-hint-dismissed-v2";

export const zkWatchStatusHintDismissedStore = createPersistedFlagStore(
  ZK_WATCH_STATUS_HINT_STORAGE_KEY
);
