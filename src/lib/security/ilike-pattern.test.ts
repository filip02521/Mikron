import { describe, expect, it } from "vitest";
import { escapeIlikePattern } from "./ilike-pattern";

describe("escapeIlikePattern", () => {
  it("chroni znaki specjalne", () => {
    expect(escapeIlikePattern("100%_test")).toBe("100\\%\\_test");
  });
});
