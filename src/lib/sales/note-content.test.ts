import { describe, expect, it } from "vitest";
import {
  NOTE_TITLE_REQUIRED_MESSAGE,
  normalizeNoteBody,
  normalizeNoteTitle,
  resolveNoteCreateFields,
  resolveNoteUpdateContentFields,
} from "./note-content";

describe("note-content", () => {
  it("normalizeNoteTitle: trim i puste → null", () => {
    expect(normalizeNoteTitle("  Hello  ")).toBe("Hello");
    expect(normalizeNoteTitle("")).toBeNull();
    expect(normalizeNoteTitle("   ")).toBeNull();
    expect(normalizeNoteTitle(null)).toBeNull();
  });

  it("normalizeNoteBody: pozwala na pustą treść", () => {
    expect(normalizeNoteBody("  a\n b  ")).toBe("a\n b");
    expect(normalizeNoteBody("")).toBe("");
    expect(normalizeNoteBody("   \n  ")).toBe("");
    expect(normalizeNoteBody(null)).toBe("");
  });

  it("create: wymaga tytułu, treść opcjonalna", () => {
    expect(resolveNoteCreateFields({ title: "Temat", body: "" })).toEqual({
      title: "Temat",
      body: "",
    });
    expect(
      resolveNoteCreateFields({ title: "  Temat ", body: "  treść  " })
    ).toEqual({ title: "Temat", body: "treść" });
    expect(() => resolveNoteCreateFields({ title: "  ", body: "x" })).toThrow(
      NOTE_TITLE_REQUIRED_MESSAGE
    );
    expect(() => resolveNoteCreateFields({ body: "tylko treść" })).toThrow(
      NOTE_TITLE_REQUIRED_MESSAGE
    );
  });

  it("update: pozwala wyczyścić body przy istniejącym tytule", () => {
    expect(
      resolveNoteUpdateContentFields({
        currentTitle: "Temat",
        body: "   ",
      })
    ).toEqual({ body: "" });
  });

  it("update: blokuje pusty tytuł nawet gdy body ma treść", () => {
    expect(() =>
      resolveNoteUpdateContentFields({
        currentTitle: "Stary",
        title: "  ",
        body: "nadal coś",
      })
    ).toThrow(NOTE_TITLE_REQUIRED_MESSAGE);
  });

  it("update: przy czyszczeniu body wymaga tytułu (brak tytułu w DB)", () => {
    expect(() =>
      resolveNoteUpdateContentFields({
        currentTitle: null,
        body: "",
      })
    ).toThrow(NOTE_TITLE_REQUIRED_MESSAGE);
  });

  it("update: color-only nie waliduje tytułu", () => {
    expect(
      resolveNoteUpdateContentFields({
        currentTitle: null,
      })
    ).toEqual({});
  });

  it("update: ustawienie tytułu przy pustym body legacy", () => {
    expect(
      resolveNoteUpdateContentFields({
        currentTitle: null,
        title: "Nowy",
        body: "",
      })
    ).toEqual({ title: "Nowy", body: "" });
  });

  it("update: zmiana samego tytułu przy pustym body", () => {
    expect(
      resolveNoteUpdateContentFields({
        currentTitle: "Stary",
        title: "Nowy",
      })
    ).toEqual({ title: "Nowy" });
  });

  it("update: body-only przy istniejącym tytule nie dotyka title w patchu", () => {
    expect(
      resolveNoteUpdateContentFields({
        currentTitle: "Temat",
        body: "treść",
      })
    ).toEqual({ body: "treść" });
  });
});
