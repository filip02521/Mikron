import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

const MUTED_STORAGE_KEY = "sales-board-answer-sound-muted";

export const salesBoardAnswerSoundMutedStore = createPersistedFlagStore(MUTED_STORAGE_KEY);

export function isSalesBoardAnswerSoundEnabled(muted: boolean): boolean {
  return !muted;
}
