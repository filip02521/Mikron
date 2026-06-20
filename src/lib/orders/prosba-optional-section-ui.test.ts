import { describe, expect, it } from "vitest";
import {
  PROSBA_OPTIONAL_SECTION_COPY,
  PROSBA_PAGE_HEADER_HINTS,
} from "./prosba-optional-section-copy";
import { prosbaOptionalSectionMeta } from "./prosba-optional-section-ui";

describe("prosbaOptionalSectionMeta", () => {
  it("przypisuje ikonę i kafelek każdemu rodzajowi sekcji", () => {
    const kinds = ["line-note", "request-note", "client", "readiness", "keyboard"] as const;
    for (const kind of kinds) {
      const meta = prosbaOptionalSectionMeta(kind);
      expect(meta.Icon).toBeTruthy();
      expect(meta.tileClassName.length).toBeGreaterThan(0);
    }
  });
});

describe("PROSBA_OPTIONAL_SECTION_COPY", () => {
  it("sekcje z opisem mają krótki tekst pod tytułem", () => {
    expect(PROSBA_OPTIONAL_SECTION_COPY.lineNote.description).toContain("Kontekst");
    expect(PROSBA_OPTIONAL_SECTION_COPY.keyboard.description).toContain("Subiekta");
    expect(PROSBA_OPTIONAL_SECTION_COPY.readiness.title).toContain("uzupełnienia");
    expect("description" in PROSBA_OPTIONAL_SECTION_COPY.readiness).toBe(false);
  });
});

describe("PROSBA_PAGE_HEADER_HINTS", () => {
  it("zawiera podpowiedzi nagłówków formularza", () => {
    expect(PROSBA_PAGE_HEADER_HINTS.newRequest).toContain("Moje zamówienia");
    expect(PROSBA_PAGE_HEADER_HINTS.editSales).toContain("poprawić");
  });
});
