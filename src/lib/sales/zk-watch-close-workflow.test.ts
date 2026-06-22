import { describe, expect, it, vi } from "vitest";
import type { SalesZkWatch } from "@/types/database";
import type { ZkLinkableOrder } from "./zk-watch-order-link";
import {
  collectZkWatchPendingAckItems,
  isOrderPendingAckForZkClose,
} from "./zk-watch-close-pending";
import {
  fetchZkWatchPendingAckOrderCandidates,
  resolveZkWatchPendingAckItemsForWatch,
} from "./zk-watch-close-pending-fetch";
import {
  acknowledgeOrdersWithClient,
  acknowledgeZdDeadlineWithClient,
  executeZkWatchPendingAckPlan,
} from "./zk-watch-pending-ack-plan";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/sales/zk-watch-order-sync", () => ({
  syncZkWatchLineChecksFromOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/orders/sales-cancel-db", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/orders/sales-cancel-db")>();
  return {
    ...actual,
    getSalesCancelDbCaps: vi.fn().mockResolvedValue({
      hasCancelledAt: true,
      hasCancelPhase: true,
      hasCancelledQuantity: true,
    }),
  };
});

const SALES_PERSON_ID = "sp1";

type StoredOrder = {
  id: string;
  sales_person_id: string;
  sales_client_kh_id: number | null;
  sales_client_name: string | null;
  source_zk_watch_id: string | null;
  source_zk_number: string | null;
  subiekt_tw_id: number | null;
  symbol: string | null;
  products: string | null;
  mikran_code: string | null;
  quantity: string;
  delivered_quantity: string;
  status: string;
  request_kind: string | null;
  ordered_at: string | null;
  action_at: string;
  delivery_at: string | null;
  zd_fulfillment_deadline: string | null;
  zd_fulfillment_previous_deadline: string | null;
  zd_fulfillment_deadline_changed_at: string | null;
  zd_fulfillment_deadline_change_seen_at: string | null;
  sales_acknowledged_at: string | null;
  sales_cancelled_at: string | null;
  sales_cancel_phase?: string | null;
  sales_cancelled_quantity?: string | null;
};

function watch(partial: Partial<SalesZkWatch> = {}): SalesZkWatch {
  return {
    id: "watch-1",
    sales_person_id: SALES_PERSON_ID,
    subiekt_dok_id: 1,
    zk_number: "ZK/2026/0142",
    client_label: "Klinika Smile",
    client_kh_id: 42,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    line_summary: null,
    subiekt_snapshot: {
      dok_Pozycja: [
        {
          ob_Id: 1,
          ob_TowId: 100,
          tw_Symbol: "ABC",
          tw_Nazwa: "Implant X",
          ob_Ilosc: 2,
        },
      ],
    },
    line_checks: [],
    prosba_scope_lines: null,
    note: null,
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-01T08:00:00Z",
    ...partial,
  };
}

function pickupOrder(
  partial: Partial<StoredOrder> & Pick<StoredOrder, "id">
): StoredOrder {
  return {
    sales_person_id: SALES_PERSON_ID,
    sales_client_kh_id: 42,
    sales_client_name: "Klinika Smile",
    source_zk_watch_id: "watch-1",
    source_zk_number: "ZK/2026/0142",
    subiekt_tw_id: 100,
    symbol: "ABC",
    products: "Implant X",
    mikran_code: null,
    quantity: "2",
    delivered_quantity: "2",
    status: "Zrealizowane",
    request_kind: "zamowienie",
    ordered_at: null,
    action_at: "2026-06-01T08:00:00Z",
    delivery_at: null,
    zd_fulfillment_deadline: null,
    zd_fulfillment_previous_deadline: null,
    zd_fulfillment_deadline_changed_at: null,
    zd_fulfillment_deadline_change_seen_at: null,
    sales_acknowledged_at: null,
    sales_cancelled_at: null,
    ...partial,
  };
}

/** Minimalny mock Supabase dla fetchu kandydatów ZK. */
function createFetchSupabase(allOrders: StoredOrder[]) {
  const filterOrders = (predicate: (order: StoredOrder) => boolean) =>
    allOrders.filter(predicate) as unknown as ZkLinkableOrder[];

  return {
    from: (table: string) => {
      if (table !== "individual_orders") {
        throw new Error(`Unexpected table: ${table}`);
      }
      const filters: Array<(order: StoredOrder) => boolean> = [];

      const runQuery = () => filterOrders((order) => filters.every((fn) => fn(order)));

      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push((order) => (order as Record<string, unknown>)[column] === value);
          return chain;
        },
        is: (column: string, value: null) => {
          filters.push((order) => (order as Record<string, unknown>)[column] === value);
          return chain;
        },
        not: (column: string, _op: string, value: null) => {
          filters.push((order) => (order as Record<string, unknown>)[column] != value);
          return chain;
        },
        ilike: (column: string, pattern: string) => {
          const literal = pattern.replace(/%/g, "").toLowerCase();
          filters.push((order) =>
            String((order as Record<string, unknown>)[column] ?? "")
              .toLowerCase()
              .includes(literal)
          );
          return chain;
        },
        or: () => chain,
        order: () => chain,
        range: () =>
          Promise.resolve({
            data: runQuery(),
            error: null,
          }),
        then: (
          resolve: (value: { data: ZkLinkableOrder[]; error: null }) => void
        ) => resolve({ data: runQuery(), error: null }),
      };

      return chain;
    },
  };
}

/** Mock Supabase dla mutacji ack (in-memory). */
function createAckSupabase(
  initialOrders: StoredOrder[],
  options?: { failUpdateOnField?: string }
) {
  const orders = new Map(initialOrders.map((order) => [order.id, { ...order }]));
  const updateLog: Array<{ field: string; ids: string[]; value: unknown }> = [];

  const client = {
    from: (table: string) => {
      if (table !== "individual_orders") throw new Error(`Unexpected table: ${table}`);
      let selectedIds: string[] | null = null;
      let updatePatch: Record<string, unknown> | null = null;

      const chain = {
        select: () => chain,
        in: (_column: string, ids: string[]) => {
          selectedIds = ids;
          return chain;
        },
        eq: () => chain,
        is: () => chain,
        update: (patch: Record<string, unknown>) => {
          updatePatch = patch;
          return chain;
        },
        then: (
          resolve: (value: {
            data: StoredOrder[] | null;
            error: { message: string } | null;
          }) => void
        ) => {
          if (updatePatch && selectedIds) {
            const field = Object.keys(updatePatch)[0]!;
            if (options?.failUpdateOnField === field) {
              resolve({ data: null, error: { message: `Symulowany błąd: ${field}` } });
              return;
            }
            updateLog.push({ field, ids: [...selectedIds], value: updatePatch[field] });
            for (const id of selectedIds) {
              const row = orders.get(id);
              if (row) {
                Object.assign(row, updatePatch);
              }
            }
            resolve({ data: null, error: null });
            return;
          }
          const rows = (selectedIds ?? [])
            .map((id) => orders.get(id))
            .filter((row): row is StoredOrder => Boolean(row));
          resolve({ data: rows, error: null });
        },
      };

      return chain;
    },
    orders,
    updateLog,
  };

  return client;
}

describe("zk-watch-close workflow — audyt poprawek", () => {
  describe("#1 fetch: ZK z kh, prośba bez kh po nazwie", () => {
    it("znajduje prośbę bez sales_client_kh_id dopasowaną po etykiecie", async () => {
      const labelOnlyOrder = pickupOrder({
        id: "label-only",
        sales_client_kh_id: null,
        sales_client_name: "Klinika Smile",
        source_zk_watch_id: null,
        source_zk_number: null,
      });
      const khOrder = pickupOrder({ id: "by-kh" });
      const unrelated = pickupOrder({
        id: "other-client",
        sales_client_kh_id: 99,
        sales_client_name: "Inny klient",
        source_zk_watch_id: null,
        source_zk_number: null,
        subiekt_tw_id: 999,
        symbol: "INNY",
        products: "Inny produkt",
      });

      const supabase = createFetchSupabase([labelOnlyOrder, khOrder, unrelated]);
      const candidates = await fetchZkWatchPendingAckOrderCandidates(watch(), supabase);

      expect(candidates.map((order) => order.id).sort()).toEqual(["by-kh", "label-only"]);
    });
  });

  describe("#3 race: już potwierdzone pozycje", () => {
    it("pomija już zackowane przy ack odbioru", async () => {
      const supabase = createAckSupabase([
        pickupOrder({ id: "done", sales_acknowledged_at: "2026-06-10T08:00:00Z" }),
        pickupOrder({ id: "pending" }),
      ]);

      const result = await acknowledgeOrdersWithClient(
        supabase,
        SALES_PERSON_ID,
        ["done", "pending"],
        { allowedStatuses: ["Zrealizowane"] },
        { revalidate: false }
      );

      expect(result).toEqual({ count: 1, ackedIds: ["pending"] });
      expect(supabase.orders.get("pending")?.sales_acknowledged_at).toBeTruthy();
      expect(supabase.orders.get("done")?.sales_acknowledged_at).toBe("2026-06-10T08:00:00Z");
    });

    it("pomija już widzianą zmianę terminu ZD", async () => {
      const supabase = createAckSupabase([
        pickupOrder({
          id: "zd-done",
          zd_fulfillment_deadline_changed_at: "2026-06-18T08:00:00Z",
          zd_fulfillment_deadline_change_seen_at: "2026-06-18T09:00:00Z",
        }),
        pickupOrder({
          id: "zd-pending",
          status: "Zamowione",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_previous_deadline: "2026-07-01",
          zd_fulfillment_deadline_changed_at: "2026-06-18T08:00:00Z",
          zd_fulfillment_deadline_change_seen_at: null,
        }),
      ]);

      const result = await acknowledgeZdDeadlineWithClient(
        supabase,
        SALES_PERSON_ID,
        ["zd-done", "zd-pending"],
        { revalidate: false }
      );

      expect(result).toEqual({ count: 1, ackedIds: ["zd-pending"] });
      expect(supabase.orders.get("zd-pending")?.zd_fulfillment_deadline_change_seen_at).toBeTruthy();
    });
  });

  describe("#5 dopasowanie: bez jawnego linku ZK wymaga towaru", () => {
    it("nie blokuje zamknięcia gdy inny towar tego samego klienta", () => {
      const unrelated = pickupOrder({
        id: "unrelated",
        source_zk_watch_id: null,
        source_zk_number: null,
        subiekt_tw_id: 999,
        symbol: "INNY",
        products: "Inny produkt",
      });
      expect(isOrderPendingAckForZkClose(unrelated, watch())).toBe(false);
      expect(collectZkWatchPendingAckItems(watch(), [unrelated])).toEqual([]);
    });
  });

  describe("#7 rollback przy częściowym błędzie ack", () => {
    it("cofa ZD seen_at gdy kolejny krok ack rzuca błąd", async () => {
      const zdOrder = pickupOrder({
        id: "zd-step",
        status: "Zamowione",
        zd_fulfillment_deadline: "2026-07-15",
        zd_fulfillment_previous_deadline: "2026-07-01",
        zd_fulfillment_deadline_changed_at: "2026-06-18T08:00:00Z",
      });
      const pickup = pickupOrder({ id: "pickup-step" });

      const supabase = createAckSupabase([zdOrder, pickup], {
        failUpdateOnField: "sales_acknowledged_at",
      });
      const items = collectZkWatchPendingAckItems(watch(), [zdOrder, pickup]);

      await expect(
        executeZkWatchPendingAckPlan(watch(), items, supabase, SALES_PERSON_ID)
      ).rejects.toThrow("Symulowany błąd: sales_acknowledged_at");

      expect(supabase.orders.get("zd-step")?.zd_fulfillment_deadline_change_seen_at).toBeNull();
      expect(supabase.orders.get("pickup-step")?.sales_acknowledged_at).toBeNull();
    });
  });
});

describe("zk-watch-close workflow — pełny przebieg", () => {
  it("preview → ack plan → brak pending (scenariusz zamknięcia ZK)", async () => {
    const w = watch();
    const explicitPickup = pickupOrder({ id: "explicit-pickup" });
    const labelCompanion = pickupOrder({
      id: "label-companion",
      sales_client_kh_id: null,
      sales_client_name: "Klinika Smile",
      source_zk_watch_id: null,
      source_zk_number: null,
    });
    const alreadyDone = pickupOrder({
      id: "already-done",
      sales_acknowledged_at: "2026-06-10T08:00:00Z",
    });

    const fetchSupabase = createFetchSupabase([
      explicitPickup,
      labelCompanion,
      alreadyDone,
    ]);
    const previewItems = await resolveZkWatchPendingAckItemsForWatch(w, fetchSupabase);

    expect(previewItems.map((item) => item.orderId).sort()).toEqual([
      "explicit-pickup",
      "label-companion",
    ]);

    const ackSupabase = createAckSupabase([explicitPickup, labelCompanion]);
    const ackCount = await executeZkWatchPendingAckPlan(
      w,
      previewItems,
      ackSupabase,
      SALES_PERSON_ID
    );

    expect(ackCount).toBe(2);
    expect(ackSupabase.orders.get("explicit-pickup")?.sales_acknowledged_at).toBeTruthy();
    expect(ackSupabase.orders.get("label-companion")?.sales_acknowledged_at).toBeTruthy();

    const postAckFetch = createFetchSupabase(
      [explicitPickup, labelCompanion].map((order) => ({
        ...order,
        sales_acknowledged_at: ackSupabase.orders.get(order.id)?.sales_acknowledged_at ?? null,
      }))
    );
    const remaining = await resolveZkWatchPendingAckItemsForWatch(w, postAckFetch);
    expect(remaining).toEqual([]);
  });

  it("preview pusty → można zamknąć ZK bez modala (logika serwera)", async () => {
    const w = watch();
    const done = pickupOrder({
      id: "only-done",
      sales_acknowledged_at: "2026-06-10T08:00:00Z",
    });
    const supabase = createFetchSupabase([done]);
    const items = await resolveZkWatchPendingAckItemsForWatch(w, supabase);
    expect(items).toEqual([]);
  });

  it("race: drugi ack pomija już potwierdzone i kończy z pustą listą pending", async () => {
    const w = watch();
    const order = pickupOrder({ id: "race-pickup" });
    const items = collectZkWatchPendingAckItems(w, [order]);

    const supabase = createAckSupabase([
      pickupOrder({ id: "race-pickup", sales_acknowledged_at: "2026-06-18T08:00:00Z" }),
    ]);

    const ackCount = await executeZkWatchPendingAckPlan(w, items, supabase, SALES_PERSON_ID);
    expect(ackCount).toBe(0);

    const postAck = createFetchSupabase([
      { ...order, sales_acknowledged_at: "2026-06-18T08:00:00Z" },
    ]);
    const remaining = await resolveZkWatchPendingAckItemsForWatch(w, postAck);
    expect(remaining).toEqual([]);
  });
});
