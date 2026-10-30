import { describe, expect, it } from "vitest";
import { summaryColorCss } from "./colors";
import { SUMMARY_COLORS } from "@/types/database";

describe("summaryColorCss", () => {
  it("kolory wierszy idą przez zmienną motywu z jasnym hexem jako zapasem", () => {
    expect(summaryColorCss(SUMMARY_COLORS.today)).toBe("var(--summary-today, #eff6ff)");
    expect(summaryColorCss(SUMMARY_COLORS.thisWeek)).toBe("var(--summary-this-week, #e3f2fd)");
  });
  it("wartość spoza mapy (zmienna CSS, inny kolor) przechodzi bez zmian", () => {
    expect(summaryColorCss("var(--card)")).toBe("var(--card)");
    expect(summaryColorCss("#123456")).toBe("#123456");
  });
});
