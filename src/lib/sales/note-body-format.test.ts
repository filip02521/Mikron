import { describe, expect, it, vi } from "vitest";
import {
  applyNoteTextFormat,
  handleNoteFormatKeyDown,
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

  it("na pustej notatce zaczyna listę punktowaną", () => {
    const result = applyNoteTextFormat("", 0, 0, "bullet");
    expect(result.text).toBe("- ");
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(2);
  });

  it("na pustej notatce zaczyna listę numerowaną", () => {
    const result = applyNoteTextFormat("", 0, 0, "number");
    expect(result.text).toBe("1. ");
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });

  it("na pustej linii wstawia prefiks listy", () => {
    const result = applyNoteTextFormat("wiersz\n\nkolejny", 7, 7, "bullet");
    expect(result.text).toBe("wiersz\n- \nkolejny");
    expect(result.selectionStart).toBe(9);
    expect(result.selectionEnd).toBe(9);
  });

  it("bez zaznaczenia dodaje prefiks na początku bieżącej linii", () => {
    const result = applyNoteTextFormat("treść", 5, 5, "bullet");
    expect(result.text).toBe("- treść");
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(7);
  });

  it("bez zaznaczenia zachowuje pozycję kursora w linii", () => {
    const result = applyNoteTextFormat("treść", 2, 2, "bullet");
    expect(result.text).toBe("- treść");
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it("bez zaznaczenia wstawia znaczniki pogrubienia", () => {
    const result = applyNoteTextFormat("abc", 1, 1, "bold");
    expect(result.text).toBe("a****bc");
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });

  it("konwertuje punktor na numerację w zaznaczeniu", () => {
    const result = applyNoteTextFormat("- jeden\n- dwa", 0, 12, "number");
    expect(result.text).toBe("1. jeden\n2. dwa");
  });
});

describe("handleNoteFormatKeyDown", () => {
  it("obsługuje Ctrl+B i aktualizuje tekst", () => {
    const onChange = vi.fn();
    const handled = handleNoteFormatKeyDown(
      {
        key: "b",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        preventDefault: vi.fn(),
      },
      "abc",
      1,
      1,
      onChange
    );

    expect(handled).toBe(true);
    expect(onChange).toHaveBeenCalledWith("a****bc", 3, 3);
  });

  it("ignoruje skrót ze Shift", () => {
    const onChange = vi.fn();
    const handled = handleNoteFormatKeyDown(
      {
        key: "b",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        preventDefault: vi.fn(),
      },
      "abc",
      1,
      1,
      onChange
    );

    expect(handled).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
