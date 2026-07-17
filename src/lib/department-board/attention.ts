import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";
import { calculateBusinessDays } from "@/lib/orders/dates";

export function isBoardAnswerUnseen(
  readAt: string | null | undefined,
  latestActivityAt: string | null | undefined
): boolean {
  if (!latestActivityAt) return false;
  if (!readAt) return true;
  return readAt < latestActivityAt;
}

export function latestQuestionActivityAt(
  answeredAt: string | null | undefined,
  postTimes: string[]
): string | null {
  const candidates = [...postTimes];
  if (answeredAt) candidates.push(answeredAt);
  if (!candidates.length) return null;
  return candidates.reduce((max, t) => (t > max ? t : max));
}

/** Czy odpowiedź na pytanie jest starsza niż 1 dzień roboczy (mniej zauważalna na liście). */
export function isStaleAnsweredQuestion(
  question: { status: string; answered_at: string | null; posts: { created_at: string }[] }
): boolean {
  if (question.status !== "answered") return false;
  const latest = latestQuestionActivityAt(question.answered_at, question.posts.map((p) => p.created_at));
  if (!latest) return false;
  return calculateBusinessDays(new Date(latest), new Date()) >= 1;
}

export type UnseenBoardAnswer = {
  threadId: string;
  title: string;
  isOwnQuestion: boolean;
  latestActivityAt: string;
};

export function countUnseenOwnBoardAnswers(items: readonly UnseenBoardAnswer[]): number {
  return items.filter((item) => item.isOwnQuestion).length;
}

export function pickUnseenAnswerPreview(
  items: UnseenBoardAnswer[]
): UnseenBoardAnswer | null {
  if (!items.length) return null;
  const own = items.find((i) => i.isOwnQuestion);
  return own ?? items[0] ?? null;
}

export function mergePinnedAnnouncements(
  announcements: DepartmentBoardThreadRow[]
): DepartmentBoardThreadRow[] {
  return announcements.filter((a) => a.pinned);
}
