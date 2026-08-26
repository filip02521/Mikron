import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRaportyRunnerStatus,
  raportyRunnerStatusLabel,
} from "@/lib/services/mail/raporty-runner-status";

const ENV_KEYS = [
  "RAPORTY_RUNNER_URL",
  "NEXT_PUBLIC_RAPORTY_RUNNER_URL",
  "CRON_SECRET",
  "RAPORTY_CRON_SECRET",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function snapshotEnv() {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const v = savedEnv[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
}

describe("fetchRaportyRunnerStatus", () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("missing_url gdy brak RAPORTY_RUNNER_URL (ignoruje NEXT_PUBLIC_*)", async () => {
    snapshotEnv();
    delete process.env.RAPORTY_RUNNER_URL;
    process.env.NEXT_PUBLIC_RAPORTY_RUNNER_URL = "http://should-not-use";
    const result = await fetchRaportyRunnerStatus({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "missing_url", runnerUrl: null });
  });

  it("missing_secret gdy brak CRON_SECRET i RAPORTY_CRON_SECRET", async () => {
    snapshotEnv();
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local";
    delete process.env.CRON_SECRET;
    delete process.env.RAPORTY_CRON_SECRET;
    const result = await fetchRaportyRunnerStatus({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "missing_secret",
      runnerUrl: "http://raporty.local",
    });
    expect(raportyRunnerStatusLabel(result)).toContain("RAPORTY_CRON_SECRET");
  });

  it("odczytuje sendEnabled z runnera (preferuje RAPORTY_CRON_SECRET)", async () => {
    snapshotEnv();
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local/";
    process.env.CRON_SECRET = "shared";
    process.env.RAPORTY_CRON_SECRET = "dedicated";
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
        headers: { Authorization: "Bearer dedicated" },
      })
    );
    expect(result).toMatchObject({
      ok: true,
      sendEnabled: false,
      periodKey: "2026-W33",
      lastSentLabel: null,
      nextWeekReady: false,
    });
    expect(raportyRunnerStatusLabel(result)).toContain("IVOCLAR_SEND_ENABLED≠1");
  });

  it("unauthorized przy 401", async () => {
    snapshotEnv();
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

  it("unreachable przy 5xx", async () => {
    snapshotEnv();
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local";
    process.env.CRON_SECRET = "secret";
    const result = await fetchRaportyRunnerStatus({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "unreachable",
      detail: "HTTP 503",
    });
  });

  it("unreachable przy timeout/abort", async () => {
    snapshotEnv();
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local";
    process.env.CRON_SECRET = "secret";
    const result = await fetchRaportyRunnerStatus({
      timeoutMs: 5,
      fetchImpl: vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unreachable");
      expect(result.detail).toBeTruthy();
    }
  });

  it("invalid_response gdy brak sendEnabled", async () => {
    snapshotEnv();
    process.env.RAPORTY_RUNNER_URL = "http://raporty.local";
    process.env.CRON_SECRET = "secret";
    const result = await fetchRaportyRunnerStatus({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_response" });
  });
});
