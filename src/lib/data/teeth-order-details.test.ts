import { describe, expect, it } from "vitest";
import { mapTeethDetailRow } from "./teeth-order-details";

describe("mapTeethDetailRow", () => {
  it("maps full row with jaw and kind", () => {
    const row = mapTeethDetailRow({
      id: "abc",
      order_id: "ord-1",
      position: 2,
      color: "A2",
      mould: "N12",
      size: null,
      jaw: "upper",
      kind: "anterior",
    });
    expect(row).toEqual({
      id: "abc",
      order_id: "ord-1",
      position: 2,
      color: "A2",
      mould: "N12",
      size: null,
      jaw: "upper",
      kind: "anterior",
      ordered_at: null,
    });
  });

  it("ignores invalid jaw and kind values", () => {
    const row = mapTeethDetailRow({
      id: "x",
      order_id: "o",
      position: 1,
      color: "B1",
      mould: null,
      size: "M",
      jaw: "invalid",
      kind: "other",
    });
    expect(row.jaw).toBeNull();
    expect(row.kind).toBeNull();
    expect(row.size).toBe("M");
  });

  it("reads jaw from legacy size field", () => {
    const row = mapTeethDetailRow({
      id: "x",
      order_id: "o",
      position: 1,
      color: "A1",
      mould: null,
      size: "góra",
      jaw: null,
      kind: null,
    });
    expect(row.jaw).toBe("upper");
  });

  it("parses Polish jaw and kind labels", () => {
    expect(
      mapTeethDetailRow({
        id: "x",
        order_id: "o",
        position: 1,
        color: "A1",
        mould: null,
        size: null,
        jaw: "Dolna",
        kind: "Boczne",
      }).jaw
    ).toBe("lower");
    expect(
      mapTeethDetailRow({
        id: "x",
        order_id: "o",
        position: 1,
        color: "A1",
        mould: null,
        size: null,
        jaw: "Dolna",
        kind: "Boczne",
      }).kind
    ).toBe("posterior");
    expect(
      mapTeethDetailRow({
        id: "x",
        order_id: "o",
        position: 2,
        color: "A1",
        mould: null,
        size: null,
        jaw: "Górna",
        kind: "Przednie",
      }).kind
    ).toBe("anterior");
  });
});
