import { describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { loadSupplierHistoriaOrderDates } from "@/lib/orders/supplier-historia-order-dates";

describe("loadSupplierHistoriaOrderDates", () => {
  it("zwraca posortowane unikalne daty zamówień głównych", async () => {
    mockOrder.mockResolvedValue({
      data: [
        { action_at: "2026-05-12T10:00:00.000Z", action: "Zamówione" },
        { action_at: "2026-06-01T08:00:00.000Z", action: "Zamówione" },
        { action_at: "2026-05-12T11:00:00.000Z", action: "Zamówione" },
      ],
      error: null,
    });
    mockGte.mockReturnValue({ order: mockOrder });
    mockEq.mockReturnValue({ gte: mockGte });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const dates = await loadSupplierHistoriaOrderDates("supplier-1");

    expect(mockFrom).toHaveBeenCalledWith("normal_order_history");
    expect(dates).toEqual(["2026-05-12", "2026-06-01"]);
  });

  it("propaguje błąd bazy", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "db down" } });
    mockGte.mockReturnValue({ order: mockOrder });
    mockEq.mockReturnValue({ gte: mockGte });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    await expect(loadSupplierHistoriaOrderDates("supplier-1")).rejects.toThrow("db down");
  });
});
