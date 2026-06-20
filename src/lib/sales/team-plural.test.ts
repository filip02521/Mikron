import { describe, expect, it } from "vitest";
import { formatPrzypomnienieCount } from "./team-plural";

describe("formatPrzypomnienieCount", () => {
  it("odmienia poprawnie", () => {
    expect(formatPrzypomnienieCount(1)).toBe("1 przypomnienie");
    expect(formatPrzypomnienieCount(2)).toBe("2 przypomnienia");
    expect(formatPrzypomnienieCount(5)).toBe("5 przypomnień");
    expect(formatPrzypomnienieCount(22)).toBe("22 przypomnienia");
    expect(formatPrzypomnienieCount(25)).toBe("25 przypomnień");
  });
});
