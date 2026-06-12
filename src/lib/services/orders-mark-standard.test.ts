import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseDateOnly } from "@/lib/orders/dates";

const {
  scheduleUpsert,
  historyInsert,
  recalcMock,
  todayMock,
  computedNextDate,
} = vi.hoisted(() => ({
  scheduleUpsert: vi.fn().mockResolvedValue({ error: null }),
  historyInsert: vi.fn().mockResolvedValue({ error: null }),
  recalcMock: vi.fn().mockResolvedValue(undefined),
  todayMock: vi.fn(),
  computedNextDate: { value: "2026-07-11" },
}));

vi.mock("@/lib/time/warsaw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/time/warsaw")>();
  return {
    ...actual,
    todayInWarsaw: () => todayMock(),
  };
});

vi.mock("@/lib/services/sync", () => ({
  recalcSingleSupplierSchedule: recalcMock,
}));

vi.mock("@/lib/services/history-cleanup", () => ({
  scheduleHistoryRetentionPurge: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "suppliers") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { interval_raw: "co 4 tyg.", interval_weeks: 4 },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "supplier_schedules") {
        return {
          upsert: scheduleUpsert,
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { computed_next_date: computedNextDate.value },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "normal_order_history") {
        return { insert: historyInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { markStandardOrdered } from "@/lib/services/orders";

describe("markStandardOrdered", () => {
  beforeEach(() => {
    scheduleUpsert.mockClear();
    historyInsert.mockClear();
    recalcMock.mockClear();
    todayMock.mockReturnValue(parseDateOnly("2026-06-13")!);
    computedNextDate.value = "2026-07-11";
  });

  it("zapisuje order_date z dzisiejszej daty kalendarzowej Warszawy i czyści shift_date", async () => {
    await markStandardOrdered("sup-1", "user@example.com");

    expect(scheduleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier_id: "sup-1",
        order_date: "2026-06-13",
        shift_date: null,
      }),
      { onConflict: "supplier_id" }
    );
    expect(recalcMock).toHaveBeenCalledWith("sup-1");
  });

  it("nie przesuwa order_date na poniedziałek w weekend — spójnie z replay historii", async () => {
    todayMock.mockReturnValue(parseDateOnly("2026-06-13")!);

    await markStandardOrdered("sup-1", "user@example.com");

    expect(scheduleUpsert.mock.calls[0]?.[0]).toMatchObject({
      order_date: "2026-06-13",
    });
  });

  it("loguje historię z computed_next_date po recalc", async () => {
    await markStandardOrdered("sup-1", "user@example.com");

    expect(recalcMock.mock.invocationCallOrder[0]).toBeLessThan(
      historyInsert.mock.invocationCallOrder[0] ?? Infinity
    );
    expect(historyInsert).toHaveBeenCalledWith({
      supplier_id: "sup-1",
      action: "Zamówione",
      user_email: "user@example.com",
      next_date: "2026-07-11",
    });
  });
});
