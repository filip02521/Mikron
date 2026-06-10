import { describe, expect, it } from "vitest";
import { formatZkWatchNotePreview } from "./zk-watch-row-display";

describe("formatZkWatchNotePreview", () => {
  it("zwraca null dla pustej notatki", () => {
    expect(formatZkWatchNotePreview(null)).toBeNull();
    expect(formatZkWatchNotePreview("   ")).toBeNull();
  });

  it("skraca długą notatkę", () => {
    const long = "a".repeat(80);
    expect(formatZkWatchNotePreview(long, 20)).toBe(`${"a".repeat(19)}…`);
  });

  it("normalizuje białe znaki", () => {
    expect(formatZkWatchNotePreview("dostawa  czerwiec\n/ lipiec")).toBe("dostawa czerwiec / lipiec");
  });
});
