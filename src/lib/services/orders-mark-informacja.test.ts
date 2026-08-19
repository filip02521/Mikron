import { describe, expect, it, vi, beforeEach } from "vitest";

const { updateMock, sendEmailsMock, resolveEmailMock, updateReturnsRows } = vi.hoisted(
  () => ({
    updateMock: vi.fn(),
    sendEmailsMock: vi.fn(),
    resolveEmailMock: vi.fn(),
    updateReturnsRows: { value: true },
  })
);

vi.mock("@/lib/services/history-cleanup", () => ({
  scheduleHistoryRetentionPurge: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: () => true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "o1",
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
                subiekt_tw_id: 100,
                is_teeth: false,
                supplier: { id: "s1", name: "Dostawca" },
                sales_person: { id: "sp1", name: "Jan", email: "jan@example.com" },
              },
              error: null,
            }),
        }),
      }),
      update: (...args: unknown[]) => {
        updateMock(...args);
        return {
          eq: () => ({
            in: () => ({
              select: () =>
                Promise.resolve({
                  data: updateReturnsRows.value ? [{ id: "o1" }] : [],
                  error: null,
                }),
            }),
          }),
        };
      },
    }),
  }),
}));

vi.mock("@/lib/services/email", () => ({
  sendInformacjaArrivedEmails: (...args: unknown[]) => sendEmailsMock(...args),
  sendDeliveryNotificationEmails: vi.fn(),
  sendProcurementCancelEmails: vi.fn(),
  sendRequestNoteUpdateEmails: vi.fn(),
}));

vi.mock("@/lib/orders/resolve-sales-person-email", () => ({
  resolveSalesPersonEmail: (...args: unknown[]) => resolveEmailMock(...args),
}));

import { markInformacjaArrived } from "./orders";

describe("markInformacjaArrived stock_auto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateReturnsRows.value = true;
    resolveEmailMock.mockResolvedValue({
      personId: "sp1",
      email: "jan@example.com",
      name: "Jan",
    });
    sendEmailsMock.mockResolvedValue({ sent: 1, failures: [] });
  });

  it("pomija gdy stan niedostępny (TOCTOU)", async () => {
    const result = await markInformacjaArrived(["o1"], {
      source: "stock_auto",
      stockByTwId: {
        100: { onHand: 0, reserved: 0, available: 0, source: "subiekt" },
      },
    });

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendEmailsMock).not.toHaveBeenCalled();
  });

  it("zapisuje informacja_arrived_source=stock_auto przy dodatnim stanie", async () => {
    const result = await markInformacjaArrived(["o1"], {
      source: "stock_auto",
      stockByTwId: {
        100: { onHand: 4, reserved: 1, available: 3, source: "subiekt" },
      },
    });

    expect(result.updated).toBe(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Zrealizowane",
        informacja_arrived_source: "stock_auto",
      })
    );
    expect(sendEmailsMock).toHaveBeenCalled();
  });

  it("pomija gdy status już nie w kolejce (wyścig ręczny/auto)", async () => {
    updateReturnsRows.value = false;
    const result = await markInformacjaArrived(["o1"], {
      source: "stock_auto",
      stockByTwId: {
        100: { onHand: 5, reserved: 0, available: 5, source: "subiekt" },
      },
    });

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sendEmailsMock).not.toHaveBeenCalled();
  });
});
