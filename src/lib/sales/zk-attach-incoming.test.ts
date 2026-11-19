import { describe, expect, it } from "vitest";
import type { ProsbaAlreadyOrderedInfo, ProsbaIncoming } from "@/lib/orders/prosba-already-ordered";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";
import { selectZkLinesToAttachIncoming } from "./zk-attach-incoming";

const TODAY = "2026-11-03";

function incoming(over: Partial<ProsbaIncoming> = {}): ProsbaIncoming {
  return {
    incoming: 20,
    available: 0,
    zkWaiting: 0,
    freeIncoming: 20,
    docs: [{ dokNr: "ZD 412/10/2026", issued: "2026-10-20", deadline: "2026-11-14", qty: 20, dokId: 412, supplierId: "sup-1" }],
    ...over,
  };
}

function info(inc: ProsbaIncoming | null, own: ProsbaAlreadyOrderedInfo["own"] = []): ProsbaAlreadyOrderedInfo {
  return { own, incoming: inc };
}

const noStock: ProsbaLineStockSnapshot = { onHand: 0, reserved: 0, available: 0, source: "subiekt" };

describe("selectZkLinesToAttachIncoming", () => {
  it("picks a line fully covered by a dated ZD", () => {
    const out = selectZkLinesToAttachIncoming({
      lines: [{ key: "1", subiektTwId: 10, quantity: 8 }],
      stockByTwId: { 10: noStock },
      incomingByTwId: { 10: info(incoming()) },
      todayKey: TODAY,
    });
    expect(out).toEqual([
      { key: "1", subiektTwId: 10, quantity: 8, doc: expect.objectContaining({ dokNr: "ZD 412/10/2026", supplierId: "sup-1" }) },
    ]);
  });

  it("skips lines on stock, excluded, exempt, with own open request or without dated ZD", () => {
    const out = selectZkLinesToAttachIncoming({
      lines: [
        { key: "stock", subiektTwId: 1, quantity: 2 },
        { key: "marked", subiektTwId: 2, quantity: 2 },
        { key: "teeth", subiektTwId: 3, quantity: 2 },
        { key: "own", subiektTwId: 4, quantity: 2 },
        { key: "nodate", subiektTwId: 5, quantity: 2 },
        { key: "past", subiektTwId: 6, quantity: 2 },
        { key: "noqty", subiektTwId: 7, quantity: null },
      ],
      stockByTwId: {
        1: { onHand: 5, reserved: 0, available: 5, source: "subiekt" },
        2: noStock, 3: noStock, 4: noStock, 5: noStock, 6: noStock, 7: noStock,
      },
      incomingByTwId: {
        1: info(incoming()),
        2: info(incoming()),
        3: info(incoming()),
        4: info(incoming(), [{ id: "o1", phase: "pending", createdAt: "2026-11-01", orderedAt: null, quantity: 2, deliveredQuantity: 0, supplierName: null }]),
        5: info(incoming({ docs: [{ dokNr: "ZD 1", issued: null, deadline: null, qty: 20, supplierId: "sup-1" }] })),
        6: info(incoming({ docs: [{ dokNr: "ZD 2", issued: null, deadline: "2026-10-01", qty: 20, supplierId: "sup-1" }] })),
        7: info(incoming()),
      },
      excludeKeys: new Set(["marked"]),
      stockExemptTwIds: new Set([3]),
      todayKey: TODAY,
    });
    expect(out).toEqual([]);
  });

  it("does not take delivery already waited for by other ZK", () => {
    const out = selectZkLinesToAttachIncoming({
      lines: [{ key: "1", subiektTwId: 10, quantity: 2 }],
      stockByTwId: { 10: noStock },
      // 6 w drodze; ZK bez rezerwacji = 8, w tym 2 z tego ZK → cudze 6 zabierają całą dostawę.
      incomingByTwId: { 10: info(incoming({ incoming: 6, zkWaiting: 8, freeIncoming: 0 })) },
      todayKey: TODAY,
    });
    expect(out).toEqual([]);
  });

  it("lets several lines of one product share the delivery cumulatively", () => {
    const out = selectZkLinesToAttachIncoming({
      lines: [
        { key: "a", subiektTwId: 10, quantity: 12 },
        { key: "b", subiektTwId: 10, quantity: 12 },
      ],
      stockByTwId: { 10: noStock },
      incomingByTwId: { 10: info(incoming()) },
      todayKey: TODAY,
    });
    expect(out.map((c) => c.key)).toEqual(["a"]);
  });

  it("requires a known supplier when asked", () => {
    const base = {
      lines: [{ key: "1", subiektTwId: 10, quantity: 2 }],
      stockByTwId: { 10: noStock },
      incomingByTwId: {
        10: info(incoming({ docs: [{ dokNr: "ZD 9", issued: null, deadline: "2026-11-20", qty: 20, supplierId: null }] })),
      },
      todayKey: TODAY,
    };
    expect(selectZkLinesToAttachIncoming(base)).toHaveLength(1);
    expect(selectZkLinesToAttachIncoming({ ...base, requireSupplier: true })).toEqual([]);
  });
});

describe("appendZkAttachIncomingNote", () => {
  const base = { code: "created" as const, title: "Zakres zapisany", message: "Zapisano.", tone: "success" as const };

  it("adds the attached count with Polish plural", async () => {
    const { appendZkAttachIncomingNote } = await import("./zk-watch-auto-prosba-copy");
    expect(appendZkAttachIncomingNote(base, { attached: 1 }).message).toBe(
      "Zapisano. 1 pozycję podpięto pod dostawę w drodze - w Moje jest jako zamówione."
    );
    expect(appendZkAttachIncomingNote(base, { attached: 3 }).message).toContain("3 pozycje podpięto");
    expect(appendZkAttachIncomingNote(base, { attached: 0 })).toBe(base);
  });

  it("turns an error into a warning with the reason", async () => {
    const { appendZkAttachIncomingNote } = await import("./zk-watch-auto-prosba-copy");
    const out = appendZkAttachIncomingNote(base, { attached: 0, error: "Subiekt nie odpowiada." });
    expect(out.tone).toBe("warning");
    expect(out.message).toContain("Subiekt nie odpowiada.");
  });
});

describe("appendZkAttachIncomingNote — rejected lines", () => {
  it("warns about lines the server did not attach", async () => {
    const { appendZkAttachIncomingNote } = await import("./zk-watch-auto-prosba-copy");
    const base = { code: "created" as const, title: "Zakres zapisany", message: "Zapisano.", tone: "success" as const };
    const out = appendZkAttachIncomingNote(base, { attached: 1, notAttached: 1 });
    expect(out.tone).toBe("warning");
    expect(out.message).toContain("1 pozycję podpięto");
    expect(out.message).toContain("1 pozycji nie udało się podpiąć");
  });
});
