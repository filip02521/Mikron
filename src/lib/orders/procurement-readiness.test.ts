import { describe, expect, it } from "vitest";
import {
  describeProcurementReadinessGaps,
  isIndividualOrderProcurementReady,
  procurementGateStatus,
} from "./procurement-readiness";
import type { IndividualOrder } from "@/types/database";

function order(extra: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s1",
    sales_person_id: "sp",
    symbol: "ABC",
    products: "Śruba",
    quantity: "2",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "zamowienie",
    status: "Nowe",
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...extra,
  };
}

describe("procurement-readiness", () => {
  it("wymaga dostawcy, produktu i ilości", () => {
    expect(isIndividualOrderProcurementReady(order())).toBe(true);
    expect(isIndividualOrderProcurementReady(order({ supplier_id: null }))).toBe(false);
    expect(describeProcurementReadinessGaps(order({ supplier_id: null }))).toContain(
      "dostawca"
    );
  });

  it("niekompletne → Weryfikacja", () => {
    expect(procurementGateStatus(order({ supplier_id: null }))).toBe("Weryfikacja");
    expect(procurementGateStatus(order())).toBe("Nowe");
  });

  it("uwzględnia kod Mikran przy gotowości do panelu dziennego", () => {
    const mikranOnly = order({
      symbol: "-",
      products: "-",
      mikran_code: "12345",
    });
    expect(isIndividualOrderProcurementReady(mikranOnly)).toBe(true);
    expect(describeProcurementReadinessGaps(mikranOnly)).toEqual([]);
  });
});
