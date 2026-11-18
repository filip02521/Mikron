import { describe, expect, it } from "vitest";
import { buildClientEquipmentCard, cardDeviceMatches } from "./client-equipment-card";
import type { ClientEquipmentItem } from "@/lib/subiekt/client-equipment-parse";
import type { SerialHistoryItem } from "@/lib/orders/service-orders";

// Dane wymyślone.
const item = (over: Partial<ClientEquipmentItem>): ClientEquipmentItem => ({
  twId: 1,
  symbol: "SILNIK-A",
  name: "Silnik A",
  serials: ["X20R2TEST001"],
  invoiceId: 10,
  invoiceNumber: "FS 10/M/01/2026",
  invoiceDate: "2026-01-15",
  ...over,
});
const order = (over: Partial<SerialHistoryItem>): SerialHistoryItem => ({
  id: "o1",
  number: "ZS/26/11/001",
  status: "w_naprawie",
  deviceName: "Silnik A",
  createdAt: "2026-11-01T10:00:00.000Z",
  closedAt: null,
  fault: "",
  workNote: "",
  serialNo: "x20r2-test001",
  ...over,
});
const today = new Date(2026, 10, 18);

describe("buildClientEquipmentCard", () => {
  it("dzieli na gwarancję i resztę; gwarancja kończąca się najwcześniej pierwsza; okres modelu z katalogu", () => {
    const card = buildClientEquipmentCard(
      [
        item({ twId: 1, invoiceDate: "2026-01-15" }),
        item({ twId: 2, name: "Lampa B", serials: [], quantity: 2, invoiceDate: "2025-03-01" }),
        item({ twId: 3, name: "Garnek C", serials: ["2019/1"], invoiceDate: "2019-05-01" }),
        item({ twId: 4, name: "Bez daty", serials: ["Q12345"], invoiceDate: null }),
      ],
      [],
      [],
      new Map([[2, 12]]),
      today
    );
    expect(card.active.map((d) => [d.name, d.warranty.until])).toEqual([["Silnik A", "2028-01-15"]]);
    expect(card.other.map((d) => [d.name, d.warranty.state])).toEqual([
      ["Lampa B", "expired"],
      ["Garnek C", "expired"],
      ["Bez daty", "unknown"],
    ]);
  });

  it("zlecenie dopięte po numerze seryjnym mimo innego zapisu (wielkość liter, myślnik)", () => {
    const card = buildClientEquipmentCard([item({})], [order({}), order({ id: "o2", serialNo: "INNY999" })], [], new Map(), today);
    expect(card.active[0]!.orders.map((o) => o.id)).toEqual(["o1"]);
  });

  it("naprawa bez zakupu na liście zostaje; naprawa kupionego egzemplarza i duplikat znikają", () => {
    const card = buildClientEquipmentCard(
      [item({})],
      [],
      [
        { serial: "X20R2TEST001", invoiceId: 50, invoiceNumber: "FS 50", invoiceDate: "2026-06-01" },
        { serial: "OBCY12345", invoiceId: 51, invoiceNumber: "FS 51", invoiceDate: "2026-07-01" },
        { serial: "OBCY12345", invoiceId: 51, invoiceNumber: "FS 51", invoiceDate: "2026-07-01" },
      ],
      new Map(),
      today
    );
    expect(card.repairsElsewhere.map((r) => r.serial)).toEqual(["OBCY12345"]);
  });
});

describe("cardDeviceMatches", () => {
  it("szuka po modelu, numerze dokumentu i numerze seryjnym bez znaków rozdzielających", () => {
    const d = item({});
    expect(cardDeviceMatches(d, "silnik")).toBe(true);
    expect(cardDeviceMatches(d, "10/M/01")).toBe(true);
    expect(cardDeviceMatches(d, "x20r2-test")).toBe(true);
    expect(cardDeviceMatches(d, "lampa")).toBe(false);
  });
});
