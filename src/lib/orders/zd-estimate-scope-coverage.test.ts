import { describe, expect, it } from "vitest";
import {
  collectTodayScheduleSuppliers,
  zdEstimateScopeCoverage,
} from "./zd-estimate-scope-coverage";

describe("zdEstimateScopeCoverage", () => {
  it("dziś + zaległy, bez przyszłych", () => {
    const today = collectTodayScheduleSuppliers({
      todayKey: "2026-08-14",
      suppliers: [
        { id: "a", name: "Alfa", computedNextDate: "2026-08-14" },
        { id: "b", name: "Beta", computedNextDate: "2026-08-10" },
        { id: "c", name: "Gamma", computedNextDate: "2026-08-20" },
      ],
    });
    expect(today.map((s) => s.supplierId).sort()).toEqual(["a", "b"]);
    expect(today.find((s) => s.supplierId === "b")?.isOverduePlan).toBe(true);

    const cov = zdEstimateScopeCoverage(today, new Set(["a"]));
    expect(cov.today.map((s) => s.supplierId).sort()).toEqual(["a", "b"]);
    expect(cov.todayCount).toBe(2);
    expect(cov.mappedCount).toBe(1);
    expect(cov.unmapped.map((s) => s.supplierId)).toEqual(["b"]);
  });

  it("pomija w razie potrzeby — jak kolejka Dziś", () => {
    const today = collectTodayScheduleSuppliers({
      todayKey: "2026-08-14",
      suppliers: [
        { id: "a", name: "Alfa", computedNextDate: "2026-08-14" },
        {
          id: "d",
          name: "Delta",
          computedNextDate: "2026-08-14",
          orderOnDemand: true,
        },
      ],
    });
    expect(today.map((s) => s.supplierId)).toEqual(["a"]);
  });
});
