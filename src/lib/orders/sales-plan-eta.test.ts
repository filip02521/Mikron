import { describe, expect, it } from "vitest";
import {
  buildSalesPlanArrivalEta,
  buildSalesPlanTeethLine,
  isActiveShiftDate,
  salesPlanEtaStartAt,
} from "./sales-plan-eta";
import type { DeliveryStats, TeethSupplierSchedule } from "@/types/database";

function stats(partial: Partial<DeliveryStats> = {}): DeliveryStats {
  return {
    supplier_id: "s1",
    main_sum: 50,
    main_count: 10,
    main_avg: 5,
    side_sum: 12,
    side_count: 4,
    side_avg: 3,
    ...partial,
  };
}

describe("salesPlanEtaStartAt", () => {
  it("null dla na żądanie i braku terminu", () => {
    expect(
      salesPlanEtaStartAt({
        nextDate: "2026-08-26",
        isOverdue: false,
        orderOnDemand: true,
        todayKey: "2026-08-24",
      })
    ).toBeNull();
    expect(
      salesPlanEtaStartAt({
        nextDate: null,
        isOverdue: false,
        orderOnDemand: false,
        todayKey: "2026-08-24",
      })
    ).toBeNull();
  });

  it("bierze nextDate gdy przyszły", () => {
    expect(
      salesPlanEtaStartAt({
        nextDate: "2026-08-26",
        isOverdue: false,
        orderOnDemand: false,
        todayKey: "2026-08-24",
      })
    ).toBe("2026-08-26");
  });

  it("overdue → today", () => {
    expect(
      salesPlanEtaStartAt({
        nextDate: "2026-08-10",
        isOverdue: true,
        orderOnDemand: false,
        todayKey: "2026-08-24",
      })
    ).toBe("2026-08-24");
  });
});

describe("buildSalesPlanArrivalEta", () => {
  it("null bez startAt lub historii", () => {
    expect(
      buildSalesPlanArrivalEta({
        startAt: null,
        stats: stats(),
        statsMode: "LACZNIE",
      })
    ).toBeNull();
    expect(
      buildSalesPlanArrivalEta({
        startAt: "2026-08-26",
        stats: undefined,
        statsMode: "LACZNIE",
      })
    ).toBeNull();
  });

  it("liczy datę z LACZNIE", () => {
    const eta = buildSalesPlanArrivalEta({
      startAt: "2026-08-24",
      stats: stats({ main_avg: 2, side_avg: 2, main_count: 5, side_count: 5 }),
      statsMode: "LACZNIE",
    });
    expect(eta).not.toBeNull();
    expect(eta!.shortLabel).toMatch(/^ok\. /);
    expect(eta!.avgBusinessDays).toBeGreaterThan(0);
  });

  it("OSOBNO używa Glowne", () => {
    const eta = buildSalesPlanArrivalEta({
      startAt: "2026-08-24",
      stats: stats({
        main_avg: 4,
        main_count: 8,
        side_avg: 1,
        side_count: 20,
      }),
      statsMode: "OSOBNO",
    });
    expect(eta?.avgBusinessDays).toBe(4);
  });
});

describe("isActiveShiftDate", () => {
  it("ignoruje przeszły shift", () => {
    expect(isActiveShiftDate("2026-08-01", "2026-08-24")).toBe(false);
    expect(isActiveShiftDate("2026-08-30", "2026-08-24")).toBe(true);
    expect(isActiveShiftDate(null, "2026-08-24")).toBe(false);
  });
});

describe("buildSalesPlanTeethLine", () => {
  it("null bez computed_next_date", () => {
    expect(buildSalesPlanTeethLine(null)).toBeNull();
  });

  it("ETA z historii gdy brak stałego lead", () => {
    const sch = {
      computed_next_date: "2026-08-26",
      delivery_lead_business_days: null,
    } as TeethSupplierSchedule;
    const line = buildSalesPlanTeethLine(sch, {
      todayKey: "2026-08-24",
      historyEtaLabel: "ok. 02.09.2026 · ~5 dni rob.",
    });
    expect(line?.etaLabel).toContain("02.09");
  });

  it("stały lead wygrywa z historią", () => {
    const sch = {
      computed_next_date: "2026-08-26",
      delivery_lead_business_days: 2,
    } as TeethSupplierSchedule;
    const line = buildSalesPlanTeethLine(sch, {
      todayKey: "2026-08-24",
      historyEtaLabel: "ok. 99.99.2099 · ~99 dni rob.",
    });
    expect(line?.etaLabel).toContain("~2");
    expect(line?.etaLabel).not.toContain("99");
  });
});
