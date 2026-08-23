import { describe, expect, it, vi } from "vitest";
import {
  fetchRaportyRunnerStatus,
  raportyRunnerStatusLabel,
} from "@/lib/services/mail/raporty-runner-status";

describe("fetchRaportyRunnerStatus", () => {
  it("missing_url gdy brak RAPORTY_RUNNER_URL", async () => {
    const prev = process.env.RAPORTY_RUNNER_URL;
    const prevPub = process.env.NEXT_PUBLIC_RAPORTY_RUNNER_URL;
    delete process.env.RAPORTY_RUNNER_URL;
    delete process.env.NEXT_PUBLIC_RAPORTY_RUNNER_URL;
    const result = await fetchRaportyRunnerStatus({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "missing_url", runnerUrl: null });
    if (prev !== undefined) process.env.RAPORTY_RUNNER_URL = prev;
    if (prevPub !== undefined) process.env.NEXT_PUBLIC_RAPORTY_RUNNER_URL = prevPub;
  });

  it("odczytuje sendEnabled z runnera", async () => {
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local";
    process.env.CRON_SECRET = "secret";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sendEnabled: false,
        overrideTo: null,
        productionSent: false,
        period: { periodKey: "2026-W33", periodLabel: "10–16 (2026-W33)" },
      }),
    });

    const result = await fetchRaportyRunnerStatus({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://raporty.local/api/ivoclar/status",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret" },
      })
    );
    expect(result).toMatchObject({
      ok: true,
      sendEnabled: false,
      periodKey: "2026-W33",
    });
    expect(raportyRunnerStatusLabel(result)).toContain("IVOCLAR_SEND_ENABLED≠1");
  });

  it("unauthorized przy 401", async () => {
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local";
    process.env.CRON_SECRET = "secret";
    const result = await fetchRaportyRunnerStatus({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({ ok: false, reason: "unauthorized" });
  });
});
