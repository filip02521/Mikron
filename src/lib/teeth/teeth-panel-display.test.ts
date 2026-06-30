import { describe, expect, it } from "vitest";
import { compactTeethProductLabel } from "./teeth-panel-display";

describe("compactTeethProductLabel", () => {
  it("strips supplier prefix from product name", () => {
    expect(
      compactTeethProductLabel(
        "Wiedent 6szt.zęby przednie",
        "WIEDENT 6SZT.",
        "Wiedent",
      ),
    ).toEqual({ primary: "6szt.zęby przednie", secondary: null });
  });

  it("keeps distinct symbol as secondary", () => {
    expect(compactTeethProductLabel("Phonares NCC", "H364", "Mikran")).toEqual({
      primary: "Phonares NCC",
      secondary: "H364",
    });
  });
});
