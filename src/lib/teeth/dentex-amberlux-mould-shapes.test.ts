import { describe, expect, it } from "vitest";
import {
  dentexAmberluxMouldShapeGroups,
  inferDentexAmberluxShapeId,
  DENTEX_AMBERLUX_LOWER_ANTERIOR,
  DENTEX_AMBERLUX_UPPER_OVAL,
  DENTEX_AMBERLUX_UPPER_SQUARE,
  DENTEX_AMBERLUX_UPPER_TRIANGULAR,
} from "./dentex-amberlux-mould-shapes";

describe("dentex-amberlux-mould-shapes", () => {
  it("przody — 4 sekcje wg katalogu (trójkątne, kwadratowe, owalne, dolne)", () => {
    const groups = dentexAmberluxMouldShapeGroups("anterior");
    expect(groups.map((g) => g.shapeId)).toEqual(["triangular", "square", "oval", "lower"]);
    expect(groups[0]!.moulds).toEqual(DENTEX_AMBERLUX_UPPER_TRIANGULAR);
    expect(groups[1]!.moulds).toEqual(DENTEX_AMBERLUX_UPPER_SQUARE);
    expect(groups[2]!.moulds).toEqual(DENTEX_AMBERLUX_UPPER_OVAL);
    expect(groups[3]!.moulds).toEqual(DENTEX_AMBERLUX_LOWER_ANTERIOR);
    expect(groups[0]!.moulds).toContain("0");
    expect(groups[0]!.moulds).not.toContain("00");
  });

  it("boki — 9 fasonów rzymskich bez IX", () => {
    const groups = dentexAmberluxMouldShapeGroups("posterior");
    expect(groups[0]!.moulds).toEqual(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "X"]);
    expect(groups[0]!.moulds).not.toContain("IX");
  });

  it("inferDentexAmberluxShapeId rozróżnia 0 i 00", () => {
    expect(inferDentexAmberluxShapeId("0")).toBe("triangular");
    expect(inferDentexAmberluxShapeId("00")).toBe("lower");
    expect(inferDentexAmberluxShapeId("26")).toBe("oval");
    expect(inferDentexAmberluxShapeId("I")).toBe("all");
  });
});
