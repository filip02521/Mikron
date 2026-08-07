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

/**
 * Dźwięk odpowiedzi na Tablicy: wzrost licznika albo nowsza aktywność
 * (kolejna odpowiedź w tym samym nieprzeczytanym wątku).
 */
export function shouldPlayBoardAnswerNotificationSound(input: {
  previousCount: number | null;
  nextCount: number;
  previousLatestActivityAt: string | null;
  nextLatestActivityAt: string | null;
}): boolean {
  if (shouldPlaySoundOnCountIncrease(input.previousCount, input.nextCount)) {
    return true;
  }
  const prev = input.previousLatestActivityAt;
  const next = input.nextLatestActivityAt;
  if (!prev || !next) return false;
  return next > prev;
}

/** @deprecated Użyj shouldPlaySoundOnCountIncrease */
export const shouldPlayBoardQuestionSound = shouldPlaySoundOnCountIncrease;
