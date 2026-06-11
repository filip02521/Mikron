import { describe, expect, it } from "vitest";
import {
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
