import { describe, expect, it } from "vitest";
import {
  INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT,
  INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE,
} from "@/lib/orders/informacja-flow-copy";

/** Długie etykiety statusów — nie mogą być skracane w UI (patrz MyOrderStatusPill). */
describe("MyOrderStatusPill labels", () => {
  it("najdłuższe statusy informacji mieszczą się w rozsądnej szerokości bez skrótu słowa", () => {
    const labels = [
      INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE.statusTitle,
      INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusTitle,
      "Przed zamówieniem",
    ];
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(12);
      expect(label).not.toMatch(/\.\.\.$/);
    }
  });
});
