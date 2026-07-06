import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument } from "@/lib/subiekt/types";

const mocks = vi.hoisted(() => ({
  getSubiektZdDocumentCached: vi.fn(),
  searchSubiektZdCached: vi.fn(),
  isSubiektReachable: vi.fn(),
  tryAcquireLock: vi.fn(),
  releaseLock: vi.fn(),
  fetchDeliveryStats: vi.fn(),
  getAppSupplierRefsCached: vi.fn(),
}));

const {
  getSubiektZdDocumentCached,
  searchSubiektZdCached,
  isSubiektReachable,
  tryAcquireLock,
  releaseLock,
  fetchDeliveryStats,
  getAppSupplierRefsCached,
} = mocks;

vi.mock("@/lib/subiekt/subiekt-runtime-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/subiekt/subiekt-runtime-cache")>();
  return {
    ...actual,
    getSubiektZdDocumentCached: (...args: unknown[]) =>
      mocks.getSubiektZdDocumentCached(...args),
    searchSubiektZdCached: (...args: unknown[]) => mocks.searchSubiektZdCached(...args),
    searchSubiektZdCachedForEta: (...args: unknown[]) =>
      mocks.searchSubiektZdCached(...args),
  };
});

vi.mock("@/lib/subiekt/availability", () => ({
  isSubiektReachable: (...args: unknown[]) => mocks.isSubiektReachable(...args),
}));

vi.mock("@/lib/services/locks", () => ({
  tryAcquireLock: (...args: unknown[]) => mocks.tryAcquireLock(...args),
  releaseLock: (...args: unknown[]) => mocks.releaseLock(...args),
}));

vi.mock("@/lib/data/queries", () => ({
  fetchDeliveryStats: (...args: unknown[]) => mocks.fetchDeliveryStats(...args),
}));

vi.mock("@/lib/data/supplier-refs", () => ({
  getAppSupplierRefsCached: (...args: unknown[]) => mocks.getAppSupplierRefsCached(...args),
}));
let mockOrders: IndividualOrder[] = [];
let mockIndexRows: Array<{
  dok_id: number;
  dok_nr_pelny: string | null;
  dok_data_wyst: string | null;
}> = [];
const orderUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];
const rangeCalls: Array<{ from: number; to: number }> = [];

const stats = {
  supplier_id: "s1",
  main_sum: 50,
  main_avg: 5,
  main_count: 10,
  side_sum: 6,
  side_avg: 3,
  side_count: 2,
};

const supplierRef = {
  id: "s1",
  name: "Dostawca",
  subiektKhId: 9001,
  additionalSubiektKhIds: [],
};

function overdueOrder(overrides: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "o1",
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "ABC-1",
    products: "Prod ABC",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-01-02T10:00:00+01:00",
    ordered_at: "2026-01-02T10:00:00+01:00",
    delivery_at: null,
    supplier: {
      id: "s1",
      name: "Dostawca",
      stats_mode: "LACZNIE",
    } as IndividualOrder["supplier"],
    ...overrides,
  };
}

function zdListItem(id: number, khId = 9001) {
  return {
    dok_Id: id,
    dok_OdbiorcaId: khId,
    dok_PlatnikId: khId,
    dok_Status: 6,
  };
}

function zdDoc(
  id: number,
  date: string,
  symbol: string,
  deadline = "2026-08-01"
): SubiektDocument {
  return {
    dok_Id: id,
    dok_NrPelny: `ZD/${id}/2026`,
    dok_DataWyst: date,
    dok_DostawcaId: 9001,
    dok_TerminRealizacji: deadline,
    dok_Pozycja: [{ ob_TowId: 1, tw_Symbol: symbol, tw_Nazwa: "Prod" }],
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "individual_orders") {
        const terminalResult = () => Promise.resolve({ data: mockOrders, error: null });
        const rangeResult = (from: number, to: number) => {
          rangeCalls.push({ from, to });
          const batch = mockOrders.slice(from, to + 1);
          return Promise.resolve({ data: batch, error: null });
        };
        const orderChain = () => ({
          order: () => ({
            range: rangeResult,
          }),
          range: rangeResult,
        });
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                is: () => ({
                  eq: terminalResult,
                  order: orderChain,
                }),
              }),
            }),
            eq: () => ({
              in: () => ({
                not: () => ({
                  is: () => ({
                    eq: terminalResult,
                    order: orderChain,
                  }),
                }),
                is: () => ({
                  eq: terminalResult,
                  order: orderChain,
                }),
              }),
              is: () => ({
                eq: terminalResult,
                order: orderChain,
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              orderUpdates.push({ id, patch });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "subiekt_zd_index") {
        const indexQuery = {
          gte: () => ({
            order: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockIndexRows, error: null }),
              }),
            }),
          }),
        };
        return {
          select: () => ({
            in: () => indexQuery,
            not: () =>
              Promise.resolve({
                data: [{ supplier_id: "s1", subiekt_kh_id: 9001 }],
                error: null,
              }),
          }),
        };
      }
      return {};
    },
  }),
}));

import {
  liveSearchZdDocsForOrder,
  runZdEtaSync,
  ZD_ETA_GLOBAL_ORDER_SCAN_PAGE,
} from "./zd-eta-sync";

describe("runZdEtaSync (integracja)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrders = [overdueOrder()];
    mockIndexRows = [{ dok_id: 101, dok_nr_pelny: "ZD/101/2026", dok_data_wyst: "2026-06-01" }];
    orderUpdates.length = 0;
    rangeCalls.length = 0;
    isSubiektReachable.mockResolvedValue(true);
    tryAcquireLock.mockResolvedValue(true);
    releaseLock.mockResolvedValue(undefined);
    fetchDeliveryStats.mockResolvedValue([stats]);
    getAppSupplierRefsCached.mockResolvedValue([supplierRef]);
    getSubiektZdDocumentCached.mockImplementation(async (id: number) =>
      zdDoc(id, "2026-06-01", "ABC-1", "2026-08-15")
    );
    searchSubiektZdCached.mockResolvedValue({ data: [] });
  });

  it("pomija gdy Subiekt niedostępny", async () => {
    isSubiektReachable.mockResolvedValue(false);
    const result = await runZdEtaSync({ salesPersonId: "sp1", maxOrders: 1 });
    expect(result.skipped).toBe(true);
    expect(result.subiektOffline).toBe(true);
    expect(tryAcquireLock).not.toHaveBeenCalled();
  });

  it("pomija gdy lock zajęty", async () => {
    tryAcquireLock.mockResolvedValue(false);
    const result = await runZdEtaSync({ salesPersonId: "sp1", maxOrders: 1 });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("lock_held");
  });

  it("zapisuje termin z dopasowanego ZD z indeksu", async () => {
    const result = await runZdEtaSync({
      salesPersonId: "sp1",
      maxOrders: 1,
      maxDocsPerRun: 4,
      maxDocsPerSupplier: 4,
      allowLiveSearch: false,
    });

    expect(result.updated).toBe(1);
    expect(result.processed).toBe(1);
    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline).toBe("2026-08-15");
    expect(orderUpdates[0]?.patch.zd_fulfillment_source).toBe("zd");
    expect(orderUpdates[0]?.patch.zd_fulfillment_dok_nr).toBe("ZD/101/2026");
    expect(orderUpdates[0]?.patch.zd_fulfillment_dok_id).toBe(101);
  });

  it("zapisuje zmianę terminu ZD wykrytą przy ponownym sync", async () => {
    mockOrders = [
      overdueOrder({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-01",
        zd_fulfillment_dok_nr: "ZD/101/2026",
        zd_fulfillment_synced_at: "2026-06-01T00:00:00Z",
      }),
    ];
    getSubiektZdDocumentCached.mockResolvedValue(
      zdDoc(101, "2026-06-01", "ABC-1", "2026-08-15")
    );

    const result = await runZdEtaSync({
      salesPersonId: "sp1",
      maxOrders: 1,
      maxDocsPerRun: 4,
      maxDocsPerSupplier: 4,
      allowLiveSearch: false,
      force: true,
    });

    expect(result.updated).toBe(1);
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline).toBe("2026-08-15");
    expect(orderUpdates[0]?.patch.zd_fulfillment_previous_deadline).toBe("2026-07-01");
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline_changed_at).toBeDefined();
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline_change_seen_at).toBeNull();
  });

  it("przy backupie bez dopasowania tylko odświeża synced_at gdy termin już zapisany", async () => {
    const futureDeadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    mockOrders = [
      overdueOrder({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: futureDeadline,
        zd_fulfillment_dok_nr: "ZD/stary",
        zd_fulfillment_synced_at: "2026-06-01T00:00:00Z",
      }),
    ];
    getSubiektZdDocumentCached.mockResolvedValue(
      zdDoc(999, "2026-06-01", "INNY-SYMBOL")
    );

    const result = await runZdEtaSync({
      salesPersonId: "sp1",
      maxOrders: 1,
      maxDocsPerRun: 2,
      allowLiveSearch: false,
    });

    expect(result.updated).toBe(0);
    expect(result.cleared).toBe(0);
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline).toBeUndefined();
    expect(orderUpdates[0]?.patch.zd_fulfillment_synced_at).toBeDefined();
  });

  it("przy force zachowuje aktywny termin ZD gdy brak nowego dopasowania", async () => {
    const futureDeadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    mockOrders = [
      overdueOrder({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: futureDeadline,
        zd_fulfillment_dok_nr: "ZD/stary",
        zd_fulfillment_synced_at: "2026-06-01T00:00:00Z",
      }),
    ];
    getSubiektZdDocumentCached.mockResolvedValue(
      zdDoc(999, "2026-06-01", "INNY-SYMBOL")
    );

    const result = await runZdEtaSync({
      salesPersonId: "sp1",
      maxOrders: 1,
      maxDocsPerRun: 2,
      maxDocsPerSupplier: 2,
      allowLiveSearch: false,
      force: true,
    });

    expect(result.cleared).toBe(0);
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline).toBeUndefined();
    expect(orderUpdates[0]?.patch.zd_fulfillment_synced_at).toBeDefined();
  });

  it("wybiera najwcześniejszy termin ZD przy wielu dopasowaniach w indeksie", async () => {
    const earlyDeadline = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const lateDeadline = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    mockIndexRows = [
      { dok_id: 201, dok_nr_pelny: "ZD/201/2026", dok_data_wyst: "2026-05-01" },
      { dok_id: 202, dok_nr_pelny: "ZD/202/2026", dok_data_wyst: "2026-06-15" },
    ];
    getSubiektZdDocumentCached.mockImplementation(async (id: number) => {
      if (id === 201) return zdDoc(201, "2026-05-01", "ABC-1", earlyDeadline);
      if (id === 202) return zdDoc(202, "2026-06-15", "ABC-1", lateDeadline);
      return null;
    });

    const result = await runZdEtaSync({
      salesPersonId: "sp1",
      maxOrders: 1,
      maxDocsPerRun: 6,
      maxDocsPerSupplier: 6,
      allowLiveSearch: false,
    });

    expect(result.updated).toBe(1);
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline).toBe(earlyDeadline);
    expect(orderUpdates[0]?.patch.zd_fulfillment_dok_nr).toBe("ZD/201/2026");
    expect(orderUpdates[0]?.patch.zd_fulfillment_dok_id).toBe(201);
  });

  it("liveSearchZdDocsForOrder dopasowuje dokument z wyszukiwania", async () => {
    searchSubiektZdCached.mockResolvedValue({
      data: [zdListItem(301)],
    });
    getSubiektZdDocumentCached.mockResolvedValue(
      zdDoc(301, "2026-06-01", "ABC-1", "2026-08-20")
    );

    const { matched } = await liveSearchZdDocsForOrder(
      overdueOrder(),
      [9001],
      2,
      4,
      4,
      new Set(),
      async (id) => getSubiektZdDocumentCached(id)
    );

    expect(searchSubiektZdCached).toHaveBeenCalled();
    expect(matched?.dok_Id).toBe(301);
  });

  it("runZdEtaSync uruchamia live search gdy brak dopasowania w indeksie", async () => {
    mockIndexRows = [];
    searchSubiektZdCached.mockResolvedValue({
      data: [zdListItem(301)],
    });
    getSubiektZdDocumentCached.mockResolvedValue(
      zdDoc(301, "2026-06-01", "ABC-1", "2026-08-20")
    );

    const result = await runZdEtaSync({
      salesPersonId: "sp1",
      maxOrders: 1,
      maxDocsPerRun: 4,
      maxDocsPerSupplier: 4,
      indexLimitPerSupplier: 0,
      allowLiveSearch: true,
    });

    expect(result.processed).toBe(1);
    expect(result.updated).toBe(1);
    expect(orderUpdates[0]?.patch.zd_fulfillment_deadline).toBe("2026-08-20");
  });

  it("globalny sync stronicuje zapytanie o zamówienia", async () => {
    mockOrders = Array.from({ length: ZD_ETA_GLOBAL_ORDER_SCAN_PAGE + 5 }, (_, i) =>
      overdueOrder({
        id: `o${i}`,
        ordered_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T10:00:00+01:00`,
      })
    );

    await runZdEtaSync({
      maxOrders: 1,
      maxDocsPerRun: 2,
      allowLiveSearch: false,
    });

    expect(rangeCalls.length).toBeGreaterThanOrEqual(2);
    expect(rangeCalls[0]).toEqual({ from: 0, to: ZD_ETA_GLOBAL_ORDER_SCAN_PAGE - 1 });
  });
});
