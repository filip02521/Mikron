import { describe, expect, it } from "vitest";
import { shouldShowBoardAnswersBanner } from "./board-attention-banners";

describe("board-attention-banners", () => {
  const attention = {
    unseenAnswerCount: 1,
    unseenAnswerPreview: null,
  };

  it("pokazuje banner nowych odpowiedzi gdy są nieodczytane", () => {
    expect(shouldShowBoardAnswersBanner(attention)).toBe(true);
    expect(shouldShowBoardAnswersBanner({ ...attention, unseenAnswerCount: 0 })).toBe(false);
  });
});
