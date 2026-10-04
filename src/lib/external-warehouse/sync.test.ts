import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_WAREHOUSE_SYNC_DEBOUNCE_MS } from "./constants";

const mocks = vi.hoisted(() => ({
  tryAcquireLock: vi.fn(),
  releaseLock: vi.fn(),
  getSubiektAvailability: vi.fn(),
  getSubiektZk: vi.fn(),
  searchZkForAdd: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
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

vi.mock("@/lib/subiekt/resolve-zk-document", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subiekt/resolve-zk-document")>()),
  searchZkForAdd: (...args: unknown[]) => mocks.searchZkForAdd(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
  hasSupabaseConfig: () => true,
}));

import { SubiektRequestError } from "@/lib/subiekt/errors";

const LINK_ID = "11111111-1111-4111-8111-111111111111";
const SITE_ID = "22222222-2222-4222-8222-222222222222";

/** Minimalny mock klienta bazy: CAS update linku, dziennik, udziały palet. */
function mockDb(options: { shares?: { line_key: string; pallet_label: string; qty: number; note: string | null }[] } = {}) {
  const casSelect = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "link" }, error: null }),
  });
  const afterId = {
    eq: vi.fn().mockReturnValue({ select: casSelect }),
    is: vi.fn().mockReturnValue({ select: casSelect }),
    select: casSelect,
    then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
  };
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(afterId) });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const sharesQuery = {
    eq: vi.fn().mockResolvedValue({ data: options.shares ?? [], error: null }),
  };
  const linksLookup = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === "external_warehouse_zk_links") return { update, select: vi.fn().mockReturnValue(linksLookup) };
    if (table === "external_warehouse_change_log") return { insert };
    if (table === "external_warehouse_line_pallet_shares") return { select: vi.fn().mockReturnValue(sharesQuery) };
    if (table === "external_warehouse_line_meta") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [] }), maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) };
    }
    return {};
  });
  mocks.rpc.mockResolvedValue({ data: 1, error: null });
  return { update, insert };
}

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

  it("CAS + hash unchanged - update tylko last_synced_at, bez change_log", async () => {
    const doc = {
      dok_Id: 9,
      dok_NrPelny: "ZK-1",
      dok_Pozycja: [{ ob_Id: 1, tw_Nazwa: "A", ob_Ilosc: 2 }],
    };
    const pruned = pruneSubiektZkSnapshot(doc);
    const hash = `${hashExternalWarehouseLines(pruned.lines)}:s`;

    mocks.tryAcquireLock.mockResolvedValue(true);
    mocks.getSubiektZk.mockResolvedValue(doc);
    const { insert } = mockDb();

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

describe("external-warehouse sync - aktualizacja po zmianach w Subiekcie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.releaseLock.mockResolvedValue(undefined);
    mocks.tryAcquireLock.mockResolvedValue(true);
    mocks.getSubiektAvailability.mockResolvedValue({ reachable: true, message: "ok" });
  });

  const before = {
    dok_Id: 9,
    dok_NrPelny: "ZK 7942/M/07/2026",
    dok_Status: 7,
    dok_Pozycja: [{ ob_Id: 1, ob_TowId: 50, tw_Symbol: "ECOTRAY", tw_Nazwa: "ECOtray", ob_Ilosc: 1008 }],
  };

  it("ilość w ZK spadła 1008 → 504: zapisuje snapshot i zdejmuje nadmiar palet od ostatniej", async () => {
    const pruned = pruneSubiektZkSnapshot(before);
    mocks.getSubiektZk.mockResolvedValue({
      ...before,
      dok_Pozycja: [{ ...before.dok_Pozycja[0], ob_Ilosc: 504 }],
    });
    const { update, insert } = mockDb({
      shares: [
        { line_key: "ob:1", pallet_label: "Mikran 10", qty: 504, note: null },
        { line_key: "ob:1", pallet_label: "Mikran 11", qty: 504, note: "góra" },
      ],
    });

    const result = await syncExternalWarehouseZkLink(
      {
        id: LINK_ID,
        site_id: SITE_ID,
        subiekt_dok_id: 9,
        zk_number: "ZK 7942/M/07/2026",
        client_label: "Mikran",
        last_snapshot: pruned,
        snapshot_hash: `${hashExternalWarehouseLines(pruned.lines)}:s7`,
        last_synced_at: null,
      },
      { force: true }
    );

    expect(result.status).toBe("synced");
    expect(result.diff?.quantityChanged).toEqual([{ key: "ob:1", from: 1008, to: 504 }]);
    expect(result.rebalanced).toBe(1);
    expect(update.mock.calls[0]![0].last_snapshot.lines[0].ob_Ilosc).toBe(504);
    expect(mocks.rpc).toHaveBeenCalledWith("replace_external_warehouse_line_pallet_shares", {
      p_zk_link_id: LINK_ID,
      p_line_key: "ob:1",
      p_shares: [{ pallet_label: "Mikran 10", qty: 504, note: null }],
      p_updated_by: null,
      p_max_qty: 504,
    });
    const logged = insert.mock.calls.flatMap((c) => c[0] as { kind: string; summary: string }[]);
    expect(logged.map((e) => e.kind)).toEqual(expect.arrayContaining(["qty_changed", "shares_rebalanced"]));
    expect(logged.find((e) => e.kind === "shares_rebalanced")?.summary).toContain("zdjęto paletę „Mikran 11” (504 szt.)");
  });

  it("zmiana samej nazwy towaru też aktualizuje snapshot", async () => {
    const pruned = pruneSubiektZkSnapshot(before);
    mocks.getSubiektZk.mockResolvedValue({
      ...before,
      dok_Pozycja: [{ ...before.dok_Pozycja[0], tw_Nazwa: "ECOtray LC PREMIUM" }],
    });
    const { update } = mockDb();
    const result = await syncExternalWarehouseZkLink(
      {
        id: LINK_ID,
        site_id: SITE_ID,
        subiekt_dok_id: 9,
        zk_number: "ZK 7942/M/07/2026",
        client_label: "Mikran",
        last_snapshot: pruned,
        snapshot_hash: `${hashExternalWarehouseLines(pruned.lines)}:s7`,
        last_synced_at: null,
      },
      { force: true }
    );
    expect(result.status).toBe("synced");
    expect(result.diff?.productChanged?.[0]).toMatchObject({ from: "ECOtray (ECOTRAY)", to: "ECOtray LC PREMIUM (ECOTRAY)" });
    expect(update.mock.calls[0]![0].last_snapshot.lines[0].tw_Nazwa).toBe("ECOtray LC PREMIUM");
  });

  it("ZK usunięte w Subiekcie i brak następcy - status missing z czytelnym komunikatem", async () => {
    mocks.getSubiektZk.mockRejectedValue(new SubiektRequestError(404, '{"error":"ZK document 9 not found."}'));
    mocks.searchZkForAdd.mockResolvedValue({ kind: "error", message: "Nie znaleziono" });
    const { update } = mockDb();
    const result = await syncExternalWarehouseZkLink(
      {
        id: LINK_ID,
        site_id: SITE_ID,
        subiekt_dok_id: 9,
        zk_number: "ZK 115523/M/08/2026",
        client_label: "Mikran",
        last_snapshot: pruneSubiektZkSnapshot(before),
        snapshot_hash: "x",
        last_synced_at: null,
      },
      { force: true }
    );
    expect(result.status).toBe("missing");
    expect(result.error).toMatch(/usunięte z Subiektu/);
    expect(update.mock.calls[0]![0]).toMatchObject({ last_sync_error: expect.stringMatching(/usunięte z Subiektu/) });
    expect(result.error!.length).toBeLessThanOrEqual(160);
  });

  it("nieudana próba sprzed chwili - debounce, bez ponownego pytania Subiekta", async () => {
    const now = Date.now();
    const result = await syncExternalWarehouseZkLink(
      {
        id: LINK_ID,
        site_id: SITE_ID,
        subiekt_dok_id: 9,
        zk_number: "ZK 115523/M/08/2026",
        client_label: "Mikran",
        last_snapshot: null,
        snapshot_hash: "x",
        last_synced_at: "2026-08-27T13:54:51.413Z",
        last_sync_attempt_at: new Date(now - 5_000).toISOString(),
      },
      { force: false, nowMs: now }
    );
    expect(result.status).toBe("debounced");
    expect(mocks.getSubiektZk).not.toHaveBeenCalled();
  });

  it("ZK wystawione ponownie pod tym samym numerem - podpina nowy dokument", async () => {
    const pruned = pruneSubiektZkSnapshot(before);
    mocks.getSubiektZk.mockRejectedValue(new SubiektRequestError(404, "not found"));
    const { mapZkDocument } = await import("@/lib/subiekt/resolve-zk-document");
    const newDoc = {
      ...before,
      dok_Id: 77,
      dok_Pozycja: [{ ...before.dok_Pozycja[0], ob_Id: 500 }],
    };
    mocks.searchZkForAdd.mockResolvedValue({ kind: "single", resolved: mapZkDocument(newDoc) });
    const { update, insert } = mockDb();
    const result = await syncExternalWarehouseZkLink(
      {
        id: LINK_ID,
        site_id: SITE_ID,
        subiekt_dok_id: 9,
        zk_number: "ZK 7942/M/07/2026",
        client_label: "Mikran",
        last_snapshot: pruned,
        snapshot_hash: `${hashExternalWarehouseLines(pruned.lines)}:s7`,
        last_synced_at: null,
      },
      { force: true }
    );
    expect(result.status).toBe("synced");
    expect(result.replacedDokId).toBe(77);
    expect(update.mock.calls[0]![0]).toMatchObject({ subiekt_dok_id: 77 });
    const logged = insert.mock.calls.flatMap((c) => c[0] as { kind: string }[]);
    expect(logged.map((e) => e.kind)).toContain("zk_replaced");
  });
});
