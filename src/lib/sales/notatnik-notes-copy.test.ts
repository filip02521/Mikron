import { describe, expect, it } from "vitest";
import {
  NOTATNIK_NOTES_PAGE_HINT,
  NOTATNIK_NOTES_SEARCH_PLACEHOLDER,
  NOTATNIK_NOTES_SECTION_COPY,
} from "./notatnik-notes-copy";

describe("notatnik-notes-copy", () => {
  it("placeholder zawiera skrót wyszukiwania", () => {
    expect(NOTATNIK_NOTES_SEARCH_PLACEHOLDER).toContain("skrót /");
  });

  it("sekcja notatek ma podpowiedź do dymka", () => {
    expect(NOTATNIK_NOTES_SECTION_COPY.hint.length).toBeGreaterThan(10);
    expect(NOTATNIK_NOTES_PAGE_HINT).toContain("Archiwum");
  });
});
