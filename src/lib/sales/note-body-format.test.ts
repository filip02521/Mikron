/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyNoteTextFormat,
  handleNoteFormatKeyDown,
  parseNoteBodyBlocks,
  markdownToHtml,
  htmlToMarkdown,
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

  it("bez zaznaczenia wstawia znaczniki kursywy", () => {
    const result = applyNoteTextFormat("abc", 1, 1, "italic");
    expect(result.text).toBe("a**bc");
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(2);
  });

  it("owija zaznaczenie w kursywę", () => {
    const result = applyNoteTextFormat("tekst ważny koniec", 6, 11, "italic");
    expect(result.text).toBe("tekst *ważny* koniec");
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(12);
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

  it("obsługuje Ctrl+I i aktualizuje tekst", () => {
    const onChange = vi.fn();
    const handled = handleNoteFormatKeyDown(
      {
        key: "i",
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
    expect(onChange).toHaveBeenCalledWith("a**bc", 2, 2);
  });
});

describe("markdownToHtml", () => {
  it("konwertuje prosty akapit", () => {
    expect(markdownToHtml("Hello world")).toBe("<p>Hello world</p>");
  });

  it("konwertuje pogrubienie", () => {
    expect(markdownToHtml("**bold text**")).toBe("<p><strong>bold text</strong></p>");
  });

  it("konwertuje kursywę", () => {
    expect(markdownToHtml("*italic text*")).toBe("<p><em>italic text</em></p>");
  });

  it("konwertuje listę punktowną", () => {
    expect(markdownToHtml("- item 1\n- item 2")).toBe("<ul><li>item 1</li><li>item 2</li></ul>");
  });

  it("konwertuje listę numerowaną", () => {
    expect(markdownToHtml("1. first\n2. second")).toBe("<ol><li>first</li><li>second</li></ol>");
  });

  it("konwertuje wiele akapitów", () => {
    expect(markdownToHtml("First\n\nSecond")).toBe("<p>First</p><p>Second</p>");
  });

  it("escapes HTML w treści", () => {
    expect(markdownToHtml("a < b & c > d")).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });
});

describe("htmlToMarkdown", () => {
  it("konwertuje prosty akapit z powrotem", () => {
    expect(htmlToMarkdown("<p>Hello world</p>")).toBe("Hello world");
  });

  it("konwertuje pogrubienie z powrotem", () => {
    expect(htmlToMarkdown("<p><strong>bold text</strong></p>")).toBe("**bold text**");
  });

  it("konwertuje <b> jako pogrubienie", () => {
    expect(htmlToMarkdown("<p><b>bold text</b></p>")).toBe("**bold text**");
  });

  it("konwertuje kursywę z powrotem", () => {
    expect(htmlToMarkdown("<p><em>italic text</em></p>")).toBe("*italic text*");
  });

  it("konwertuje listę punktowną z powrotem", () => {
    expect(htmlToMarkdown("<ul><li>item 1</li><li>item 2</li></ul>")).toBe("- item 1\n- item 2");
  });

  it("konwertuje listę numerowaną z powrotem", () => {
    expect(htmlToMarkdown("<ol><li>first</li><li>second</li></ol>")).toBe("1. first\n2. second");
  });

  it("konwertuje <br> na nową linię", () => {
    expect(htmlToMarkdown("<p>line1<br>line2</p>")).toBe("line1\nline2");
  });

  it("normalizuje wielokrotne nowe linie", () => {
    expect(htmlToMarkdown("<p>a</p><p>b</p>")).toBe("a\n\nb");
  });
});

describe("round-trip: markdown → html → markdown", () => {
  it("prosty tekst", () => {
    const md = "Hello world";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it("pogrubienie", () => {
    const md = "**bold text**";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it("kursywa", () => {
    const md = "*italic text*";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it("lista punktowna", () => {
    const md = "- item 1\n- item 2";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it("lista numerowana", () => {
    const md = "1. first\n2. second";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });
});
