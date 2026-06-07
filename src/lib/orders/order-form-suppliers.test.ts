import { describe, expect, it } from "vitest";
import {
  mapRowToOrderFormSupplier,
  mapRowsToOrderFormSuppliers,
  orderFormSuppliersHaveSubiektRefs,
} from "./order-form-suppliers";

describe("order-form-suppliers", () => {
  it("mapRowToOrderFormSupplier zachowuje subiekt_kh_id", () => {
    expect(
      mapRowToOrderFormSupplier({
        id: "sup-1",
        name: "ABC",
        stats_mode: "OSOBNO",
        subiekt_kh_id: 688,
      })
    ).toEqual({
      id: "sup-1",
      name: "ABC",
      stats_mode: "OSOBNO",
      subiekt_kh_id: 688,
    });
  });

  it("mapRowsToOrderFormSuppliers ustawia null gdy brak kh_Id", () => {
    const rows = mapRowsToOrderFormSuppliers([
      { id: "a", name: "A" },
      { id: "b", name: "B", subiekt_kh_id: 10 },
    ]);
    expect(rows[0]?.subiekt_kh_id).toBeNull();
    expect(rows[1]?.subiekt_kh_id).toBe(10);
    expect(orderFormSuppliersHaveSubiektRefs(rows)).toBe(true);
  });
});
