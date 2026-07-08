import { describe, expect, it } from "vitest";
import {
  batchInformacjaConfirmMessage,
  batchNotifyButtonLabel,
  batchDeliveryConfirmMessage,
  countSalesPeopleInOrders,
  formatDeliveryBatchToast,
  requiresQueueBatchConfirm,
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
      emailQueued: 2,
      errors: [],
    });
    expect(t.title).toBe("Zapisano dostawę");
    expect(t.text).toContain("2 powiadomienia");
    expect(t.text).toContain("Zaplanowano");
    expect(t.tone).toBe("success");
    expect(t.durationMs).toBeUndefined();
  });

  it("formatDeliveryBatchToast — błąd e-maila wydłuża toast", () => {
    const t = formatDeliveryBatchToast({
      saved: 1,
      emailSent: 0,
      errors: [],
      emailError: "Resend timeout",
    });
    expect(t.tone).toBe("error");
    expect(t.title).toBe("Zapisano dostawę z uwagami");
    expect(t.text).toContain("E-mail");
    expect(t.durationMs).toBe(15_000);
  });

  it("selectedSaveButtonLabel", () => {
    expect(selectedSaveButtonLabel(3)).toBe("Zapisz zaznaczone (3)");
  });

  it("requiresQueueBatchConfirm — tylko grupowe akcje", () => {
    expect(requiresQueueBatchConfirm([])).toBe(false);
    expect(requiresQueueBatchConfirm(["a"])).toBe(false);
    expect(requiresQueueBatchConfirm(["a", "b"])).toBe(true);
  });

  it("batchDeliveryConfirmMessage — pełna dostawa grupy", () => {
    const orders = [o("1", "p1", "A"), o("2", "p2", "A")];
    const msg = batchDeliveryConfirmMessage(orders, ["1", "2"], { fullQuantity: true });
    expect(msg).toContain("2 pozycje");
    expect(msg).toContain("pełna zamówiona ilość");
    expect(msg).toContain("2 handlowców");
  });

  it("batchDeliveryConfirmMessage — zęby, wpisane ilości", () => {
    const orders = [o("1", "p1", "A"), o("2", "p2", "A")];
    const msg = batchDeliveryConfirmMessage(orders, ["1", "2"], { teethHandover: true });
    expect(msg).toContain("wpisana w tabeli linii");
    expect(msg).not.toContain("Dost.");
    expect(msg).toContain("bez e-maila");
  });

  it("batchInformacjaConfirmMessage — wiele osób", () => {
    const orders = [o("1", "p1", "A"), o("2", "p2", "A")];
    const msg = batchInformacjaConfirmMessage(orders, ["1", "2"]);
    expect(msg).toContain("2 pozycje");
    expect(msg).toContain("2 handlowców");
  });
});
