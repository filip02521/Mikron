import { describe, expect, it } from "vitest";
import { procurementNestedRowMeta } from "./procurement-request-row-styles";

describe("procurementNestedRowMeta", () => {
  it("łączy produkty, lokalizację i uwagi", () => {
    expect(
      procurementNestedRowMeta({
        countLabel: "2 produkty",
        locationLabel: "Polska",
        noteSuffix: " · uwagi przy produktach",
      })
    ).toBe("2 produkty · Polska · uwagi przy produktach");
  });

  it("pomija puste części", () => {
    expect(
      procurementNestedRowMeta({
        countLabel: "1 produkt",
        locationLabel: null,
        noteSuffix: "",
      })
    ).toBe("1 produkt");
  });
});
