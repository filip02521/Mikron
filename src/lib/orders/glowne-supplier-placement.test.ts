import { describe, expect, it } from "vitest";
import { glowneScheduleSupplierIds } from "./glowne-supplier-placement";

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
