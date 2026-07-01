import { describe, expect, it } from "vitest";
import { teethQueueOrderNeedsHeaderData } from "./teeth-queue-gate";
import type { IndividualOrder } from "@/types/database";

const base: IndividualOrder = {
  id: "1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "A",
  products: "Ząb",
  quantity: "1",
  delivered_quantity: "-",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Nowe",
  action_at: "2026-01-01",
  ordered_at: null,
  delivery_at: null,
  is_teeth: true,
};

describe("teethQueueOrderNeedsHeaderData", () => {
  it("wymaga kompletnych danych ogólnych prośby", () => {
    expect(teethQueueOrderNeedsHeaderData({ ...base, supplier_id: null })).toBe(true);
    expect(teethQueueOrderNeedsHeaderData(base)).toBe(false);
  });
});
