import { describe, expect, it } from "vitest";
import {
  buildQuotedIlikeContainsPattern,
  buildWordsContainsOrFilters,
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

describe("buildWordsContainsOrFilters", () => {
  it("one or-filter per distinct word, each word over every column", () => {
    expect(buildWordsContainsOrFilters("  eco  gips eco ", ["symbol", "name"])).toEqual([
      'symbol.ilike."%eco%",name.ilike."%eco%"',
      'symbol.ilike."%gips%",name.ilike."%gips%"',
    ]);
  });
  it("escapes wildcards and quotes inside a word", () => {
    expect(buildWordsContainsOrFilters('5%"x', ["name"])).toEqual(['name.ilike."%5\\\\%\\"x%"']);
  });
  it("empty query gives no filters", () => {
    expect(buildWordsContainsOrFilters("   ", ["name"])).toEqual([]);
  });
});
