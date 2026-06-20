import { describe, expect, it } from "vitest";
import { salesSearchPlaceholder } from "./sales-search-ui";

describe("salesSearchPlaceholder", () => {
  it("dodaje skrót / domyślnie", () => {
    expect(salesSearchPlaceholder("Szukaj po nazwie")).toBe("Szukaj po nazwie — skrót /");
  });

  it("pomija skrót gdy withShortcut=false", () => {
    expect(salesSearchPlaceholder("Nazwa dostawcy", false)).toBe("Nazwa dostawcy");
  });

  it("nie duplikuje skrótu w tekście", () => {
    expect(salesSearchPlaceholder("Szukaj — skrót /")).toBe("Szukaj — skrót /");
  });
});
