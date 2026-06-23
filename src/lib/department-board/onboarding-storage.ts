import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

export const PROSBA_VS_BOARD_HINT_STORAGE_KEY = "prosba-vs-board-hint-dismissed-v1";

export const prosbaVsBoardHintDismissedStore = createPersistedFlagStore(
  PROSBA_VS_BOARD_HINT_STORAGE_KEY
);
