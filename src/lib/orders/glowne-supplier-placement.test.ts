import { describe, expect, it } from "vitest";
import { glowneScheduleSupplierIds, glowneSchedulableSupplierIds } from "./glowne-supplier-placement";

describe("glowneScheduleSupplierIds", () => {
  it("Główne — zamówienie i stock_out przesuwają harmonogram, via_panel nie", () => {
    const ids = glowneScheduleSupplierIds(
      [
        {
          supplier_id: "s1",
          request_kind: "zamowienie",
          informacja_queue_via_daily_panel: false,
        },
        {
          supplier_id: "s2",
          request_kind: "informacja",
          informacja_queue_via_daily_panel: true,
        },
        {
          supplier_id: "s3",
          request_kind: "informacja",
          informacja_queue_via_daily_panel: false,
          informacja_stock_out_reorder: true,
        } as never,
      ],
      "GLOWNE"
    );
    expect([...ids].sort()).toEqual(["s1", "s3"]);
  });

  it("Uzupełniające i Anulowano — bez przesunięcia harmonogramu", () => {
    const row = {
      supplier_id: "s1",
      request_kind: "zamowienie" as const,
      informacja_queue_via_daily_panel: false,
    };
    expect(glowneScheduleSupplierIds([row], "POBOCZNE").size).toBe(0);
    expect(glowneScheduleSupplierIds([row], "ANULOWANO").size).toBe(0);
  });
});

describe("glowneSchedulableSupplierIds", () => {
  it("pomija dostawców na żądanie — Główne bez przesunięcia harmonogramu", () => {
    const candidates = new Set(["s-cycle", "s-demand-flag", "s-demand-text"]);
    const schedulable = glowneSchedulableSupplierIds(candidates, [
      { id: "s-cycle", order_on_demand: false, interval_raw: "co 2 tygodnie" },
      { id: "s-demand-flag", order_on_demand: true, interval_raw: "co 2 tygodnie" },
      {
        id: "s-demand-text",
        order_on_demand: false,
        interval_raw: "W RAZIE POTRZEBY",
      },
    ]);
    expect([...schedulable]).toEqual(["s-cycle"]);
  });

  it("pomija nieznanych dostawców — brak wymuszenia interwału przy braku rekordu", () => {
    const schedulable = glowneSchedulableSupplierIds(
      new Set(["missing", "s-cycle"]),
      [{ id: "s-cycle", order_on_demand: false, interval_raw: "co 2 tygodnie" }]
    );
    expect([...schedulable]).toEqual(["s-cycle"]);
  });
});
