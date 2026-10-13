import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMojePageData } from "@/lib/orders/moje-page-helpers";
import { loadSalesInboxData } from "@/lib/sales/fetch-sales-inbox";

// Serwerowy build Reacta (warunek „react-server”) — tylko w nim `cache()` memoizuje.
vi.mock("react", async () => {
  const { createRequire } = await import("node:module");
  const path = await import("node:path");
  const req = createRequire(import.meta.url);
  const dir = path.dirname(req.resolve("react/package.json"));
  return req(path.join(dir, "cjs/react.react-server.development.js"));
});

const q = vi.hoisted(() => ({
  fetchIndividualOrders: vi.fn(async () => []),
  fetchDeliveryStats: vi.fn(async () => []),
  fetchSalesAcknowledgedOrders: vi.fn(async () => []),
  fetchSuppliersForRequestForms: vi.fn(async () => []),
  fetchSuppliersOnVacationNow: vi.fn(async () => ({})),
  fetchSalesDayStartNotepadSlice: vi.fn(async () => ({ zkWatches: [], notes: [] })),
  fetchSalesBoardAttentionSnapshot: vi.fn(async () => null),
  fetchDepartmentBoardAnnouncements: vi.fn(async () => null),
}));

vi.mock("@/lib/data/queries", () => q);
vi.mock("@/lib/data/sales-notepad", () => ({
  fetchSalesDayStartNotepadSlice: q.fetchSalesDayStartNotepadSlice,
  countNotesDueFromSlice: () => 0,
  countZkDueFromWatches: () => 0,
}));
vi.mock("@/lib/data/department-board", () => ({
  fetchSalesBoardAttentionSnapshot: q.fetchSalesBoardAttentionSnapshot,
  fetchDepartmentBoardAnnouncements: q.fetchDepartmentBoardAnnouncements,
}));
vi.mock("@/lib/orders/planned-order-schedule", () => ({
  loadPlannedOrderScheduleContext: async () => ({ supplierScheduleById: {}, weekDays: [] }),
}));

/** Symulacja jednego żądania RSC: dispatcher z mapą cache, jak w Next. */
async function inRequestScope<T>(fn: () => Promise<T>): Promise<T> {
  const internals = (
    React as unknown as {
      __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { A: unknown };
    }
  ).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const caches = new Map<() => unknown, unknown>();
  internals.A = {
    getCacheForType: (create: () => unknown) => {
      if (!caches.has(create)) caches.set(create, create());
      return caches.get(create);
    },
  };
  try {
    return await fn();
  } finally {
    internals.A = null;
  }
}

afterEach(() => vi.clearAllMocks());

describe("dedup danych handlowca w jednym żądaniu (layout + /moje)", () => {
  it("layout i strona /moje pobierają prośby, statystyki, notatnik i tablicę raz", async () => {

    await inRequestScope(async () => {
      // AppShell (fetchSalesShellMetrics) i strona ruszają równolegle w jednym renderze.
      await Promise.all([
        loadSalesInboxData("sp-1", "user-1"),
        loadMojePageData(
          {
            role: "sales",
            workspaces: [],
            salesPersonId: "sp-1",
            salesPersonName: "X",
            ownSalesPersonId: "sp-1",
            linkError: null,
            isTeamPreview: false,
            isDelegatePreview: false,
            activeDelegations: [],
            sessionUserId: "user-1",
          },
          {
            salesPanelView: true,
            viewingOwnPanel: true,
            isTeamPreview: false,
            delegatePreviewActive: false,
            adminSalesPreview: true,
            showSalesPersonOrdersPanel: true,
            loadMojeAnnouncements: false,
          }
        ),
      ]);
    });

    expect(q.fetchIndividualOrders).toHaveBeenCalledTimes(1);
    expect(q.fetchDeliveryStats).toHaveBeenCalledTimes(1);
    expect(q.fetchSalesDayStartNotepadSlice).toHaveBeenCalledTimes(1);
    expect(q.fetchSalesBoardAttentionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("osobne żądania nie współdzielą wyniku", async () => {
    await inRequestScope(() => loadSalesInboxData("sp-1", "user-1"));
    await inRequestScope(() => loadSalesInboxData("sp-1", "user-1"));
    expect(q.fetchIndividualOrders).toHaveBeenCalledTimes(2);
  });
});
