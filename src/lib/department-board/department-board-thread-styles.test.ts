import { describe, expect, it } from "vitest";
import { boardQuestionAuthorNameClass, boardQuestionRowClass } from "./department-board-thread-styles";

describe("boardQuestionRowClass", () => {
  it("stosuje jaśniejsze tło na co drugim zwiniętym wierszu bez statusu", () => {
    const even = boardQuestionRowClass({ unseen: false, open: false, expanded: false, alternate: false });
    const odd = boardQuestionRowClass({ unseen: false, open: false, expanded: false, alternate: true });
    expect(even).toContain("bg-white");
    expect(odd).toContain("bg-slate-100/45");
  });

  it("ignoruje zebra po rozwinięciu", () => {
    const row = boardQuestionRowClass({
      unseen: false,
      open: false,
      expanded: true,
      alternate: true,
    });
    expect(row).toContain("bg-white");
    expect(row).not.toContain("bg-slate-100");
  });

  it("dodaje lewy akcent kolorystyczny na zwiniętym wierszu", () => {
    const row = boardQuestionRowClass({ unseen: false, open: false, expanded: false });
    expect(row).toContain("border-l-2");
    expect(row).toContain("border-l-indigo-300");
  });
});

describe("boardQuestionAuthorNameClass", () => {
  it("używa zwykłego koloru bez badge", () => {
    expect(boardQuestionAuthorNameClass).toContain("text-indigo-700");
    expect(boardQuestionAuthorNameClass).not.toContain("rounded");
    expect(boardQuestionAuthorNameClass).not.toContain("ring");
  });
});
