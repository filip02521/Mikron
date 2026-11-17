import { describe, expect, it } from "vitest";
import { orderEventTitle } from "@/components/serwis/service-order-view";
import type { ServiceOrderEvent } from "@/lib/orders/service-orders";

const ev = (type: ServiceOrderEvent["type"], note: string): ServiceOrderEvent => ({
  id: 1,
  orderId: "o",
  at: "2026-11-06T10:00:00Z",
  type,
  fromStatus: null,
  toStatus: null,
  note,
  actorName: null,
});

describe("orderEventTitle", () => {
  it("faktura, usunięcie faktury i czekanie mają treść z notatki", () => {
    expect(orderEventTitle(ev("invoice", "FS 12/M/11/2026"))).toBe("Faktura FS 12/M/11/2026");
    expect(orderEventTitle(ev("invoice", "Bez faktury: naprawa gwarancyjna"))).toBe("Bez faktury: naprawa gwarancyjna");
    expect(orderEventTitle(ev("invoice_cleared", "FS 12/M/11/2026"))).toBe("Usunięto fakturę (FS 12/M/11/2026)");
    expect(orderEventTitle(ev("waiting_part", "2 szt. SYM-1"))).toBe("Czeka na: 2 szt. SYM-1");
  });

  it("bez notatki nie zostawia pustych nawiasów ani dwukropka", () => {
    expect(orderEventTitle(ev("invoice_cleared", ""))).toBe("Usunięto fakturę");
    expect(orderEventTitle(ev("waiting_part", ""))).toBe("Czeka na część");
    expect(orderEventTitle(ev("invoice", ""))).toBe("Faktura");
  });
});
