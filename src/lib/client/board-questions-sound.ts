import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

const MUTED_STORAGE_KEY = "operations-board-questions-sound-muted";

export const boardQuestionsSoundMutedStore = createPersistedFlagStore(MUTED_STORAGE_KEY);

export function isBoardQuestionsSoundEnabled(muted: boolean): boolean {
  return !muted;
}

/** Odtwórz tylko przy wzroście licznika (nie przy pierwszym odczycie). */
export function shouldPlaySoundOnCountIncrease(
  previousCount: number | null,
  nextCount: number
): boolean {
  if (previousCount == null) return false;
  if (!Number.isFinite(nextCount) || nextCount < 0) return false;
  return nextCount > previousCount;
}

/** @deprecated Użyj shouldPlaySoundOnCountIncrease */
export const shouldPlayBoardQuestionSound = shouldPlaySoundOnCountIncrease;
