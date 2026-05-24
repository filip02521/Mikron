import { describe, expect, it } from "vitest";
import {
  batchNotifyButtonLabel,
  countSalesPeopleInOrders,
  formatDeliveryBatchToast,
  selectedSaveButtonLabel,
} from "@/lib/orders/queue-batch-notify";
import type { IndividualOrder } from "@/types/database";

function o(
  id: string,
  personId: string,
  supplierName: string
): IndividualOrder {
  return {
    id,
    sales_person_id: personId,
    supplier: { name: supplierName },
  } as IndividualOrder;
}

describe("queue-batch-notify", () => {
  it("liczy handlowców w zaznaczeniu", () => {
    const orders = [
      o("1", "p1", "A"),
      o("2", "p1", "A"),
      o("3", "p2", "A"),
    ];
    expect(countSalesPeopleInOrders(orders, ["1", "2", "3"])).toBe(2);
    expect(countSalesPeopleInOrders(orders, ["1", "2"])).toBe(1);
  });

  it("etykieta grupy — jeden vs wielu handlowców", () => {
    const multi = [o("1", "p1", "A"), o("2", "p2", "B")];
    const single = [o("1", "p1", "A"), o("2", "p1", "A")];
    expect(batchNotifyButtonLabel(multi, ["1", "2"])).toContain("2 handlowców");
    expect(batchNotifyButtonLabel(single, ["1", "2"])).toContain("mail do handlowca");
  });

  it("formatDeliveryBatchToast — wiele maili", () => {
    const t = formatDeliveryBatchToast({
      saved: 5,
      emailSent: 2,
      errors: [],
    });
    expect(t.text).toContain("2 maile");
    expect(t.tone).toBe("success");
  });

  it("selectedSaveButtonLabel", () => {
    expect(selectedSaveButtonLabel(3)).toBe("Zapisz zaznaczone (3)");
  });
});
