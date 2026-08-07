import { describe, expect, it } from "vitest";
import { isAuthLayoutPath } from "@/lib/auth/auth-layout-paths";
import {
  shouldPlayBoardAnswerNotificationSound,
  shouldPlaySoundOnCountIncrease,
} from "@/lib/client/board-questions-sound";

describe("notification sound gates", () => {
  it("ekrany auth nie powinny odblokowywać / grać toastów", () => {
    expect(isAuthLayoutPath("/login")).toBe(true);
    expect(isAuthLayoutPath("/setup")).toBe(true);
    expect(isAuthLayoutPath("/ustaw-haslo")).toBe(true);
    expect(isAuthLayoutPath("/auth/entering")).toBe(true);
    expect(isAuthLayoutPath("/moje")).toBe(false);
    expect(isAuthLayoutPath("/podsumowanie")).toBe(false);
  });

  it("dźwięk tablicy tylko przy wzroście licznika", () => {
    expect(shouldPlaySoundOnCountIncrease(0, 1)).toBe(true);
    expect(shouldPlaySoundOnCountIncrease(2, 2)).toBe(false);
    expect(shouldPlaySoundOnCountIncrease(3, 2)).toBe(false);
  });

  it("dźwięk odpowiedzi handlowca przy nowszej aktywności nawet gdy licznik stały", () => {
    expect(
      shouldPlayBoardAnswerNotificationSound({
        previousCount: 1,
        nextCount: 1,
        previousLatestActivityAt: "2026-01-01T10:00:00Z",
        nextLatestActivityAt: "2026-01-01T12:00:00Z",
      })
    ).toBe(true);
    expect(
      shouldPlayBoardAnswerNotificationSound({
        previousCount: 1,
        nextCount: 1,
        previousLatestActivityAt: "2026-01-01T12:00:00Z",
        nextLatestActivityAt: "2026-01-01T12:00:00Z",
      })
    ).toBe(false);
    expect(
      shouldPlayBoardAnswerNotificationSound({
        previousCount: 0,
        nextCount: 1,
        previousLatestActivityAt: null,
        nextLatestActivityAt: "2026-01-01T12:00:00Z",
      })
    ).toBe(true);
  });
});
