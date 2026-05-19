import { describe, it, expect } from "vitest";
import { buildSummaryWorkspace } from "./summary-workspace";
import type { SupplierWithSchedule } from "@/types/database";

function supplier(
  id: string,
  name: string,
  nextDate: string
): SupplierWithSchedule {
  return {
    id,
    name,
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "MAILOWO",
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
      order_date: null,
      shift_date: null,
      computed_next_date: nextDate,
      vacation_note: null,
    },
  } as SupplierWithSchedule;
}

describe("buildSummaryWorkspace — Ten tydzień", () => {
  it("pokazuje zamówienia na dziś w kolumnie dnia i na liście zaległych", () => {
    const today = new Date(2026, 4, 15); // piątek 15.05.2026
    const todayStr = "2026-05-15";

    const ws = buildSummaryWorkspace(
      [
        supplier("a", "Dostawca A", todayStr),
        supplier("b", "Dostawca B", todayStr),
        supplier("c", "Dostawca C", todayStr),
        supplier("d", "Dostawca D", "2026-05-18"),
      ],
      [],
      today
    );

    const todayColumn = ws.thisWeekDays.find((d) => d.dateKey === todayStr);
    expect(todayColumn?.items).toHaveLength(3);
    expect(ws.left.filter((i) => i.kind === "standard")).toHaveLength(3);
  });

  it("pokazuje zaległe w kolumnie dziś planu tygodnia", () => {
    const today = new Date(2026, 4, 15);
    const todayStr = "2026-05-15";

    const ws = buildSummaryWorkspace(
      [supplier("overdue", "Zaległy dostawca", "2026-05-14")],
      [],
      today
    );

    const todayColumn = ws.thisWeekDays.find((d) => d.dateKey === todayStr);
    expect(todayColumn?.items.some((i) => i.supplierName === "Zaległy dostawca")).toBe(
      true
    );
    expect(ws.left.filter((i) => i.kind === "standard")).toHaveLength(1);
  });

  it("wyklucza dostawców w razie potrzeby z harmonogramu", () => {
    const today = new Date(2026, 4, 15);
    const todayStr = "2026-05-15";
    const onDemand = supplier("od", "Na żądanie", todayStr);
    onDemand.stock_raw = "W RAZIE POTRZEBY";
    onDemand.order_on_demand = true;

    const ws = buildSummaryWorkspace(
      [supplier("cyc", "Cykliczny", todayStr), onDemand],
      [],
      today
    );

    expect(ws.onDemandSuppliers).toHaveLength(1);
    expect(ws.onDemandSuppliers[0]?.supplierName).toBe("Na żądanie");
    expect(ws.left.filter((i) => i.kind === "standard")).toHaveLength(1);
    expect(ws.thisWeekDays.find((d) => d.dateKey === todayStr)?.items).toHaveLength(1);
  });
});
