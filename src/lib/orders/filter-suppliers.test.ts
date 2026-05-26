import { describe, expect, it } from "vitest";
import { filterSuppliersByName } from "./filter-suppliers";

describe("filterSuppliersByName", () => {
  const list = [
    { id: "1", name: "Renfert GmbH" },
    { id: "2", name: "Ivoclar" },
    { id: "3", name: "VOCO" },
  ];

  it("zwraca pierwsze N bez zapytania", () => {
    expect(filterSuppliersByName(list, "", 2)).toHaveLength(2);
  });

  it("filtruje po fragmencie nazwy", () => {
    expect(filterSuppliersByName(list, "ren").map((s) => s.id)).toEqual(["1"]);
  });

  it("dopasowuje W&H do nazwy z odstępem", () => {
    const wh = [{ id: "w", name: "W H Dental GmbH" }];
    expect(filterSuppliersByName(wh, "W&H").map((s) => s.id)).toEqual(["w"]);
  });
});
