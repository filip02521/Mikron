import { describe, expect, it } from "vitest";
import {
  MOJE_CARD_FLASH_CLASSES,
  mojeSectionDomId,
  mojeSectionHeadingDomId,
  parseMojeSectionHash,
} from "./moje-section-focus";

describe("mojeSectionDomId", () => {
  it("buduje id karty sekcji i nagłówka", () => {
    expect(mojeSectionDomId("action")).toBe("moje-section-action");
    expect(mojeSectionHeadingDomId("action")).toBe("moje-section-action-heading");
  });
});

describe("parseMojeSectionHash", () => {
  it("rozpoznaje hash sekcji moje", () => {
    expect(parseMojeSectionHash("#moje-section-action")).toBe("moje-section-action");
    expect(parseMojeSectionHash("moje-section-zamowienie")).toBe("moje-section-zamowienie");
  });

  it("ignoruje inne hashe", () => {
    expect(parseMojeSectionHash("#moje-ostatnio-zakonczone")).toBeNull();
    expect(parseMojeSectionHash("")).toBeNull();
  });
});

describe("MOJE_CARD_FLASH_CLASSES", () => {
  it("używa wewnętrznej obwódki (ring-inset)", () => {
    expect(MOJE_CARD_FLASH_CLASSES).toContain("ring-inset");
    expect(MOJE_CARD_FLASH_CLASSES).not.toContain("ring-offset-2");
  });
});
