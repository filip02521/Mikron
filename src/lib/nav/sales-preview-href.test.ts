import { describe, expect, it } from "vitest";
import { hrefWithAdminSalesPreview } from "./sales-preview-href";

describe("hrefWithAdminSalesPreview", () => {
  it("dodaje ?dla= do prostego linku", () => {
    expect(hrefWithAdminSalesPreview("/tablica", "sp-1", true)).toBe("/tablica?dla=sp-1");
  });

  it("zachowuje istniejące parametry zapytania", () => {
    expect(hrefWithAdminSalesPreview("/tablica?widok=ogloszenia", "sp-1", true)).toBe(
      "/tablica?widok=ogloszenia&dla=sp-1"
    );
  });

  it("zachowuje hash (kotwicę)", () => {
    expect(hrefWithAdminSalesPreview("/notatnik#note-abc", "sp-1", true)).toBe(
      "/notatnik?dla=sp-1#note-abc"
    );
  });

  it("zachowuje parametry i hash jednocześnie", () => {
    expect(
      hrefWithAdminSalesPreview("/notatnik?q=test#note-abc", "sp-1", true)
    ).toBe("/notatnik?q=test&dla=sp-1#note-abc");
  });

  it("nie modyfikuje linków spoza panelu handlowca", () => {
    expect(hrefWithAdminSalesPreview("/admin", "sp-1", true)).toBe("/admin");
  });
});
