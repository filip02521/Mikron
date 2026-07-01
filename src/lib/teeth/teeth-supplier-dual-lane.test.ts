import { describe, expect, it } from "vitest";
import {
  describeTeethLaneForDailyPanel,
  formatTeethLaneScheduleMeta,
  TEETH_DUAL_LANE_COPY,
} from "./teeth-supplier-dual-lane";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule";

const lane: TeethSupplierLaneSnapshot = {
  supplierId: "s1",
  computedNextDate: "2026-07-15",
  shiftDate: null,
  lastOrderDate: "2026-07-01",
  orderDayOfWeek: 2,
  intervalWeeks: 2,
};

describe("teeth-supplier-dual-lane", () => {
  it("formatuje meta cyklu zębów", () => {
    expect(formatTeethLaneScheduleMeta(lane)).toBe(
      `${TEETH_DUAL_LANE_COPY.teethCycleMetaPrefix} 15.07.2026`
    );
    expect(
      formatTeethLaneScheduleMeta({
        ...lane,
        shiftDate: "2026-07-20",
      })
    ).toContain("przesunięty");
  });

  it("opisuje cykl dla panelu dziennego", () => {
    const d = describeTeethLaneForDailyPanel(lane);
    expect(d.primary).toContain("15.07.2026");
    expect(d.secondary).toContain("Wtorek");
    expect(d.secondary).toContain("Co 2 tygodnie");
  });
});
