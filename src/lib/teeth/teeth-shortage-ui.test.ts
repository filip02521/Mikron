import { describe, expect, it } from "vitest";
import {
  matchTeethShortagesForOrderLine,
  teethShortageFormWarning,
} from "./teeth-shortage-ui";
import type { TeethShortageMatchInput } from "./teeth-shortage-match";

const shortage = (overrides: Partial<TeethShortageMatchInput> = {}): TeethShortageMatchInput => ({
  id: "1",
  supplierId: "sup1",
  supplierName: "Lab",
  productLine: "wiedent_estetic",
  color: "A1",
  mould: "12",
  kind: null,
  availableFrom: null,
  note: "",
  active: true,
  ...overrides,
});

describe("teeth-shortage-ui", () => {
  it("builds non-blocking warning form message", () => {
    const hits = matchTeethShortagesForOrderLine({
      productLine: "wiedent_estetic",
      details: [{ position: 1, color: "A1", mould: "12", kind: "anterior" }],
      shortages: [shortage()],
    });
    const warning = teethShortageFormWarning(hits);
    expect(warning?.tone).toBe("warning");
    expect(warning?.text).toMatch(/nie jest blokowana/i);
    expect(warning?.text).toMatch(/nieustalony/i);
  });

  it("returns null warning when no hits", () => {
    expect(teethShortageFormWarning([])).toBeNull();
  });

  it("includes salesperson note in form warning", () => {
    const hits = matchTeethShortagesForOrderLine({
      productLine: "wiedent_estetic",
      details: [{ position: 1, color: "A1", mould: "12", kind: "anterior" }],
      shortages: [shortage({ note: "Problem z surowcami" })],
    });
    const warning = teethShortageFormWarning(hits);
    expect(warning?.text).toMatch(/Problem z surowcami/);
  });

  it("in dual mode remaps cross-line pairs so shortage on anterior line hits only anteriors", () => {
    const hits = matchTeethShortagesForOrderLine({
      productLine: "ivoclar_ivostar",
      dualKindMode: true,
      details: [
        { position: 1, color: "A1", mould: "11", kind: "anterior" },
        { position: 2, color: "A1", mould: "22", kind: "posterior" },
      ],
      shortages: [
        shortage({
          id: "ivo",
          productLine: "ivoclar_ivostar",
          color: "A1",
          mould: "11",
          kind: "anterior",
        }),
        shortage({
          id: "gna",
          productLine: "ivoclar_gnathostar",
          color: "A1",
          mould: "22",
          kind: "posterior",
        }),
      ],
    });
    expect(hits.map((h) => h.shortage.id).sort()).toEqual(["gna", "ivo"]);
    expect(hits.find((h) => h.shortage.id === "ivo")?.count).toBe(1);
    expect(hits.find((h) => h.shortage.id === "gna")?.count).toBe(1);
  });

  it("kind-null shortage on anterior cross-line does not warn for paired posterior line", () => {
    const hits = matchTeethShortagesForOrderLine({
      productLine: "ivoclar_ivostar",
      dualKindMode: true,
      details: [
        { position: 1, color: "A1", mould: "", kind: "anterior" },
        { position: 2, color: "A1", mould: "", kind: "posterior" },
      ],
      shortages: [
        shortage({
          productLine: "ivoclar_ivostar",
          color: "A1",
          mould: "",
          kind: null,
        }),
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.count).toBe(1);
  });
});
