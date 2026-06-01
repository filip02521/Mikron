import { describe, expect, it } from "vitest";
import {
  countSuppliersByLocation,
  filterSuppliersForAdmin,
} from "./supplier-locations";
import { testSupplierWithSchedule } from "@/test-utils/fixtures";

function supplier(
  id: string,
  name: string,
  location: "POLSKA" | "ZAGRANICA" | "IMPORT"
) {
  return testSupplierWithSchedule({ id, name, location, interval_weeks: 4 });
}

describe("supplier location filters", () => {
  const rows = [
    supplier("1", "Alpha", "POLSKA"),
    supplier("2", "Beta", "ZAGRANICA"),
    supplier("3", "Gamma Import", "IMPORT"),
    supplier("4", "Delta", "POLSKA"),
  ];

  it("liczy dostawców wg lokalizacji", () => {
    expect(countSuppliersByLocation(rows)).toEqual({
      all: 4,
      POLSKA: 2,
      ZAGRANICA: 1,
      IMPORT: 1,
    });
  });

  it("filtruje lokalizację i wyszukiwanie", () => {
    expect(filterSuppliersForAdmin(rows, "IMPORT", "")).toHaveLength(1);
    expect(filterSuppliersForAdmin(rows, "POLSKA", "alp")).toHaveLength(1);
    expect(filterSuppliersForAdmin(rows, "all", "beta")).toHaveLength(1);
  });
});
