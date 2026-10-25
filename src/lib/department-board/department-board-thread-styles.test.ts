import { describe, expect, it } from "vitest";
import { boardQuestionAuthorNameClass, boardQuestionRowClass } from "./department-board-thread-styles";

describe("boardQuestionRowClass", () => {
  it("stosuje jaśniejsze tło na co drugim zwiniętym wierszu bez statusu", () => {
    const even = boardQuestionRowClass({ unseen: false, open: false, expanded: false, alternate: false });
    const odd = boardQuestionRowClass({ unseen: false, open: false, expanded: false, alternate: true });
    expect(even).toContain("bg-white");
    expect(odd).toContain("bg-slate-50/60");
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

  it("nie stawia paska z boku wiersza (DESIGN.md → Shapes)", () => {
    for (const opts of [
      { unseen: false, open: false, expanded: false },
      { unseen: true, open: false, expanded: false },
      { unseen: false, open: true, expanded: false },
      { unseen: false, open: false, expanded: true },
    ]) {
      expect(boardQuestionRowClass(opts)).not.toContain("border-l");
    }
  });

  it("rozwinięty wątek bez cienia w karcie", () => {
    expect(boardQuestionRowClass({ unseen: false, open: false, expanded: true })).not.toContain("shadow");
  });
});

describe("boardQuestionRowClass — czeka na dostawcę", () => {
  it("otwarte pytanie z zapytaniem u dostawcy nie świeci bursztynem", () => {
    const row = boardQuestionRowClass({ unseen: false, open: true, expanded: false, waiting: "supplier" });
    expect(row).not.toContain("amber");
  });

  it("dostawca milczy za długo — wraca bursztyn", () => {
    const row = boardQuestionRowClass({ unseen: false, open: false, expanded: false, waiting: "supplier-overdue" });
    expect(row).toContain("amber");
  });
});

describe("boardQuestionAuthorNameClass", () => {
  it("używa zwykłego koloru bez badge", () => {
    expect(boardQuestionAuthorNameClass).toContain("text-slate-800");
    expect(boardQuestionAuthorNameClass).not.toContain("rounded");
    expect(boardQuestionAuthorNameClass).not.toContain("ring");
  });
});
