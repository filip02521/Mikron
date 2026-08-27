import { describe, expect, it } from "vitest";
import {
  avgDaysForOrderType,
  buildSupplierDrawerLeadTime,
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
    expect(formatSupplierLeadTimeBrief(stats, "LACZNIE", { useP50: false })).toBe(
      "~8 dni rob. · szacunek"
    );
  });

  it("OSOBNO — główne i poboczne", () => {
    expect(formatSupplierLeadTimeBrief(stats, "OSOBNO", { useP50: false })).toBe(
      "gł. ~10 d · pob. ~5 d · szacunek"
    );
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

describe("buildSupplierDrawerLeadTime", () => {
  it("empty gdy brak historii", () => {
    const m = buildSupplierDrawerLeadTime(null, "LACZNIE", { useP50: false });
    expect(m.kind).toBe("empty");
  });

  it("LACZNIE — combined z ważoną średnią", () => {
    const m = buildSupplierDrawerLeadTime(stats, "LACZNIE", { useP50: false });
    expect(m.kind).toBe("combined");
    if (m.kind !== "combined") return;
    expect(m.primary.avgDisplay).toBe("~8");
    expect(m.lowConfidence).toBe(true); // n=4 < 5
    expect(m.modeLabel).toBe("łącznie");
    expect(m.sampleLabel).toContain("4 dostawy");
  });

  it("LACZNIE — lowConfidence przy <5 próbach", () => {
    const thin: DeliveryStats = {
      supplier_id: "x",
      main_sum: 10,
      main_count: 2,
      main_avg: 5,
      side_sum: 0,
      side_count: 0,
      side_avg: null,
    };
    const m = buildSupplierDrawerLeadTime(thin, "LACZNIE", { useP50: false });
    expect(m.kind).toBe("combined");
    if (m.kind !== "combined") return;
    expect(m.lowConfidence).toBe(true);
    expect(m.footnote).toBeTruthy();
  });

  it("LACZNIE bez lowConfidence przy większej próbie", () => {
    const rich: DeliveryStats = {
      ...stats,
      main_sum: 40,
      main_count: 5,
      main_avg: 8,
      side_sum: 0,
      side_count: 0,
      side_avg: null,
    };
    const m = buildSupplierDrawerLeadTime(rich, "LACZNIE", { useP50: false });
    expect(m.kind).toBe("combined");
    if (m.kind !== "combined") return;
    expect(m.lowConfidence).toBe(false);
    expect(m.footnote).toBeNull();
  });

  it("OSOBNO — split gł./pob.", () => {
    const m = buildSupplierDrawerLeadTime(stats, "OSOBNO", { useP50: false });
    expect(m.kind).toBe("split");
    if (m.kind !== "split") return;
    expect(m.main?.avgDisplay).toBe("~10");
    expect(m.side?.avgDisplay).toBe("~5");
    expect(m.modeLabel).toBe("osobno");
  });

  it("LACZNIE + p50 — primary z mediany", () => {
    const m = buildSupplierDrawerLeadTime(stats, "LACZNIE", {
      useP50: true,
      p50Combined: 4,
      nOrders: 4,
    });
    expect(m.kind).toBe("combined");
    if (m.kind !== "combined") return;
    expect(m.primary.avgDisplay).toBe("~4");
    expect(m.title).toBe("Typowy czas dostawy");
  });
});
