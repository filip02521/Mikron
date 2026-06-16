import { describe, expect, it } from "vitest";
import {
  applyNoteTextFormat,
  parseNoteBodyBlocks,
} from "./note-body-format";

describe("parseNoteBodyBlocks", () => {
  it("parsuje akapit i listę punktowaną", () => {
    expect(
      parseNoteBodyBlocks("Wstęp\n- pierwszy\n- drugi\n\nKoniec")
    ).toEqual([
      { type: "paragraph", text: "Wstęp" },
      { type: "ul", items: ["pierwszy", "drugi"] },
      { type: "paragraph", text: "Koniec" },
    ]);
  });

  it("parsuje listę numerowaną", () => {
    expect(parseNoteBodyBlocks("1. krok\n2. krok")).toEqual([
      { type: "ol", items: ["krok", "krok"] },
    ]);
  });
});

describe("applyNoteTextFormat", () => {
  it("dodaje punktor do zaznaczonych linii", () => {
    const result = applyNoteTextFormat("alfa\nbeta", 0, 8, "bullet");
    expect(result.text).toBe("- alfa\n- beta");
  });

  it("owija zaznaczenie w pogrubienie", () => {
    const result = applyNoteTextFormat("tekst ważny koniec", 6, 11, "bold");
    expect(result.text).toBe("tekst **ważny** koniec");
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(13);
  });
});
