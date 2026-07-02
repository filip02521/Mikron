import { describe, expect, it } from "vitest";

import {

  inferShapeIdForMould,

  mouldShapeGroupsFor,

  resolvePosteriorMouldPair,

} from "./teeth-mould-shape-groups";



describe("teeth-mould-shape-groups", () => {
  it("grupuje Vivodent DCL przody na 4 kolumny", () => {
    const groups = mouldShapeGroupsFor("ivoclar_vivodent_dcl", "anterior");
    expect(groups).toHaveLength(4);
    expect(groups.map((g) => g.label)).toEqual([
      "Trójkątne",
      "Owalne",
      "Kwadratowe",
      "Dolne",
    ]);
    expect(groups[3]?.moulds).toContain("A10");
  });

  it("grupuje Orthotyp DCL boki na 4 kolumny", () => {
    const groups = mouldShapeGroupsFor("ivoclar_orthotyp_dcl", "posterior");
    expect(groups).toHaveLength(4);
    expect(groups[0]?.moulds).toContain("N3U");
    expect(groups[3]?.moulds).toContain("LL6");
  });

  it("resolvePosteriorMouldPair mapuje N*U ↔ N*L (Orthotyp)", () => {
    expect(resolvePosteriorMouldPair("N5U", "ivoclar_orthotyp_dcl")).toEqual({
      upper: "N5U",
      lower: "N5L",
    });
    expect(resolvePosteriorMouldPair("N4", "ivoclar_orthotyp_dcl")).toEqual({
      upper: "N4U",
      lower: "N4L",
    });
  });

  it("grupuje Phonares przody na Soft / Bold / Dolne", () => {

    const groups = mouldShapeGroupsFor("ivoclar_phonares_ii", "anterior");

    expect(groups).toHaveLength(3);

    expect(groups.map((g) => g.label)).toEqual(["Soft", "Bold", "Dolne"]);

    const soft = groups.find((g) => g.label === "Soft");

    expect(soft?.moulds).toContain("S61");

    expect(soft?.hint).toMatch(/S\*/);

    expect(groups.find((g) => g.label === "Bold")?.moulds).toContain("B61");

    expect(groups.find((g) => g.label === "Dolne")?.moulds).toContain("L55");

  });



  it("Phonares boki — Typ i Lingual w 4 kolumnach", () => {

    const groups = mouldShapeGroupsFor("ivoclar_phonares_ii", "posterior");

    expect(groups).toHaveLength(4);

    expect(groups[0]!.moulds).toContain("NU6");

    expect(groups[1]!.moulds).toContain("NL3");

    expect(groups[2]!.moulds).toContain("LU5");

    expect(groups[3]!.moulds).toContain("LL6");

  });



  it("resolvePosteriorMouldPair mapuje NU ↔ NL", () => {

    expect(resolvePosteriorMouldPair("NU6", "ivoclar_phonares_ii")).toEqual({

      upper: "NU6",

      lower: "NL6",

    });

    expect(resolvePosteriorMouldPair("NL3", "ivoclar_phonares_ii")).toEqual({

      upper: "NU3",

      lower: "NL3",

    });

    expect(resolvePosteriorMouldPair("T11", "major_composite")).toBeNull();

  });



  it("resolvePosteriorMouldPair mapuje LU ↔ LL", () => {

    expect(resolvePosteriorMouldPair("LU5", "ivoclar_phonares_ii")).toEqual({

      upper: "LU5",

      lower: "LL5",

    });

    expect(resolvePosteriorMouldPair("LL3", "ivoclar_phonares_ii")).toEqual({

      upper: "LU3",

      lower: "LL3",

    });

  });



  it("inferShapeIdForMould rozpoznaje serię Phonares", () => {

    expect(inferShapeIdForMould("S72", "ivoclar_phonares_ii", "anterior")).toBe("oval");

    expect(inferShapeIdForMould("B61", "ivoclar_phonares_ii", "anterior")).toBe("square");

    expect(inferShapeIdForMould("L51", "ivoclar_phonares_ii", "anterior")).toBe("lower");

    expect(inferShapeIdForMould("LU6", "ivoclar_phonares_ii", "posterior")).toBe("upper");

  });



  it("Wiedent estetic — 4 grupy przodów wg katalogu", () => {

    const groups = mouldShapeGroupsFor("wiedent_estetic", "anterior");

    expect(groups).toHaveLength(4);

    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "triangular", "square", "oval"]);

    expect(groups[0]!.moulds).toContain("00");

    expect(groups[1]!.moulds).toContain("12");

    expect(groups[2]!.moulds).toContain("27");

    expect(groups[3]!.moulds).toContain("32");

  });



  it("Wiedent Classic — dolne i górne przody", () => {

    const groups = mouldShapeGroupsFor("wiedent_classic", "anterior");

    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "upper"]);

    expect(groups[0]!.moulds).toContain("733");

    expect(groups[1]!.moulds).toContain("507");

  });



  it("Wiedent Almamiss — dolne i górne przody", () => {

    const groups = mouldShapeGroupsFor("wiedent_almamiss", "anterior");

    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "upper"]);

    expect(groups[0]!.moulds).toContain("111");

    expect(groups[1]!.moulds).toContain("415");

  });



  it("Wiedent Estetic Vita — ten sam podział co skala W", () => {

    const groups = mouldShapeGroupsFor("wiedent_estetic_vita", "anterior");

    expect(groups).toHaveLength(4);

    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "triangular", "square", "oval"]);

  });



  it("Dentex AmberLux — 4 grupy przodów wg katalogu", () => {

    const groups = mouldShapeGroupsFor("dentex_amberlux", "anterior");

    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "triangular", "square", "oval"]);

    expect(groups[1]!.moulds).toContain("41");

    expect(groups[3]!.moulds).toContain("48");

  });



  it("Dentex boki — bez IX", () => {

    const groups = mouldShapeGroupsFor("dentex_amberlux", "posterior");

    expect(groups[0]!.moulds).not.toContain("IX");

    expect(groups[0]!.moulds).toContain("V");

  });



  it("Major Super Lux — 4 grupy przodów", () => {

    const groups = mouldShapeGroupsFor("major_super_lux", "anterior");

    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "triangular", "oval", "square"]);

    expect(groups[0]!.moulds).toContain("0/11");

    expect(groups[3]!.moulds).toContain("62");

  });



  it("Major Super Lux — boki L-cusp i N-cusp", () => {

    const groups = mouldShapeGroupsFor("major_super_lux", "posterior");

    expect(groups).toHaveLength(4);

    expect(groups[3]!.label).toBe("N-cusp");

  });



  it("inne linie — kolumny sortowane po liczbie fasonów", () => {

    const raw = mouldShapeGroupsFor("schottlander_enigmalife", "anterior");

    const sorted = [...raw].sort((a, b) => a.moulds.length - b.moulds.length);

    expect(sorted[0]!.moulds.length).toBeLessThanOrEqual(sorted[sorted.length - 1]!.moulds.length);

  });

});


