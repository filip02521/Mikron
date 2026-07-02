import { describe, expect, it } from "vitest";
import { expandDraftToJawGroups, isTeethBuilderDraftComplete } from "./teeth-draft-jaw";
import type { TeethCatalogRef } from "./teeth-catalog";

const phonares: TeethCatalogRef = { productLine: "ivoclar_phonares_ii" };

describe("teeth-draft-jaw", () => {
  it("przód bez szczęki", () => {
    const rows = expandDraftToJawGroups(
      {
        color: "A2",
        mould: "S61",
        jaw: "upper",
        kind: "anterior",
        count: 4,
      },
      "ivoclar_phonares_ii",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.jaw).toBeNull();
  });

  it("bok Oba tworzy dwie pozycje z parą NU/NL", () => {
    const rows = expandDraftToJawGroups(
      {
        color: "A2",
        mould: "NU6",
        jaw: null,
        kind: "posterior",
        count: 2,
        jawMode: "both",
      },
      "ivoclar_phonares_ii",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ jaw: "upper", mould: "NU6" });
    expect(rows[1]).toMatchObject({ jaw: "lower", mould: "NL6" });
  });

  it("bok Oba bez pary — ten sam fason ×2", () => {
    const rows = expandDraftToJawGroups(
      {
        color: "A1",
        mould: "60",
        jaw: null,
        kind: "posterior",
        count: 3,
        jawMode: "both",
      },
      "wiedent_estetic",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.mould).toBe("60");
    expect(rows[1]!.mould).toBe("60");
  });

  it("bok Oba tworzy dwie pozycje z parą LU/LL", () => {
    const rows = expandDraftToJawGroups(
      {
        color: "A2",
        mould: "LU5",
        jaw: null,
        kind: "posterior",
        count: 2,
        jawMode: "both",
      },
      "ivoclar_phonares_ii",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ jaw: "upper", mould: "LU5" });
    expect(rows[1]).toMatchObject({ jaw: "lower", mould: "LL5" });
  });

  it("Orthotyp Oba tworzy parę N*U/N*L", () => {
    const rows = expandDraftToJawGroups(
      {
        color: "A2",
        mould: "N5U",
        jaw: null,
        kind: "posterior",
        count: 2,
        jawMode: "both",
      },
      "ivoclar_orthotyp_dcl",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ jaw: "upper", mould: "N5U" });
    expect(rows[1]).toMatchObject({ jaw: "lower", mould: "N5L" });
  });

  it("isTeethBuilderDraftComplete akceptuje jawMode both", () => {
    expect(
      isTeethBuilderDraftComplete(
        {
          color: "A2",
          mould: "NU6",
          jaw: null,
          kind: "posterior",
          count: 2,
          jawMode: "both",
        },
        phonares,
      ),
    ).toBe(true);
  });
});
