import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildClientAutoProsbaLines,
  buildServerAutoProsbaEntries,
  resolveClientAutoProsbaStockSnapshot,
} from "./zk-watch-auto-prosba";
import { buildZkWatchLineViews } from "./zk-watch-lines";
import {
  adjustStockMapForZkLines,
  buildProsbaSubmitStockConfirm,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";
import {
  assertProsbaSubmitStockAllowed,
  findProsbaLinesWithSufficientStock,
  PROSBA_STOCK_ACK_REQUIRED_CODE,
} from "@/lib/orders/prosba-stock-server";
import type { SalesZkWatch } from "@/types/database";
import type { ZkWatchOrderHints } from "./zk-watch-order-link";
import type { TeethDraftRegistryLookup } from "./zk-watch-teeth-draft";

vi.mock("@/lib/orders/fetch-prosba-line-stock", () => ({
  fetchProsbaLineStock: vi.fn(),
}));

import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";

const mockFetch = vi.mocked(fetchProsbaLineStock);

const watch = {
  id: "w-stock",
  sales_person_id: "sp1",
  client_label: "Klinika",
  client_kh_id: 9,
  zk_number: "ZK/99/2026",
  line_checks: [{ key: "ob:1", needs_prosba: true, arrived: false }],
  subiekt_snapshot: {
    dok_Pozycja: [
      { ob_Id: 1, tw_Nazwa: "Implant", tw_Symbol: "IMP-1", ob_Ilosc: 2, ob_TowId: 100 },
    ],
  },
} as unknown as SalesZkWatch;

const hints: ZkWatchOrderHints = {
  matchingOpenRequestCount: 0,
  matchingOpenRequestIds: [],
  matchedDeliveredLineKeys: [],
  allLinesMatchedByOrders: false,
  lineCoverageByKey: {},
  uncoveredLineKeys: ["ob:1"],
  openProsbaCoveredLineKeys: [],
  prosbaScopeConfigured: true,
  inStockLineKeys: [],
  regalWaitingLineKeys: [],
  informacjaReadyLineKeys: [],
  informacjaAcknowledgedLineKeys: [],
  scopeExcludedLineKeys: [],
};

const emptyRegistry: TeethDraftRegistryLookup = {
  twIds: new Set<number>(),
  manufacturerByTwId: new Map(),
  productLineByTwId: new Map(),
  kindByTwId: new Map(),
  catalogAvailable: true,
};

function rawStockForReservedZk(): Record<number, ProsbaLineStockSnapshot> {
  return {
    100: { onHand: 2, reserved: 2, available: 0, source: "subiekt" },
  };
}

describe("resolveClientAutoProsbaStockSnapshot", () => {
  it("undefined gdy brak mapy", () => {
    expect(resolveClientAutoProsbaStockSnapshot(undefined)).toBeUndefined();
  });

  it("undefined gdy pusty obiekt — serwer ma pobrać Subiekt", () => {
    expect(resolveClientAutoProsbaStockSnapshot({})).toBeUndefined();
  });

  it("zwraca mapę gdy są wpisy", () => {
    const snap = {
      1: { onHand: 1, reserved: 0, available: 1, source: "subiekt" as const },
    };
    expect(resolveClientAutoProsbaStockSnapshot(snap)).toBe(snap);
  });
});

describe("auto-prośba — spójność klient ↔ serwer (adjusted stock)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("skorygowany stan uwalnia rezerwację ZK — klient i serwer zgadzają się co do ack", async () => {
    const productLines = buildZkWatchLineViews(watch);
    const rawStock = rawStockForReservedZk();
    const adjustedStock = adjustStockMapForZkLines(productLines, rawStock);

    expect(adjustedStock[100]?.available).toBe(2);

    const client = buildClientAutoProsbaLines({
      watch,
      hints,
      teethRegistry: emptyRegistry,
      stockByTwId: adjustedStock,
    });
    expect(client.blocked).toBeUndefined();
    expect(client.lines).toHaveLength(1);

    const confirm = buildProsbaSubmitStockConfirm(client.lines, "zamowienie");
    expect(confirm).not.toBeNull();
    expect(confirm?.sufficientLines).toHaveLength(1);

    const entries = buildServerAutoProsbaEntries({
      watch,
      lineKeys: client.lineKeys,
      teethRegistry: emptyRegistry,
      stockByTwId: adjustedStock,
    });

    mockFetch.mockResolvedValue({
      100: { onHand: 99, reserved: 0, available: 99, source: "subiekt" },
    });

    await expect(
      assertProsbaSubmitStockAllowed({
        lines: entries,
        requestKind: "zamowienie",
        stockByTwId: adjustedStock,
      })
    ).rejects.toMatchObject({ code: PROSBA_STOCK_ACK_REQUIRED_CODE });
    expect(mockFetch).not.toHaveBeenCalled();

    const sufficient = await findProsbaLinesWithSufficientStock({
      lines: entries,
      requestKind: "zamowienie",
      stockByTwId: adjustedStock,
    });
    expect(sufficient.map((line) => line.subiektTwId)).toEqual([100]);
    expect(confirm?.sufficientLines[0]?.subiektTwId).toBe(100);
  });

  it("surowy stan bez korekty ZK nie wymusza ack — adjusted tak (regresja)", () => {
    const productLines = buildZkWatchLineViews(watch);
    const rawStock = rawStockForReservedZk();

    const clientRaw = buildClientAutoProsbaLines({
      watch,
      hints,
      teethRegistry: emptyRegistry,
      stockByTwId: rawStock,
    });
    expect(buildProsbaSubmitStockConfirm(clientRaw.lines, "zamowienie")).toBeNull();

    const adjustedStock = adjustStockMapForZkLines(productLines, rawStock);
    const clientAdjusted = buildClientAutoProsbaLines({
      watch,
      hints,
      teethRegistry: emptyRegistry,
      stockByTwId: adjustedStock,
    });
    expect(buildProsbaSubmitStockConfirm(clientAdjusted.lines, "zamowienie")).not.toBeNull();
  });

  it("ten sam snapshot co w modalu — serwer nie nadpisuje fetchiem Subiekta", async () => {
    const productLines = buildZkWatchLineViews(watch);
    const adjustedStock = adjustStockMapForZkLines(productLines, rawStockForReservedZk());
    const entries = buildServerAutoProsbaEntries({
      watch,
      lineKeys: ["ob:1"],
      teethRegistry: emptyRegistry,
      stockByTwId: adjustedStock,
    });

    await assertProsbaSubmitStockAllowed({
      lines: entries,
      requestKind: "zamowienie",
      acknowledgeSufficientStock: true,
      stockByTwId: adjustedStock,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pusty snapshot klienta — serwer pobiera Subiekt", async () => {
    mockFetch.mockResolvedValue({});
    const entries = buildServerAutoProsbaEntries({
      watch,
      lineKeys: ["ob:1"],
      teethRegistry: emptyRegistry,
      stockByTwId: {},
    });

    await assertProsbaSubmitStockAllowed({
      lines: entries,
      requestKind: "zamowienie",
      stockByTwId: resolveClientAutoProsbaStockSnapshot({}),
    });

    await findProsbaLinesWithSufficientStock({
      lines: entries,
      requestKind: "zamowienie",
    });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("client i server entries mają ten sam available po enrich", () => {
    const productLines = buildZkWatchLineViews(watch);
    const adjustedStock = adjustStockMapForZkLines(productLines, rawStockForReservedZk());

    const client = buildClientAutoProsbaLines({
      watch,
      hints,
      teethRegistry: emptyRegistry,
      stockByTwId: adjustedStock,
    });
    const serverEntries = buildServerAutoProsbaEntries({
      watch,
      lineKeys: client.lineKeys,
      teethRegistry: emptyRegistry,
      stockByTwId: adjustedStock,
    });

    expect(client.lines[0]?.available).toBe(2);
    expect(serverEntries[0]?.available).toBe(2);
    expect(client.lines[0]?.product).toBe(serverEntries[0]?.product);
    expect(client.lines[0]?.quantity).toBe(serverEntries[0]?.quantity);
  });
});
