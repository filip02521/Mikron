import { describe, expect, it, vi, beforeEach } from "vitest";

const upsert = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ upsert }) }),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn() }));

import { recordCronRun } from "./cron-run-log";
import { captureServerEvent } from "@/lib/posthog/server";

describe("recordCronRun → puls PostHog", () => {
  beforeEach(() => {
    upsert.mockReset();
    vi.mocked(captureServerEvent).mockReset();
  });

  it("wysyła cron_run z jobem, wynikiem i powodem pominięcia, bez reszty detail", async () => {
    upsert.mockResolvedValue({ error: null });
    await recordCronRun("stock_watch", {
      ok: true,
      detail: { skipped: true, reason: "outside_warsaw_window", rows: [{ klient: "x" }] },
    });
    expect(captureServerEvent).toHaveBeenCalledWith("cron_run", {
      job: "stock_watch",
      ok: true,
      skipped: true,
      reason: "outside_warsaw_window",
      error: undefined,
    });
  });

  it("wysyła puls także, gdy zapis w bazie się nie uda", async () => {
    upsert.mockResolvedValue({ error: { message: "db down" } });
    expect(await recordCronRun("catalog_zd_sync", { ok: false, error: "Subiekt timeout" })).toBe(false);
    expect(captureServerEvent).toHaveBeenCalledWith(
      "cron_run",
      expect.objectContaining({ job: "catalog_zd_sync", ok: false, skipped: false, error: "Subiekt timeout" })
    );
  });
});
