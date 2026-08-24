import { describe, expect, it } from "vitest";
import {
  parseOperationsNoteColor,
  parseOperationsNoteFollowUpAt,
} from "./operations-note-payload";

describe("parseOperationsNoteColor", () => {
  it("akceptuje znane kolory", () => {
    expect(parseOperationsNoteColor("blue")).toBe("blue");
  });

  it("odrzuca nieznane", () => {
    expect(() => parseOperationsNoteColor("purple")).toThrow(/kolor/i);
  });
});

describe("parseOperationsNoteFollowUpAt", () => {
  it("normalizuje pustą wartość do null", () => {
    expect(parseOperationsNoteFollowUpAt(null)).toBeNull();
    expect(parseOperationsNoteFollowUpAt("  ")).toBeNull();
  });

  it("akceptuje YYYY-MM-DD", () => {
    expect(parseOperationsNoteFollowUpAt("2026-08-24")).toBe("2026-08-24");
    expect(parseOperationsNoteFollowUpAt("2026-08-24T12:00:00Z")).toBe("2026-08-24");
  });

  it("odrzuca zły format", () => {
    expect(() => parseOperationsNoteFollowUpAt("24.08.2026")).toThrow(/dat/i);
  });
});
