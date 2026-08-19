import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IndividualOrder } from "@/types/database";

const {
  isEnabledMock,
  isConfiguredMock,
  isReachableMock,
  tryAcquireMock,
  releaseMock,
  fetchQueueMock,
  fetchStockMock,
  markArrivedMock,
  revalidateMock,
} = vi.hoisted(() => ({
  isEnabledMock: vi.fn(),
  isConfiguredMock: vi.fn(),
  isReachableMock: vi.fn(),
  tryAcquireMock: vi.fn(),
  releaseMock: vi.fn(),
  fetchQueueMock: vi.fn(),
  fetchStockMock: vi.fn(),
  markArrivedMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/lib/data/informacja-stock-auto", () => ({
  fetchInformacjaStockAutoEnabled: () => isEnabledMock(),
}));

vi.mock("@/lib/subiekt/config", () => ({
  isSubiektConfigured: () => isConfiguredMock(),
}));

vi.mock("@/lib/subiekt/availability", () => ({
  isSubiektReachable: () => isReachableMock(),
}));

vi.mock("@/lib/services/locks", () => ({
  tryAcquireLock: (...args: unknown[]) => tryAcquireMock(...args),
  releaseLock: (...args: unknown[]) => releaseMock(...args),
}));

vi.mock("@/lib/data/queries", () => ({
  fetchInformacjaQueue: () => fetchQueueMock(),
}));

vi.mock("@/lib/orders/fetch-prosba-line-stock", () => ({
  fetchProsbaLineStock: (...args: unknown[]) => fetchStockMock(...args),
}));

vi.mock("@/lib/services/orders", () => ({
  markInformacjaArrived: (...args: unknown[]) => markArrivedMock(...args),
}));

vi.mock("@/lib/orders/informacja-arrived-revalidate", () => ({
  revalidateAfterInformacjaArrived: () => revalidateMock(),
}));

import { runInformacjaStockAutoArrive } from "./informacja-stock-sync";

function informacjaRow(id: string, twId = 100): IndividualOrder {
  return {
    id,
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "X",
    products: "Towar",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "informacja",
    status: "Nowe",
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    informacja_queue_via_daily_panel: false,
    informacja_stock_out_reorder: false,
    subiekt_tw_id: twId,
    is_teeth: false,
  } as IndividualOrder;
}

describe("runInformacjaStockAutoArrive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEnabledMock.mockReturnValue(true);
    isConfiguredMock.mockReturnValue(true);
    isReachableMock.mockResolvedValue(true);
    tryAcquireMock.mockResolvedValue(true);
    releaseMock.mockResolvedValue(undefined);
    fetchQueueMock.mockResolvedValue([]);
    fetchStockMock.mockResolvedValue({});
    markArrivedMock.mockResolvedValue({
      updated: 0,
      skipped: 0,
      requested: 0,
      emailSent: 0,
    });
  });

  it("pomija gdy kill switch wyłączony", async () => {
    isEnabledMock.mockReturnValue(false);
    const result = await runInformacjaStockAutoArrive();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("disabled");
    expect(tryAcquireMock).not.toHaveBeenCalled();
  });

  it("subiekt_not_configured — skip bez subiektOffline", async () => {
    isConfiguredMock.mockReturnValue(false);
    const result = await runInformacjaStockAutoArrive();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("subiekt_not_configured");
    expect(result.subiektOffline).toBeUndefined();
  });

  it("pomija gdy lock zajęty", async () => {
    tryAcquireMock.mockResolvedValue(false);
    const result = await runInformacjaStockAutoArrive();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("lock_held");
    expect(fetchQueueMock).not.toHaveBeenCalled();
  });

  it("zwalnia lock w finally", async () => {
    fetchQueueMock.mockRejectedValue(new Error("boom"));
    await expect(runInformacjaStockAutoArrive()).rejects.toThrow("boom");
    expect(releaseMock).toHaveBeenCalledWith("informacja-stock-auto-arrive");
  });

  it("domyka kandydatów ze stanem i revaliduje", async () => {
    fetchQueueMock.mockResolvedValue([informacjaRow("o1", 100)]);
    fetchStockMock.mockResolvedValue({
      100: { onHand: 5, reserved: 0, available: 5, source: "subiekt" },
    });
    markArrivedMock.mockResolvedValue({
      updated: 1,
      skipped: 0,
      requested: 1,
      emailSent: 1,
    });

    const result = await runInformacjaStockAutoArrive({
      lockedBy: "test",
      revalidate: true,
    });

    expect(result.candidates).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.updated).toBe(1);
    expect(markArrivedMock).toHaveBeenCalledWith(["o1"], {
      source: "stock_auto",
      stockByTwId: expect.objectContaining({
        100: expect.objectContaining({ available: 5 }),
      }),
    });
    expect(revalidateMock).toHaveBeenCalled();
  });

  it("TOCTOU — pomija gdy stan zniknie przed zapisem", async () => {
    fetchQueueMock.mockResolvedValue([informacjaRow("o1", 100)]);
    fetchStockMock
      .mockResolvedValueOnce({
        100: { onHand: 3, reserved: 0, available: 3, source: "subiekt" },
      })
      .mockResolvedValueOnce({
        100: { onHand: 0, reserved: 0, available: 0, source: "subiekt" },
      });

    const result = await runInformacjaStockAutoArrive({ revalidate: false });

    expect(result.eligible).toBe(1);
    expect(result.updated).toBe(0);
    expect(markArrivedMock).not.toHaveBeenCalled();
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(fetchStockMock).toHaveBeenCalledTimes(2);
  });

  it("chunkowanie — osobny fetch stanu per batch mark", async () => {
    const orders = Array.from({ length: 31 }, (_, i) =>
      informacjaRow(`o-${i}`, 100 + i)
    );
    fetchQueueMock.mockResolvedValue(orders);
    fetchStockMock.mockImplementation(async (twIds: number[]) => {
      const out: Record<number, { onHand: number; reserved: number; available: number; source: "subiekt" }> = {};
      for (const id of twIds) {
        out[id] = { onHand: 2, reserved: 0, available: 2, source: "subiekt" };
      }
      return out;
    });
    markArrivedMock.mockResolvedValue({
      updated: 30,
      skipped: 0,
      requested: 30,
      emailSent: 30,
    });

    await runInformacjaStockAutoArrive({ revalidate: false });

    expect(markArrivedMock).toHaveBeenCalledTimes(2);
    expect(markArrivedMock.mock.calls[0]![0]).toHaveLength(30);
    expect(markArrivedMock.mock.calls[1]![0]).toHaveLength(1);
    expect(fetchStockMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
