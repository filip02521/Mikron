import { describe, expect, it } from "vitest";
import {
  SALES_PAGE_HEADER_HINTS,
  SALES_SEARCH_COPY,
  salesHistoriaHeaderHint,
} from "./sales-page-ui-copy";

describe("sales-page-ui-copy", () => {
  it("ma podpowiedzi dla głównych stron handlowca i zakupów", () => {
    expect(SALES_PAGE_HEADER_HINTS.moje.length).toBeGreaterThan(20);
    expect(SALES_PAGE_HEADER_HINTS.dailyPanel).toContain("Kolejka");
    expect(SALES_PAGE_HEADER_HINTS.zk).toContain("Archiwum");
    expect(SALES_PAGE_HEADER_HINTS.verification).toContain("prośby");
    expect(SALES_PAGE_HEADER_HINTS.queue).toContain("przyjęcia");
  });

  it("buduje hint historii z parametrami retencji", () => {
    const hint = salesHistoriaHeaderHint(12, 25);
    expect(hint).toContain("12");
    expect(hint).toContain("25");
    expect(hint).toContain("wyszukiwaniem");
  });

  it("ma copy wyszukiwarek bez wbudowanego skrótu", () => {
    for (const value of Object.values(SALES_SEARCH_COPY)) {
      expect(value).not.toMatch(/skrót\s*\//i);
    }
  });
});
