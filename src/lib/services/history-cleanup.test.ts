import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteResult = { count: 2, error: null as null };
const deleteMock = vi.fn();

const chainMock = {
  lt: vi.fn(),
  in: vi.fn(),
  not: vi.fn(),
  eq: vi.fn(),
  delete: deleteMock,
  then(onFulfilled: (value: typeof deleteResult) => unknown) {
    return Promise.resolve(deleteResult).then(onFulfilled);
  },
};

chainMock.lt.mockReturnValue(chainMock);
chainMock.in.mockReturnValue(chainMock);
chainMock.not.mockReturnValue(chainMock);
chainMock.eq.mockReturnValue(chainMock);
deleteMock.mockReturnValue(chainMock);

const fromMock = vi.fn(() => chainMock);

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: vi.fn(() => true),
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

describe("history-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainMock.lt.mockReturnValue(chainMock);
    chainMock.in.mockReturnValue(chainMock);
    chainMock.not.mockReturnValue(chainMock);
    chainMock.eq.mockReturnValue(chainMock);
    deleteMock.mockReturnValue(chainMock);
  });

  it("purgeDataRetention czyści wszystkie tabele retencji", async () => {
    const { purgeDataRetention } = await import("./history-cleanup");
    const result = await purgeDataRetention();

    expect(fromMock).toHaveBeenCalledTimes(10);
    expect(result.individualDeleted).toBe(2);
    expect(result.normalDeleted).toBe(2);
    expect(result.warehouseReceiptsDeleted).toBe(2);
    expect(result.operationsNotesDeleted).toBe(2);
    expect(result.productEventsDeleted).toBe(2);
    expect(result.salesBugReportsDeleted).toBe(2);
    expect(result.departmentBoardThreadsDeleted).toBe(2);
    expect(result.passwordResetOtpsDeleted).toBe(2);
    expect(result.subiektZdIndexDeleted).toBe(2);
    expect(result.authRateLimitEventsDeleted).toBe(2);
    expect(result.cutoffDateOnly).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
