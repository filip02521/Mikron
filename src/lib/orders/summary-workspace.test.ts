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
    order_on_demand: false,
    is_active: true,
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

  it("uzupełnia supplierMeta z joina zamówienia gdy brak w aktywnym harmonogramie", () => {
    const today = new Date(2026, 4, 15);
    const ws = buildSummaryWorkspace(
      [],
      [
        {
          id: "so1",
          supplier_id: "inactive-1",
          sales_person_id: "sp1",
          symbol: "X",
          products: "Towar",
          quantity: "-",
          delivered_quantity: "-",
          order_type: "Glowne",
          request_kind: "informacja",
          informacja_stock_out_reorder: true,
          status: "Nowe",
          action_at: "2026-05-15T10:00:00Z",
          ordered_at: null,
          delivery_at: null,
          supplier: {
            id: "inactive-1",
            name: "Nieaktywny SA",
            location: "POLSKA",
            pickup_mikran: false,
            pickup_pallet: false,
            notes: "",
            mails: "a@b.pl",
            extra_info: "",
            interval_raw: null,
            interval_weeks: null,
            stock_raw: null,
            stock: null,
            stats_mode: "LACZNIE",
            order_on_demand: false,
            is_active: false,
          },
          sales_person: { id: "sp1", name: "Jan" } as never,
        },
      ],
      today,
      [{ id: "sp1", name: "Jan" }]
    );

    expect(ws.stockOutLeft).toHaveLength(1);
    expect(ws.supplierMeta["inactive-1"]?.name).toBe("Nieaktywny SA");
    expect(ws.supplierMeta["inactive-1"]?.mails).toBe("a@b.pl");
    expect(ws.supplierMeta["inactive-1"]?.is_active).toBe(false);
  });

  it("nie nadpisuje supplierMeta z harmonogramu joinami zamówień", () => {
    const today = new Date(2026, 4, 15);
    const todayStr = "2026-05-15";
    const scheduled = supplier("a", "Z Harmonogramu", todayStr);
    scheduled.mails = "schedule@x.pl";

    const ws = buildSummaryWorkspace(
      [scheduled],
      [
        {
          id: "so1",
          supplier_id: "a",
          sales_person_id: "sp1",
          symbol: "X",
          products: "Towar",
          quantity: "-",
          delivered_quantity: "-",
          order_type: "Glowne",
          request_kind: "informacja",
          informacja_stock_out_reorder: true,
          status: "Nowe",
          action_at: "2026-05-15T10:00:00Z",
          ordered_at: null,
          delivery_at: null,
          supplier: {
            id: "a",
            name: "Z Zamówienia",
            location: "POLSKA",
            pickup_mikran: false,
            pickup_pallet: false,
            notes: "",
            mails: "order@x.pl",
            extra_info: "",
            interval_raw: null,
            interval_weeks: null,
            stock_raw: null,
            stock: null,
            stats_mode: "LACZNIE",
            order_on_demand: false,
            is_active: true,
          },
          sales_person: { id: "sp1", name: "Jan" } as never,
        },
      ],
      today,
      [{ id: "sp1", name: "Jan" }]
    );

    expect(ws.supplierMeta.a?.name).toBe("Z Harmonogramu");
    expect(ws.supplierMeta.a?.mails).toBe("schedule@x.pl");
    expect(ws.supplierMeta.a?.computed_next_date).toBe(todayStr);
  });
});
