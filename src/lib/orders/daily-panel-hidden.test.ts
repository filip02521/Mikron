import { describe, expect, it } from "vitest";
import { buildSummaryWorkspace } from "./summary-workspace";
import { buildDailyPanelHiddenReport } from "./daily-panel-hidden";
import type { SupplierWithSchedule } from "@/types/database";

function supplier(
  id: string,
  name: string,
  extra: Partial<SupplierWithSchedule> & {
    computed_next_date?: string | null;
    order_date?: string | null;
  } = {}
): SupplierWithSchedule {
  const { computed_next_date = "2026-05-20", order_date = "2026-05-01", ...rest } = extra;
  return {
    id,
    name,
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: "2",
    interval_weeks: 2,
    stock_raw: "",
    stock: null,
    stats_mode: "LACZNIE",
    schedule: {
      id: `sch-${id}`,
      supplier_id: id,
      order_date: order_date ?? null,
      shift_date: null,
      computed_next_date: computed_next_date ?? null,
      vacation_note: null,
    },
    ...rest,
  } as SupplierWithSchedule;
}

describe("buildDailyPanelHiddenReport", () => {
  const today = new Date(2026, 4, 15);

  it("zgłasza brak daty ostatniego zamówienia", () => {
    const ws = buildSummaryWorkspace(
      [supplier("a", "Bez daty", { order_date: null, computed_next_date: null })],
      [],
      today
    );
    const report = buildDailyPanelHiddenReport(
      [supplier("a", "Bez daty", { order_date: null, computed_next_date: null })],
      ws
    );
    expect(report.suppliers).toHaveLength(1);
    expect(report.suppliers[0]?.reason).toBe("missing_last_order");
  });

  it("nie zgłasza dostawcy z terminem w przyszłości — pojawi się w planie", () => {
    const far = supplier("far", "Daleki", { computed_next_date: "2026-06-15" });
    const ws = buildSummaryWorkspace([far], [], today);
    const report = buildDailyPanelHiddenReport([far], ws);
    expect(report.suppliers).toHaveLength(0);
  });

  it("nie zgłasza dostawcy widocznego na dziś", () => {
    const todayStr = "2026-05-15";
    const onToday = supplier("t", "Na dziś", { computed_next_date: todayStr });
    const ws = buildSummaryWorkspace([onToday], [], today);
    const report = buildDailyPanelHiddenReport([onToday], ws);
    expect(report.suppliers).toHaveLength(0);
  });
});
