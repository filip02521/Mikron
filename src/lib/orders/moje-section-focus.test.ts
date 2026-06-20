import { describe, expect, it } from "vitest";
import {
  MOJE_CARD_FLASH_CLASSES,
  MOJE_CARD_OUTLINE_FLASH_CLASSES,
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
  it("używa wewnętrznej obwódki na overlay (::after)", () => {
    expect(MOJE_CARD_FLASH_CLASSES).toContain("after:ring-inset");
    expect(MOJE_CARD_FLASH_CLASSES).not.toContain("ring-offset-2");
    expect(MOJE_CARD_FLASH_CLASSES).not.toContain("ring-inset");
  });

  it("trzyma overlay nad wierszami i sąsiednimi sekcjami", () => {
    expect(MOJE_CARD_FLASH_CLASSES).toContain("after:z-[5]");
    expect(MOJE_CARD_FLASH_CLASSES).toContain("z-20");
    expect(MOJE_CARD_FLASH_CLASSES).toContain("isolate");
  });

  it("ma delikatne tło na treści", () => {
    expect(MOJE_CARD_FLASH_CLASSES).toContain("after:bg-indigo-50/50");
  });
});

describe("MOJE_CARD_OUTLINE_FLASH_CLASSES", () => {
  it("ma tylko obwódkę bez tła i podnoszenia całej karty", () => {
    expect(MOJE_CARD_OUTLINE_FLASH_CLASSES).toContain("after:ring-inset");
    expect(MOJE_CARD_OUTLINE_FLASH_CLASSES).not.toContain("after:bg-indigo-50/50");
    expect(MOJE_CARD_OUTLINE_FLASH_CLASSES).not.toContain("z-20");
    expect(MOJE_CARD_OUTLINE_FLASH_CLASSES).not.toContain("isolate");
  });
});
