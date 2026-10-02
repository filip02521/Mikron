import { describe, expect, it } from "vitest";
import {
  buildQuotedIlikeContainsPattern,
  escapeIlikePattern,
  quotePostgrestFilterValue,
} from "./ilike-pattern";

describe("escapeIlikePattern", () => {
  it("chroni znaki specjalne", () => {
    expect(escapeIlikePattern("100%_test")).toBe("100\\%\\_test");
  });
});

describe("quotePostgrestFilterValue", () => {
  it("owija w cudzysłowy i escapuje", () => {
    expect(quotePostgrestFilterValue("%a,b%")).toBe('"%a,b%"');
    expect(quotePostgrestFilterValue('say "hi"')).toBe('"say \\"hi\\""');
  });
});

describe("buildQuotedIlikeContainsPattern", () => {
  it("łączy escape ilike z quotingiem or-filtra", () => {
    expect(buildQuotedIlikeContainsPattern("a,b")).toBe('"%a,b%"');
    expect(buildQuotedIlikeContainsPattern("100%")).toBe('"%100\\\\%%"');
  });
});
