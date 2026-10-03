import { describe, expect, it } from "vitest";
import {
  businessToCalendarDays,
  resolveZdOrderHorizon,
  zdDeliveryRisk,
} from "@/lib/orders/zd-order-horizon";

// 2026-10-05 to poniedziałek.
const MONDAY = "2026-10-05";

describe("businessToCalendarDays", () => {
  it("5 dni roboczych od poniedziałku = 7 dni kalendarzowych", () => {
    expect(businessToCalendarDays(MONDAY, 5)).toBe(7);
  });
  it("uwzględnia święta (11.11 - wtorek)", () => {
    // pon 10.11 + 2 dni robocze: 11.11 święto → 12.11, 13.11 = 3 dni kalendarzowe.
    expect(businessToCalendarDays("2026-11-10", 2)).toBe(3);
  });
});

describe("resolveZdOrderHorizon", () => {
  const base = {
    todayKey: MONDAY,
    stockDays: 30,
    onDemand: false,
    nextOrderDate: "2026-10-26",
    interval: { unit: "weeks" as const, value: 3 },
    lead: { p50: 5, p90: 15, nOrders: 8 },
  };

  it("horyzont = do następnego zamówienia + p90 dostawy, gdy dłuższy niż zapas", () => {
    const h = resolveZdOrderHorizon(base);
    expect(h).toEqual(
      expect.objectContaining({
        leadSource: "p90",
        leadBusinessDays: 15,
        leadDays: 21,
        nextOrderDays: 21,
        nextOrderSource: "schedule",
        horizonDays: 42,
        extendedByDays: 12,
      })
    );
  });

  it("zapas z karty jest minimum - krótka dostawa nie skraca zamówienia", () => {
    const h = resolveZdOrderHorizon({
      ...base,
      stockDays: 60,
      lead: { p50: 2, p90: 3, nOrders: 6 },
    });
    expect(h.horizonDays).toBe(60);
    expect(h.extendedByDays).toBe(0);
  });

  it("mniej niż 5 dostaw → p50; bez próbek → 7 dni", () => {
    expect(resolveZdOrderHorizon({ ...base, lead: { p50: 4, p90: null, nOrders: 3 } }).leadSource).toBe("p50");
    const none = resolveZdOrderHorizon({ ...base, lead: null });
    expect(none).toEqual(expect.objectContaining({ leadSource: "default", leadDays: 7 }));
  });

  it("plan wypada dziś → kolejne zamówienie z interwału", () => {
    const h = resolveZdOrderHorizon({ ...base, nextOrderDate: MONDAY });
    expect(h).toEqual(
      expect.objectContaining({ nextOrderSource: "interval", nextOrderDate: "2026-10-26", nextOrderDays: 21 })
    );
  });

  it("na żądanie → bez kolejnego zamówienia (N = 0)", () => {
    const h = resolveZdOrderHorizon({ ...base, onDemand: true });
    expect(h).toEqual(expect.objectContaining({ nextOrderSource: "on_demand", nextOrderDays: 0 }));
    expect(h.horizonDays).toBe(30);
  });
});

describe("zdDeliveryRisk", () => {
  const horizon = { leadDays: 10, nextOrderDays: 14 };
  it("skończy się przed dostawą zamówienia złożonego dziś", () => {
    expect(zdDeliveryRisk({ daysOfCoverWithIncoming: 6, horizon })).toBe("before_delivery");
  });
  it("skończy się przed dostawą z kolejnego planowego zamówienia", () => {
    expect(zdDeliveryRisk({ daysOfCoverWithIncoming: 20, horizon })).toBe("before_next_delivery");
  });
  it("starczy do kolejnej dostawy / brak sprzedaży", () => {
    expect(zdDeliveryRisk({ daysOfCoverWithIncoming: 30, horizon })).toBeNull();
    expect(zdDeliveryRisk({ daysOfCoverWithIncoming: null, horizon })).toBeNull();
  });
});
