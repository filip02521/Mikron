import { describe, expect, it } from "vitest";
import {
  stockOutBadgeTitle,
  stockOutBadgesByTwId,
  stockOutSignalsCoveredByZd,
  type ActiveStockOutSignal,
} from "./stock-out-signals";

const signal = (over: Partial<ActiveStockOutSignal> = {}): ActiveStockOutSignal => ({
  orderId: "o1",
  twId: 10,
  // 18.11 23:30 w Warszawie = 22:30 UTC — dzień zgłoszenia liczony po warszawsku.
  createdAt: "2026-11-18T22:30:00Z",
  salesPersonName: "Anna",
  supplierId: "s1",
  ...over,
});

const zd = (issued: string | null, dokNr = "ZD 1/11/2026") => ({ dokNr, issued, deadline: null, qty: null, supplierId: "s9" });

describe("stockOutSignalsCoveredByZd", () => {
  it("ZD z dnia zgłoszenia albo późniejsze zamyka zgłoszenie", () => {
    const docs = new Map([[10, [zd("2026-11-18")]]]);
    expect(stockOutSignalsCoveredByZd([signal({ createdAt: "2026-11-18T09:00:00Z" })], docs)).toEqual([
      { orderId: "o1", dokNr: "ZD 1/11/2026", supplierId: "s9" },
    ]);
  });

  it("starsze ZD nie zamyka — towar był w drodze, a handlowiec i tak zgłosił brak", () => {
    const docs = new Map([[10, [zd("2026-11-17")]]]);
    expect(stockOutSignalsCoveredByZd([signal()], docs)).toEqual([]);
  });

  it("dzień zgłoszenia liczony w Warszawie: 22:30 UTC to jeszcze 18.11, 23:30 UTC to już 19.11", () => {
    expect(stockOutSignalsCoveredByZd([signal()], new Map([[10, [zd("2026-11-18")]]]))).toHaveLength(1);
    expect(
      stockOutSignalsCoveredByZd([signal({ createdAt: "2026-11-18T23:30:00Z" })], new Map([[10, [zd("2026-11-18")]]]))
    ).toHaveLength(0);
  });

  it("inny towar, ZD bez daty: nie zamyka", () => {
    expect(stockOutSignalsCoveredByZd([signal()], new Map([[11, [zd("2026-11-20")]]]))).toEqual([]);
    expect(stockOutSignalsCoveredByZd([signal()], new Map([[10, [zd(null)]]]))).toEqual([]);
  });
});

describe("stockOutBadgesByTwId", () => {
  it("liczy zgłoszenia, zbiera handlowców bez powtórzeń i najstarszy dzień", () => {
    const badges = stockOutBadgesByTwId([
      signal({ orderId: "a", createdAt: "2026-11-15T10:00:00Z" }),
      signal({ orderId: "b", salesPersonName: "Bartek", createdAt: "2026-11-12T10:00:00Z" }),
      signal({ orderId: "c", createdAt: "2026-11-16T10:00:00Z" }),
      signal({ orderId: "d", twId: 11 }),
    ]);
    expect(badges[10]).toEqual({ count: 3, salesPeople: ["Anna", "Bartek"], since: "2026-11-12" });
    expect(badges[11]?.count).toBe(1);
    expect(stockOutBadgeTitle(badges[10]!)).toContain("Anna, Bartek, od 12.11.2026");
  });
});
