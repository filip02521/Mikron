import { describe, expect, it } from "vitest";
import {
  avgDaysForOrderType,
  combinedAvgDays,
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

describe("orderTypesForLeadTimeHints", () => {
  it("LACZNIE — jeden szacunek", () => {
    expect(orderTypesForLeadTimeHints(stats, "LACZNIE")).toEqual(["Glowne"]);
  });

  it("OSOBNO — dwa warianty gdy są obie średnie", () => {
    expect(orderTypesForLeadTimeHints(stats, "OSOBNO")).toEqual(["Glowne", "Poboczne"]);
  });
});
