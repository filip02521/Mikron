import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

export const DEPARTMENT_BOARD_INTRO_STORAGE_KEY = "department-board-intro-dismissed-v1";
export const PROSBA_VS_BOARD_HINT_STORAGE_KEY = "prosba-vs-board-hint-dismissed-v1";

export const departmentBoardIntroDismissedStore = createPersistedFlagStore(
  DEPARTMENT_BOARD_INTRO_STORAGE_KEY
);
export const prosbaVsBoardHintDismissedStore = createPersistedFlagStore(
  PROSBA_VS_BOARD_HINT_STORAGE_KEY
);
