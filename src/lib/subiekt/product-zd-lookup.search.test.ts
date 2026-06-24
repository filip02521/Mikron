import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubiektDocument } from "@/lib/subiekt/types";

const mocks = vi.hoisted(() => ({
  searchSubiektZdCachedForEta: vi.fn(),
  getSubiektZdDocumentCached: vi.fn(),
  loadZdIndexRowsForPlacements: vi.fn(),
  searchZdFromIndexForOrder: vi.fn(),
  browseZdDocumentsForKhIds: vi.fn(),
  liveSearchZdDocsByTwIdForOrder: vi.fn(),
  liveSearchZdDocsForOrder: vi.fn(),
  loadSupplierHistoriaOrderDates: vi.fn(),
}));

vi.mock("@/lib/subiekt/subiekt-runtime-cache", () => ({
  searchSubiektZdCachedForEta: (...args: unknown[]) => mocks.searchSubiektZdCachedForEta(...args),
  getSubiektZdDocumentCached: (...args: unknown[]) => mocks.getSubiektZdDocumentCached(...args),
}));

vi.mock("@/lib/subiekt/zd-eta-index-search", () => ({
  loadZdIndexRowsForPlacements: (...args: unknown[]) =>
    mocks.loadZdIndexRowsForPlacements(...args),
  loadZdIndexRowsForSupplierSync: vi.fn().mockResolvedValue([]),
  filterZdIndexRowsForPlacements: (rows: unknown[]) => rows,
  searchZdFromIndexForOrder: (...args: unknown[]) => mocks.searchZdFromIndexForOrder(...args),
}));

vi.mock("@/lib/subiekt/zd-eta-browse", () => ({
  browseZdDocumentsForKhIds: (...args: unknown[]) => mocks.browseZdDocumentsForKhIds(...args),
}));

vi.mock("@/lib/subiekt/zd-eta-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/subiekt/zd-eta-sync")>();
  return {
    ...actual,
    liveSearchZdDocsByTwIdForOrder: (...args: unknown[]) =>
      mocks.liveSearchZdDocsByTwIdForOrder(...args),
    liveSearchZdDocsForOrder: (...args: unknown[]) => mocks.liveSearchZdDocsForOrder(...args),
  };
});

vi.mock("@/lib/orders/supplier-historia-order-dates", () => ({
  loadSupplierHistoriaOrderDates: (...args: unknown[]) =>
    mocks.loadSupplierHistoriaOrderDates(...args),
}));

import {
  liveSearchProductZdBySymbolWindows,
  productLookupSearchOrder,
  searchProductZdWithSupplier,
} from "@/lib/subiekt/product-zd-lookup";

const SUPPLIER = { supplierId: "s-any", supplierName: "Anycubic" };
const KH_IDS = [28295];
const APP_SUPPLIERS = [
  { id: "s-any", name: "Anycubic", subiektKhId: 28295, additionalSubiektKhIds: [] },
] as import("@/lib/subiekt/match-supplier").AppSupplierRef[];

function zdDoc(
  id: number,
  partial: Partial<SubiektDocument> = {}
): SubiektDocument {
  return {
    dok_Id: id,
    dok_NrPelny: `ZD ${id}/M/02/2026`,
    dok_DataWyst: "2026-02-10",
    dok_Status: 6,
    dok_OdbiorcaId: 28295,
    dok_PlatnikId: 28295,
    dok_TerminRealizacji: "2026-07-03",
    dok_Pozycja: [{ ob_TowId: 16012, tw_Symbol: "MSDHLGY-104C", ob_Ilosc: 3 }],
    ...partial,
  };
}

describe("liveSearchProductZdBySymbolWindows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSubiektZdDocumentCached.mockImplementation(async (id: number) =>
      zdDoc(id, {
        dok_Pozycja: [{ ob_TowId: 999, tw_Symbol: "OTHER", ob_Ilosc: 1 }],
      })
    );
  });

  it("odrzuca wiersze listy innego kontrahenta przed loadDoc", async () => {
    mocks.searchSubiektZdCachedForEta.mockResolvedValue({
      data: [
        {
          dok_Id: 9001,
          dok_DataWyst: "2026-02-10",
          dok_Status: 6,
          dok_OdbiorcaId: 2110,
        },
        {
          dok_Id: 1747405,
          dok_DataWyst: "2026-06-10",
          dok_Status: 6,
          dok_OdbiorcaId: 28295,
        },
      ],
    });
    mocks.getSubiektZdDocumentCached.mockImplementation(async (id: number) => {
      if (id === 1747405) {
        return zdDoc(1747405, {
          dok_Pozycja: [{ ob_TowId: 16012, tw_Symbol: "MSDHLGY-104C", ob_Ilosc: 3 }],
        });
      }
      return zdDoc(id);
    });

    const product = { tw_Id: 16012, tw_Symbol: "MSDHLGY-104C", tw_Nazwa: "Craftsman" };
    const order = productLookupSearchOrder(product, "2026-06-15");

    const result = await liveSearchProductZdBySymbolWindows(
      product,
      order,
      KH_IDS,
      ["2026-06-15"],
      "2026-06-15",
      5,
      new Set(),
      async (id) => mocks.getSubiektZdDocumentCached(id)
    );

    expect(mocks.getSubiektZdDocumentCached).toHaveBeenCalledTimes(1);
    expect(mocks.getSubiektZdDocumentCached).toHaveBeenCalledWith(1747405);
    expect(result.matched?.dok_Id).toBe(1747405);
    expect(result.fetched).toBe(1);
  });

  it("wybiera najlepsze dopasowanie z wielu trafień symbolu", async () => {
    mocks.searchSubiektZdCachedForEta.mockResolvedValue({
      data: [
        {
          dok_Id: 1001,
          dok_DataWyst: "2026-06-11",
          dok_Status: 6,
          dok_OdbiorcaId: 28295,
        },
        {
          dok_Id: 1002,
          dok_DataWyst: "2026-06-10",
          dok_Status: 6,
          dok_OdbiorcaId: 28295,
        },
      ],
    });
    mocks.getSubiektZdDocumentCached.mockImplementation(async (id: number) => {
      if (id === 1001) {
        return zdDoc(1001, {
          dok_Pozycja: [{ ob_TowId: 16012, tw_Symbol: "MSDHLGY-104C", ob_Ilosc: 50 }],
        });
      }
      if (id === 1002) {
        return zdDoc(1002, {
          dok_Pozycja: [{ ob_TowId: 16012, tw_Symbol: "MSDHLGY-104C", ob_Ilosc: 3 }],
        });
      }
      return zdDoc(id);
    });

    const product = { tw_Id: 16012, tw_Symbol: "MSDHLGY-104C", tw_Nazwa: "Craftsman" };
    const order = productLookupSearchOrder(product, "2026-06-15");

    const result = await liveSearchProductZdBySymbolWindows(
      product,
      order,
      KH_IDS,
      ["2026-06-15"],
      "2026-06-15",
      5,
      new Set(),
      async (id) => mocks.getSubiektZdDocumentCached(id)
    );

    expect(result.matched?.dok_Id).toBe(1002);
    expect(result.fetched).toBe(2);
  });
});

describe("searchProductZdWithSupplier", () => {
  const product = { tw_Id: 16012, tw_Symbol: "MSDHLGY-104C", tw_Nazwa: "Craftsman" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSupplierHistoriaOrderDates.mockResolvedValue([]);
    mocks.loadZdIndexRowsForPlacements.mockResolvedValue([]);
    mocks.searchZdFromIndexForOrder.mockResolvedValue({
      docs: [],
      fetched: 0,
      stoppedEarly: false,
      matched: null,
    });
    mocks.searchSubiektZdCachedForEta.mockResolvedValue({ data: [] });
    mocks.browseZdDocumentsForKhIds.mockResolvedValue({
      docs: [],
      fetched: 0,
      stoppedEarly: false,
      matched: null,
    });
    mocks.liveSearchZdDocsForOrder.mockResolvedValue({
      docs: [],
      fetched: 0,
      matched: null,
    });
    mocks.liveSearchZdDocsByTwIdForOrder.mockResolvedValue({ doc: null, peeked: 0 });
  });

  it("używa liveSearchZdDocsByTwIdForOrder gdy indeks i symbol nie trafiają", async () => {
    const hit = zdDoc(1747405);
    mocks.liveSearchZdDocsByTwIdForOrder.mockResolvedValue({ doc: hit, peeked: 1 });

    const { matches, searchIncomplete } = await searchProductZdWithSupplier(
      product,
      SUPPLIER,
      APP_SUPPLIERS,
      new Map(),
      "2026-06-15",
      KH_IDS
    );

    expect(mocks.liveSearchZdDocsByTwIdForOrder).toHaveBeenCalled();
    expect(mocks.liveSearchZdDocsForOrder).not.toHaveBeenCalled();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.dokNr).toBe("ZD 1747405/M/02/2026");
    expect(matches[0]?.deadline).toBe("2026-07-03");
    expect(searchIncomplete).toBe(false);
  });

  it("woła tw_Id search mimo wyczerpania budżetu symbolu", async () => {
    const listings = Array.from({ length: 30 }, (_, index) => ({
      dok_Id: 5000 + index,
      dok_DataWyst: "2026-06-10",
      dok_Status: 6,
      dok_OdbiorcaId: 28295,
    }));
    mocks.searchSubiektZdCachedForEta.mockResolvedValue({ data: listings });
    mocks.getSubiektZdDocumentCached.mockImplementation(async (id: number) =>
      zdDoc(id, {
        dok_Pozycja: [{ ob_TowId: 999, tw_Symbol: "OTHER", ob_Ilosc: 1 }],
      })
    );
    mocks.liveSearchZdDocsByTwIdForOrder.mockResolvedValue({
      doc: zdDoc(9999),
      peeked: 1,
    });

    await searchProductZdWithSupplier(
      product,
      SUPPLIER,
      APP_SUPPLIERS,
      new Map(),
      "2026-06-15",
      KH_IDS
    );

    expect(mocks.liveSearchZdDocsByTwIdForOrder).toHaveBeenCalled();
    const twBudget = mocks.liveSearchZdDocsByTwIdForOrder.mock.calls[0]?.[2];
    expect(twBudget).toBeGreaterThan(0);
  });

  it("przy starym zamówieniu browse jest przed live search", async () => {
    const callOrder: string[] = [];
    mocks.browseZdDocumentsForKhIds.mockImplementation(async () => {
      callOrder.push("browse");
      return { docs: [], fetched: 0, stoppedEarly: false, matched: null };
    });
    mocks.liveSearchZdDocsByTwIdForOrder.mockImplementation(async () => {
      callOrder.push("twId");
      return { doc: null, peeked: 0 };
    });
    mocks.liveSearchZdDocsForOrder.mockImplementation(async () => {
      callOrder.push("live");
      return { docs: [], fetched: 0, matched: null };
    });

    await searchProductZdWithSupplier(
      product,
      SUPPLIER,
      APP_SUPPLIERS,
      new Map(),
      "2026-02-10",
      KH_IDS
    );

    expect(callOrder.indexOf("browse")).toBeLessThan(callOrder.indexOf("twId"));
    expect(callOrder.indexOf("twId")).toBeLessThan(callOrder.indexOf("live"));
  });

  it("przy świeżym zamówieniu browse jest po live search", async () => {
    const callOrder: string[] = [];
    mocks.browseZdDocumentsForKhIds.mockImplementation(async () => {
      callOrder.push("browse");
      return { docs: [], fetched: 0, stoppedEarly: false, matched: null };
    });
    mocks.liveSearchZdDocsByTwIdForOrder.mockImplementation(async () => {
      callOrder.push("twId");
      return { doc: null, peeked: 0 };
    });
    mocks.liveSearchZdDocsForOrder.mockImplementation(async () => {
      callOrder.push("live");
      return { docs: [], fetched: 0, matched: null };
    });

    await searchProductZdWithSupplier(
      product,
      SUPPLIER,
      APP_SUPPLIERS,
      new Map(),
      "2026-06-15",
      KH_IDS
    );

    expect(callOrder.indexOf("twId")).toBeLessThan(callOrder.indexOf("browse"));
    expect(callOrder.indexOf("live")).toBeLessThan(callOrder.indexOf("browse"));
  });

  it("nie woła tw_Id search gdy indeks już znalazł dopasowanie", async () => {
    const hit = zdDoc(100);
    mocks.searchZdFromIndexForOrder.mockResolvedValue({
      docs: [hit],
      fetched: 1,
      stoppedEarly: false,
      matched: hit,
    });

    const { matches } = await searchProductZdWithSupplier(
      product,
      SUPPLIER,
      APP_SUPPLIERS,
      new Map(),
      "2026-06-15",
      KH_IDS
    );

    expect(matches).toHaveLength(1);
    expect(mocks.liveSearchZdDocsByTwIdForOrder).not.toHaveBeenCalled();
    expect(mocks.liveSearchZdDocsForOrder).not.toHaveBeenCalled();
    expect(mocks.browseZdDocumentsForKhIds).not.toHaveBeenCalled();
  });
});
