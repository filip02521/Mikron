import { describe, expect, it } from "vitest";
import {
  catalogLineForDualKind,
  isCrossLineDualKindPair,
} from "@/lib/teeth/teeth-cross-line-pairs";

describe("teeth-cross-line-pairs", () => {
  it("maps ivostar anchor to gnathostar for posterior", () => {
    expect(catalogLineForDualKind("ivoclar_ivostar", "anterior")).toBe("ivoclar_ivostar");
    expect(catalogLineForDualKind("ivoclar_ivostar", "posterior")).toBe("ivoclar_gnathostar");
    expect(catalogLineForDualKind("ivoclar_gnathostar", "anterior")).toBe("ivoclar_ivostar");
    expect(catalogLineForDualKind("ivoclar_gnathostar", "posterior")).toBe("ivoclar_gnathostar");
  });

  it("recognizes cross-line pairs", () => {
    expect(isCrossLineDualKindPair("ivoclar_ivostar", "ivoclar_gnathostar")).toBe(true);
    expect(isCrossLineDualKindPair("ivoclar_phonares_ii", "ivoclar_phonares_ii")).toBe(false);
  });
});
