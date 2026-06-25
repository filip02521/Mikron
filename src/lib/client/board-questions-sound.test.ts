import { describe, expect, it } from "vitest";
import { shouldPlayBoardQuestionSound } from "./board-questions-sound";

describe("shouldPlayBoardQuestionSound", () => {
  it("nie odtwarza przy pierwszym odczycie", () => {
    expect(shouldPlayBoardQuestionSound(null, 2)).toBe(false);
  });

  it("odtwarza gdy liczba pytań rośnie", () => {
    expect(shouldPlayBoardQuestionSound(1, 2)).toBe(true);
    expect(shouldPlayBoardQuestionSound(2, 3)).toBe(true);
  });

  it("nie odtwarza gdy liczba maleje lub się nie zmienia", () => {
    expect(shouldPlayBoardQuestionSound(2, 2)).toBe(false);
    expect(shouldPlayBoardQuestionSound(3, 2)).toBe(false);
    expect(shouldPlayBoardQuestionSound(1, 0)).toBe(false);
  });
});
