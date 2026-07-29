import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_WAREHOUSE_SYNC_DEBOUNCE_MS } from "./constants";

const mocks = vi.hoisted(() => ({
  tryAcquireLock: vi.fn(),
  releaseLock: vi.fn(),
  getSubiektAvailability: vi.fn(),
  getSubiektZk: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/services/locks", () => ({
  tryAcquireLock: (...args: unknown[]) => mocks.tryAcquireLock(...args),
  releaseLock: (...args: unknown[]) => mocks.releaseLock(...args),
}));

vi.mock("@/lib/subiekt/availability", () => ({
  getSubiektAvailability: (...args: unknown[]) =>
    mocks.getSubiektAvailability(...args),
}));

vi.mock("@/lib/subiekt/api", () => ({
  getSubiektZk: (...args: unknown[]) => mocks.getSubiektZk(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
  hasSupabaseConfig: () => true,
}));

import { syncExternalWarehouseZkLink, __test } from "./sync";
import { hashExternalWarehouseLines, pruneSubiektZkSnapshot } from "./lines";

describe("external-warehouse sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.releaseLock.mockResolvedValue(undefined);
    mocks.getSubiektAvailability.mockResolvedValue({
      reachable: true,
      message: "ok",
    });
  });

  it("debounce pomija Subiekta gdy < 45s", async () => {
    const now = Date.now();
    const result = await syncExternalWarehouseZkLink(
      {
        id: "11111111-1111-4111-8111-111111111111",
        site_id: "22222222-2222-4222-8222-222222222222",
        subiekt_dok_id: 9,
        zk_number: "ZK-1",
        client_label: "Klient",
        last_snapshot: null,
        snapshot_hash: "abc",
        last_synced_at: new Date(now - 10_000).toISOString(),
      },
      { force: false, nowMs: now }
    );
    expect(result.status).toBe("debounced");
    expect(mocks.tryAcquireLock).not.toHaveBeenCalled();
    expect(mocks.getSubiektZk).not.toHaveBeenCalled();
  });

  it("force omija debounce", () => {
    expect(
      __test.shouldSkipDebounce(
        new Date().toISOString(),
        true,
        Date.now()
      )
    ).toBe(false);
    expect(
      __test.shouldSkipDebounce(
        new Date(Date.now() - EXTERNAL_WAREHOUSE_SYNC_DEBOUNCE_MS - 1).toISOString(),
        false,
        Date.now()
      )
    ).toBe(false);
  });

  it("zajęty lock → status locked bez calla Subiekta", async () => {
    mocks.tryAcquireLock.mockResolvedValue(false);
    const result = await syncExternalWarehouseZkLink(
      {
        id: "11111111-1111-4111-8111-111111111111",
        site_id: "22222222-2222-4222-8222-222222222222",
        subiekt_dok_id: 9,
        zk_number: "ZK-1",
        client_label: "Klient",
        last_snapshot: null,
        snapshot_hash: null,
        last_synced_at: null,
      },
      { force: true }
    );
    expect(result.status).toBe("locked");
    expect(mocks.getSubiektZk).not.toHaveBeenCalled();
  });

  it("CAS + hash unchanged — update tylko last_synced_at, bez change_log", async () => {
    const doc = {
      dok_Id: 9,
      dok_NrPelny: "ZK-1",
      dok_Pozycja: [{ ob_Id: 1, tw_Nazwa: "A", ob_Ilosc: 2 }],
    };
    const pruned = pruneSubiektZkSnapshot(doc);
    const hash = hashExternalWarehouseLines(pruned.lines);

    mocks.tryAcquireLock.mockResolvedValue(true);
    mocks.getSubiektZk.mockResolvedValue(doc);

    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "link" }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const afterId = {
      eq: vi.fn().mockReturnValue({ select }),
      is: vi.fn().mockReturnValue({ select }),
      select,
    };
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(afterId),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "external_warehouse_zk_links") return { update };
      if (table === "external_warehouse_change_log") return { insert };
      return {};
    });

    const result = await syncExternalWarehouseZkLink(
      {
        id: "11111111-1111-4111-8111-111111111111",
        site_id: "22222222-2222-4222-8222-222222222222",
        subiekt_dok_id: 9,
        zk_number: "ZK-1",
        client_label: "Klient",
        last_snapshot: pruned,
        snapshot_hash: hash,
        last_synced_at: null,
      },
      { force: true, nowMs: Date.now() }
    );

    expect(result.status).toBe("unchanged");
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.releaseLock).toHaveBeenCalled();
  });
});
