import { describe, expect, it } from "vitest";
import {
  buildSalesSupplierInsight,
  buildWeekOrderTimeline,
  describeNextOrderForSales,
  formatLeadTimeForSales,
} from "./sales-supplier-insight";
import type { WeekDayPlan } from "./summary-workspace";
import type { SupplierWithSchedule } from "@/types/database";

function supplier(next: string | null, extra: Partial<SupplierWithSchedule> = {}) {
  return {
    id: "s1",
    name: "Test",
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
    order_on_demand: false,
    schedule: next
      ? {
          id: "sch",
          supplier_id: "s1",
          order_date: null,
          shift_date: null,
          computed_next_date: next,
          vacation_note: null,
        }
      : null,
    ...extra,
  } as SupplierWithSchedule;
}

describe("sales-supplier-insight", () => {
  it("opisuje zamówienie na żądanie", () => {
    const insight = buildSalesSupplierInsight(
      supplier(null, { order_on_demand: true }),
      [],
      undefined
    );
    expect(describeNextOrderForSales(insight).primary).toContain("żądanie");
  });

  it("formatuje interwał zamówień dla handlowca (raz na N tyg.)", () => {
    const insight = buildSalesSupplierInsight(supplier("2026-05-15"), [], undefined);
    expect(insight.orderIntervalLabel).toBe("raz na 2 tyg.");

    const weekly = buildSalesSupplierInsight(
      supplier("2026-05-15", { interval_raw: "1", interval_weeks: 1 }),
      [],
      undefined
    );
    expect(weekly.orderIntervalLabel).toBe("co tydzień");
  });

  it("formatuje datę poza tygodniem", () => {
    const insight = buildSalesSupplierInsight(
      supplier("2026-06-20"),
      [],
      undefined
    );
    expect(describeNextOrderForSales(insight).primary).toContain("20.06");
  });

  it("deduplikuje dostawców w osi tygodnia", () => {
    const days: WeekDayPlan[] = [
      {
        dateKey: "2026-05-15",
        weekdayLabel: "Pt",
        dateLabel: "15.05",
        isToday: true,
        isPast: false,
        items: [
          {
            kind: "standard",
            supplierId: "a",
            supplierName: "A",
            flaggedName: "A",
            location: "POLSKA",
            nextDate: new Date(2026, 4, 15),
            vacationNote: null,
            notes: "",
            shift: "-",
            status: "-",
            sourceSheet: "POLSKA",
            scheduleId: "1",
          },
          {
            kind: "standard",
            supplierId: "a",
            supplierName: "A",
            flaggedName: "A",
            location: "POLSKA",
            nextDate: new Date(2026, 4, 15),
            vacationNote: null,
            notes: "",
            shift: "-",
            status: "-",
            sourceSheet: "POLSKA",
            scheduleId: "2",
          },
        ],
      },
    ];
    expect(buildWeekOrderTimeline(days)[0].suppliers).toHaveLength(1);
  });

  it("formatuje średni czas łącznie", () => {
    const lead = formatLeadTimeForSales(
      {
        supplier_id: "s1",
        main_sum: 20,
        main_count: 4,
        main_avg: 5,
        side_sum: 10,
        side_count: 2,
        side_avg: 5,
      },
      "LACZNIE"
    );
    expect(lead.leadTimeSummary).toContain("~5");
  });
});
