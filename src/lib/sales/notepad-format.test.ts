import { describe, expect, it } from "vitest";
import { formatPln } from "./notepad-format";

describe("formatPln", () => {
  it("formatuje liczbę i string z bazy", () => {
    expect(formatPln(1230)).toContain("1");
    expect(formatPln("1230.50")).toContain("1");
    expect(formatPln(null)).toBe("—");
  });
});
