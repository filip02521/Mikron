import { describe, expect, it } from "vitest";
import {
  filterWeekDaysBySupplierIds,
  matchSuppliersByQuery,
  matchSuppliersForSalesPlanSearch,
  SALES_PLAN_SEARCH_LIMIT,
  orderSalesPrioritySuppliers,
  pickPreviewSupplierIds,
  pickSalesPlanSupplierIds,
} from "./plan-preview";
import type { SupplierWithSchedule } from "@/types/database";
import type { WeekDayPlan } from "./summary-workspace";

function supplier(
  id: string,
  name: string,
  next: string | null
): SupplierWithSchedule {
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
    schedule: next
      ? {
          id: `s-${id}`,
          supplier_id: id,
          order_date: null,
          shift_date: null,
          computed_next_date: next,
          vacation_note: null,
        }
      : null,
  } as SupplierWithSchedule;
}

describe("plan-preview", () => {
  it("orderSalesPrioritySuppliers nie dopełnia listy harmonogramem", () => {
    const ordered = orderSalesPrioritySuppliers(
      [
        supplier("prio", "Priorytet", "2026-06-15"),
        supplier("near", "Bliski", "2026-05-01"),
        supplier("far", "Daleki", "2026-05-20"),
      ],
      ["prio"]
    );
    expect(ordered.map((s) => s.id)).toEqual(["prio"]);
  });

  it("pickSalesPlanSupplierIds preferuje dostawców z otwartych prośb", () => {
    const ids = pickSalesPlanSupplierIds(
      [
        supplier("prio", "Priorytet", "2026-06-15"),
        supplier("near", "Bliski", "2026-05-01"),
        supplier("far", "Daleki", "2026-05-20"),
      ],
      ["prio"],
      2
    );
    expect([...ids]).toEqual(["prio", "near"]);
  });

  it("pickPreviewSupplierIds wybiera najbliższe terminy", () => {
    const ids = pickPreviewSupplierIds(
      [
        supplier("c", "C", "2026-06-01"),
        supplier("a", "A", "2026-05-10"),
        supplier("b", "B", "2026-05-20"),
      ],
      2
    );
    expect([...ids]).toEqual(["a", "b"]);
  });

  it("matchSuppliersForSalesPlanSearch ogranicza liczbę wyników", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      supplier(`id-${i}`, `Dostawca ${i}`, null)
    );
    const hits = matchSuppliersForSalesPlanSearch(many, "dostawca");
    expect(hits).toHaveLength(SALES_PLAN_SEARCH_LIMIT);
  });

  it("matchSuppliersByQuery filtruje po fragmencie nazwy", () => {
    const hits = matchSuppliersByQuery(
      [supplier("1", "Abexim", null), supplier("2", "Inny", null)],
      "abex"
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe("Abexim");
  });

  it("filterWeekDaysBySupplierIds zawęża kolumny tygodnia", () => {
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
            scheduleId: "s1",
          },
          {
            kind: "standard",
            supplierId: "b",
            supplierName: "B",
            flaggedName: "B",
            location: "POLSKA",
            nextDate: new Date(2026, 4, 15),
            vacationNote: null,
            notes: "",
            shift: "-",
            status: "-",
            sourceSheet: "POLSKA",
            scheduleId: "s2",
          },
        ],
      },
    ];
    const filtered = filterWeekDaysBySupplierIds(days, new Set(["a"]));
    expect(filtered[0].items).toHaveLength(1);
    expect(filtered[0].items[0].supplierId).toBe("a");
  });
});
