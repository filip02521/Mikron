import { describe, expect, it } from "vitest";
import {
  buildDeliveryNotificationItem,
  buildInformacjaNotificationItem,
  buildProcurementCancelNotificationItem,
} from "@/lib/email/sales-notification-items";

describe("sales notification items", () => {
  it("buildDeliveryNotificationItem — pełna dostawa", () => {
    const item = buildDeliveryNotificationItem(
      {
        supplier: { name: "Dostawca X" },
        products: "Wkręt",
        symbol: "A-1",
        sales_client_name: "Kowalski",
        quantity: "5",
        delivered_quantity: "5",
        status: "Zrealizowane",
      },
      { deliveredQuantity: "5" }
    );
    expect(item.deliveryKind).toBe("complete");
    expect(item.orderedQty).toBe(5);
    expect(item.deliveredQty).toBe(5);
    expect(item.clientName).toBe("Kowalski");
  });

  it("buildDeliveryNotificationItem — częściowa", () => {
    const item = buildDeliveryNotificationItem({
      supplier: { name: "D" },
      products: "P",
      symbol: "-",
      sales_client_name: null,
      quantity: "10",
      delivered_quantity: "3",
      status: "Czesciowo_zrealizowane",
    });
    expect(item.deliveryKind).toBe("partial");
    expect(item.deliveredQty).toBe(3);
  });

  it("buildInformacjaNotificationItem", () => {
    const item = buildInformacjaNotificationItem({
      supplier: { name: "D" },
      products: "P",
      symbol: "SYM",
      sales_client_name: "Jan",
      quantity: "-",
      delivered_quantity: "-",
      status: "Zrealizowane",
    });
    expect(item.kind).toBe("informacja");
    expect(item.symbol).toBe("SYM");
  });

  it("pusty opis produktu → em dash", () => {
    const item = buildDeliveryNotificationItem({
      supplier: { name: "D" },
      products: "   ",
      symbol: "-",
      sales_client_name: null,
      quantity: "1",
      delivered_quantity: "1",
      status: "Zrealizowane",
    });
    expect(item.products).toBe("—");
  });

  it("buildProcurementCancelNotificationItem", () => {
    const item = buildProcurementCancelNotificationItem({
      supplier: { name: "Dostawca" },
      products: "Wkręt",
      symbol: "SYM",
      sales_client_name: "Jan",
      quantity: "5",
      delivered_quantity: "-",
      status: "Anulowane",
      procurement_cancel_note: "  brak towaru  ",
    });
    expect(item.kind).toBe("procurement_cancel");
    expect(item.symbol).toBe("SYM");
    expect(item.procurementCancelNote).toBe("brak towaru");
    expect(item.clientName).toBe("Jan");
  });
});
