import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingNotificationQueueIdsForOrder } from "./delivery-notification-queue";

function mockSupabase(rows: Array<{ id: string }> = []) {
  // Obiekt końcowy — ma data/error (dostępne po destrukturyzacji)
  // oraz wszystkie metody chain zwracające same siebie.
  const terminal = { data: rows, error: null };
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // Dwa wywołania .is() — pierwsze zwraca this, drugie zwraca terminal
    is: vi.fn().mockReturnValue(terminal),
    in: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    // Właściwości terminalne
    data: rows,
    error: null,
  };
  // Pierwsze .is() musi zwracać chain (dla drugiego .is())
  // Drugie .is() musi zwracać terminal
  let isCallCount = 0;
  chain.is = vi.fn().mockImplementation(() => {
    isCallCount++;
    return isCallCount === 1 ? chain : terminal;
  });

  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  });
  return chain;
}

describe("getPendingNotificationQueueIdsForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("zwraca ID nieanulowanych, niewysłanych wpisów dla zamówienia", async () => {
    mockSupabase([{ id: "q1" }, { id: "q2" }]);
    const ids = await getPendingNotificationQueueIdsForOrder("order-123");
    expect(ids).toEqual(["q1", "q2"]);
  });

  it("zwraca pustą tablicę gdy brak wpisów", async () => {
    mockSupabase([]);
    const ids = await getPendingNotificationQueueIdsForOrder("order-456");
    expect(ids).toEqual([]);
  });
});
