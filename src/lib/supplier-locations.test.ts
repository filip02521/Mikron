import { describe, expect, it } from "vitest";
import {
  countSuppliersByLocation,
  countSuppliersBySubiektLink,
  filterSuppliersForAdmin,
} from "./supplier-locations";
import { testSupplierWithSchedule } from "@/test-utils/fixtures";

function supplier(
  id: string,
  name: string,
  location: "POLSKA" | "ZAGRANICA" | "IMPORT",
  subiekt_kh_id: number | null = 1
) {
  return testSupplierWithSchedule({ id, name, location, interval_weeks: 4, subiekt_kh_id });
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

  it("filtruje powiązanie Subiekt i sortuje niepowiązanych na górę", () => {
    const linked = [
      supplier("1", "Alpha", "POLSKA", 10),
      supplier("2", "Beta", "POLSKA", null),
      supplier("3", "Gamma", "POLSKA", null),
    ];
    expect(countSuppliersBySubiektLink(linked)).toEqual({
      all: 3,
      unlinked: 2,
      linked: 1,
    });
    expect(filterSuppliersForAdmin(linked, "all", "", "unlinked")).toHaveLength(2);
    expect(filterSuppliersForAdmin(linked, "all", "", "linked")).toHaveLength(1);
    expect(filterSuppliersForAdmin(linked, "all", "", "all", true).map((s) => s.name)).toEqual([
      "Beta",
      "Gamma",
      "Alpha",
    ]);
  });
});
