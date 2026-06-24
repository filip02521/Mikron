import { describe, expect, it } from "vitest";
import {
  countUnseenOwnBoardAnswers,
  isBoardAnswerUnseen,
  latestQuestionActivityAt,
  pickUnseenAnswerPreview,
} from "@/lib/department-board/attention";

describe("department-board attention", () => {
  it("detects unseen when read is older than latest post", () => {
    expect(isBoardAnswerUnseen("2026-01-01T10:00:00Z", "2026-01-02T10:00:00Z")).toBe(true);
    expect(isBoardAnswerUnseen("2026-01-03T10:00:00Z", "2026-01-02T10:00:00Z")).toBe(false);
    expect(isBoardAnswerUnseen(null, "2026-01-02T10:00:00Z")).toBe(true);
  });

  it("picks latest activity from posts and answered_at", () => {
    expect(
      latestQuestionActivityAt("2026-01-01T10:00:00Z", ["2026-01-03T10:00:00Z"])
    ).toBe("2026-01-03T10:00:00Z");
  });

  it("prefers own question in preview", () => {
    const preview = pickUnseenAnswerPreview([
      {
        threadId: "a",
        title: "Team",
        isOwnQuestion: false,
        latestActivityAt: "2026-01-03T10:00:00Z",
      },
      {
        threadId: "b",
        title: "Mine",
        isOwnQuestion: true,
        latestActivityAt: "2026-01-01T10:00:00Z",
      },
    ]);
    expect(preview?.threadId).toBe("b");
  });

  it("liczy tylko własne pytania z nieprzeczytaną odpowiedzią", () => {
    expect(
      countUnseenOwnBoardAnswers([
        {
          threadId: "a",
          title: "Team",
          isOwnQuestion: false,
          latestActivityAt: "2026-01-03T10:00:00Z",
        },
        {
          threadId: "b",
          title: "Mine",
          isOwnQuestion: true,
          latestActivityAt: "2026-01-01T10:00:00Z",
        },
      ])
    ).toBe(1);
  });
});
