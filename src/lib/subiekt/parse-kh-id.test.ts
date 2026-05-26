import { describe, expect, it } from "vitest";
import { parseSubiektKhId } from "./parse-kh-id";

describe("parseSubiektKhId", () => {
  it("akceptuje liczbę i string z bazy", () => {
    expect(parseSubiektKhId(688)).toBe(688);
    expect(parseSubiektKhId("688")).toBe(688);
  });

  it("odrzuca 0 i niepoprawne wartości", () => {
    expect(parseSubiektKhId(0)).toBeNull();
    expect(parseSubiektKhId("")).toBeNull();
    expect(parseSubiektKhId(null)).toBeNull();
    expect(parseSubiektKhId("abc")).toBeNull();
  });
});
