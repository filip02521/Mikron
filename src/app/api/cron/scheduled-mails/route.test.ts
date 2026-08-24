import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuthorize = vi.hoisted(() => vi.fn());
const mockRecordSkipped = vi.hoisted(() => vi.fn());
const mockWarsawContext = vi.hoisted(() =>
  vi.fn(() => ({
    hour: 8,
    dateKey: "2026-08-17",
    weekday: "Mon",
    isWeekend: false,
  }))
);

vi.mock("@/lib/services/cron-auth", () => ({
  authorizeCronRequest: mockAuthorize,
}));

vi.mock("@/lib/time/warsaw-cron", () => ({
  recordCronSkipped: mockRecordSkipped,
  warsawCronContext: mockWarsawContext,
}));

describe("GET /api/cron/scheduled-mails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockReturnValue(null);
    mockRecordSkipped.mockResolvedValue(undefined);
  });

  it("zawsze pomija z reason moved_to_ontime_raporty", async () => {
    const { GET } = await import("@/app/api/cron/scheduled-mails/route");
    const res = await GET(
      new NextRequest("https://example.com/api/cron/scheduled-mails", {
        headers: { authorization: "Bearer test" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      skipped: true,
      reason: "moved_to_ontime_raporty",
    });
    expect(mockRecordSkipped).toHaveBeenCalledWith(
      "scheduled_mails",
      "moved_to_ontime_raporty"
    );
  });

  it("odrzuca nieautoryzowane żądanie", async () => {
    const { NextResponse } = await import("next/server");
    mockAuthorize.mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const { GET } = await import("@/app/api/cron/scheduled-mails/route");
    const res = await GET(
      new NextRequest("https://example.com/api/cron/scheduled-mails")
    );
    expect(res.status).toBe(401);
    expect(mockRecordSkipped).not.toHaveBeenCalled();
  });
});
