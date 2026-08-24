import { describe, expect, it } from "vitest";
import {
  buildSalesSupplierInsight,
  describeNextOrderForSales,
  formatLeadTimeForSales,
} from "./sales-supplier-insight";
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
    expect(describeNextOrderForSales(insight).secondary).toMatch(/Zgłoś prośbę/);
    expect(
      describeNextOrderForSales(insight, { readOnlyPreview: true }).secondary
    ).not.toMatch(/Zgłoś/);
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

  it("bez otwartej prośby zębowej nie buduje teethLine", () => {
    const insight = buildSalesSupplierInsight(supplier("2026-08-26"), [], undefined, {
      todayKey: "2026-08-24",
      hasOpenTeethRequest: false,
      teethSchedule: {
        id: "t1",
        supplier_id: "s1",
        computed_next_date: "2026-08-28",
        delivery_lead_business_days: 3,
      } as unknown as import("@/types/database").TeethSupplierSchedule,
    });
    expect(insight.teethLine).toBeNull();
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

  it("nie liczy ETA przy na żądanie; ustawia urlop i kontakt", () => {
    const insight = buildSalesSupplierInsight(
      supplier(null, {
        order_on_demand: true,
        mails: "kontakt@firma.pl",
        schedule: {
          id: "sch",
          supplier_id: "s1",
          order_date: "2026-07-01",
          shift_date: "2026-09-01",
          computed_next_date: null,
          vacation_note: null,
        },
      }),
      [],
      {
        supplier_id: "s1",
        main_sum: 20,
        main_count: 4,
        main_avg: 5,
        side_sum: 0,
        side_count: 0,
        side_avg: null,
      },
      {
        todayKey: "2026-08-24",
        vacationWindow: { startDate: "2026-08-20", endDate: "2026-08-30" },
      }
    );
    expect(insight.arrivalEta).toBeNull();
    expect(insight.onVacationNow).toBe(true);
    expect(insight.contactEmail).toBe("kontakt@firma.pl");
    expect(insight.lastOrderLabel).toContain("01.07");
    expect(insight.activeShift).toBe(true);
  });

  it("overdue i ETA względem todayKey (nie zegara systemowego)", () => {
    const insight = buildSalesSupplierInsight(
      supplier("2026-08-10"),
      [],
      {
        supplier_id: "s1",
        main_sum: 10,
        main_count: 2,
        main_avg: 2,
        side_sum: 0,
        side_count: 0,
        side_avg: null,
      },
      { todayKey: "2026-08-24" }
    );
    expect(insight.isOverdue).toBe(true);
    expect(insight.arrivalEta?.dateKey).toBeTruthy();
    expect(insight.arrivalEta!.dateKey >= "2026-08-24").toBe(true);
  });

  it("teethLine z historią gdy podano label", () => {
    const insight = buildSalesSupplierInsight(
      supplier("2026-08-26"),
      [],
      undefined,
      {
        todayKey: "2026-08-24",
        hasOpenTeethRequest: true,
        teethSchedule: {
          id: "t1",
          supplier_id: "s1",
          order_date: null,
          shift_date: null,
          computed_next_date: "2026-08-28",
          vacation_note: null,
          delivery_lead_business_days: null,
        } as unknown as import("@/types/database").TeethSupplierSchedule,
        teethHistoryEtaLabel: "ok. 04.09.2026 · ~5 dni rob.",
      }
    );
    expect(insight.teethLine?.nextOrderLabel).toContain("28.08");
    expect(insight.teethLine?.etaLabel).toContain("04.09");
  });
});
