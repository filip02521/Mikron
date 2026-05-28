import { describe, expect, it } from "vitest";
import {
  avgDaysForOrderType,
  combinedAvgDays,
  formatSupplierLeadTimeBrief,
  orderTypesForLeadTimeHints,
} from "@/lib/orders/delivery-eta";
import type { DeliveryStats } from "@/types/database";

const stats: DeliveryStats = {
  supplier_id: "x",
  main_sum: 20,
  main_count: 2,
  main_avg: 10,
  side_sum: 10,
  side_count: 2,
  side_avg: 5,
};

describe("avgDaysForOrderType LACZNIE", () => {
  it("używa średniej ważonej sum/count jak GAS", () => {
    expect(combinedAvgDays(stats)).toBe(8);
    expect(avgDaysForOrderType(stats, "Glowne", "LACZNIE")).toBe(8);
    expect(avgDaysForOrderType(stats, "Poboczne", "LACZNIE")).toBe(8);
  });

  it("OSOBNO rozdziela typy", () => {
    expect(avgDaysForOrderType(stats, "Glowne", "OSOBNO")).toBe(10);
    expect(avgDaysForOrderType(stats, "Poboczne", "OSOBNO")).toBe(5);
  });
});

describe("formatSupplierLeadTimeBrief", () => {
  it("LACZNIE — jedna krótka linia", () => {
    expect(formatSupplierLeadTimeBrief(stats, "LACZNIE")).toBe("~8 dni rob.");
  });

  it("OSOBNO — główne i poboczne", () => {
    expect(formatSupplierLeadTimeBrief(stats, "OSOBNO")).toBe("gł. ~10 d · pob. ~5 d");
  });

  it("brak historii — null", () => {
    expect(formatSupplierLeadTimeBrief(null, "LACZNIE")).toBeNull();
  });
});

describe("orderTypesForLeadTimeHints", () => {
  it("LACZNIE — jeden szacunek", () => {
    expect(orderTypesForLeadTimeHints(stats, "LACZNIE")).toEqual(["Glowne"]);
  });

  it("OSOBNO — dwa warianty gdy są obie średnie", () => {
    expect(orderTypesForLeadTimeHints(stats, "OSOBNO")).toEqual(["Glowne", "Poboczne"]);
  });
});
