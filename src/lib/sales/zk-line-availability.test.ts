import { describe, expect, it } from "vitest";
import type { ProsbaAlreadyOrderedInfo, ProsbaIncoming } from "@/lib/orders/prosba-already-ordered";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";
import { assessZkLineAvailability, countZkLineAvailability } from "./zk-line-availability";

const TODAY = "2026-11-03";
const stock = (available: number): ProsbaLineStockSnapshot => ({ onHand: available, reserved: 0, available, source: "subiekt" });
const inc = (over: Partial<ProsbaIncoming> = {}): ProsbaIncoming => ({
  incoming: 20,
  available: 0,
  zkWaiting: 0,
  freeIncoming: 20,
  docs: [{ dokNr: "ZD 412/10/2026", issued: null, deadline: "2026-11-14", qty: 20 }],
  ...over,
});
const info = (incoming: ProsbaIncoming | null, own: ProsbaAlreadyOrderedInfo["own"] = []): ProsbaAlreadyOrderedInfo => ({ own, incoming });

describe("assessZkLineAvailability", () => {
  it("on stock wins over everything", () => {
    const a = assessZkLineAvailability({ quantity: 2, stock: stock(5), info: info(inc()), todayKey: TODAY });
    expect(a).toMatchObject({ kind: "stock", badge: "Na stanie", tone: "success", bar: { stock: 1, need: 0 } });
    expect(a.incomingFact).toBeNull();
    expect(a.docs).toEqual([]);
  });

  it("a request linked to this ZK means already ordered", () => {
    const ordered = { id: "o", phase: "ordered" as const, createdAt: "2026-10-27T10:00:00Z", orderedAt: "2026-10-28T10:00:00Z", quantity: 3, deliveredQuantity: 0, supplierName: null };
    const a = assessZkLineAvailability({ quantity: 3, stock: stock(0), info: info(null, [ordered]), zkCoverage: "open", todayKey: TODAY });
    expect(a).toMatchObject({ kind: "ordered", badge: "Już zamówione", chip: "Zamówione 28.10", requestFact: "zamówiona u dostawcy 28.10", bar: { ordered: 1 } });
    expect(assessZkLineAvailability({ quantity: 3, stock: stock(5), info: undefined, zkCoverage: "delivered" })).toMatchObject({
      kind: "ordered",
      chip: "Dostarczone",
      tone: "success",
    });
  });

  it("own request outside this ZK does not cover the line, it only warns", () => {
    const elsewhere = { id: "x", phase: "pending" as const, createdAt: "2026-10-30T10:00:00Z", orderedAt: null, quantity: 2, deliveredQuantity: 0, supplierName: null };
    const a = assessZkLineAvailability({ quantity: 3, stock: stock(0), info: info(null, [elsewhere]), zkCoverage: "uncovered", todayKey: TODAY });
    expect(a).toMatchObject({ kind: "need", badge: "Brak", requestFact: "czeka u zakupów od 30.10" });
    expect(a.note).toMatch(/spoza tego ZK/);
  });

  it("dated ZD covering the rest is in transit, split with the shelf", () => {
    const a = assessZkLineAvailability({ quantity: 10, stock: stock(2), info: info(inc()), todayKey: TODAY });
    expect(a.kind).toBe("transit");
    expect(a.badge).toBe("W drodze · do 14.11");
    expect(a.chip).toBe("14.11");
    expect(a.bar.stock).toBeCloseTo(0.2);
    expect(a.bar.transit).toBeCloseTo(0.8);
    expect(a.incomingFact).toMatch(/^20 szt\., wolne dla tego ZK/);
  });

  it("covered without a dated ZD still needs a decision", () => {
    const a = assessZkLineAvailability({
      quantity: 2,
      stock: stock(0),
      info: info(inc({ docs: [{ dokNr: "ZD 1", issued: null, deadline: null, qty: 20 }] })),
      todayKey: TODAY,
    });
    expect(a).toMatchObject({ kind: "need", badge: "W drodze bez terminu", chip: "Bez terminu", tone: "warning" });
  });

  it("delivery taken by other ZK and nothing incoming", () => {
    expect(
      assessZkLineAvailability({ quantity: 2, stock: stock(0), info: info(inc({ incoming: 6, zkWaiting: 8, freeIncoming: 0 })), todayKey: TODAY }).badge
    ).toBe("Zajęte przez inne ZK");
    expect(assessZkLineAvailability({ quantity: 2, stock: stock(0), info: info(null), todayKey: TODAY })).toMatchObject({
      kind: "need",
      badge: "Brak",
      bar: { need: 1 },
    });
  });

  it("no data or exempt product is unknown", () => {
    expect(assessZkLineAvailability({ quantity: 2, stock: undefined, info: undefined }).badge).toBe("Bez danych z Subiekta");
    expect(assessZkLineAvailability({ quantity: 2, stock: stock(0), info: undefined, stockExempt: true }).kind).toBe("unknown");
  });

  it("counts lines per state", () => {
    expect(countZkLineAvailability([{ kind: "stock" }, { kind: "need" }, { kind: "need" }])).toEqual({
      stock: 1,
      transit: 0,
      ordered: 0,
      need: 2,
      unknown: 0,
    });
  });
});
