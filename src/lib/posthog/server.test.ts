import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
const capture = vi.fn();

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return { captureException, capture };
  }),
}));

describe("posthog server (posthog-node 6)", () => {
  beforeEach(() => {
    vi.resetModules();
    captureException.mockReset();
    capture.mockReset();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_LAB", "");
    vi.stubEnv("POSTHOG_DISABLED", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("błąd bez sesji: id serwera, bez profilu osoby (opcja, nie właściwość)", async () => {
    const { captureServerException, SERVER_DISTINCT_ID } = await import("./server");
    const err = new Error("x");
    captureServerException(err, { route: "/api/cron/stock-watch" });
    expect(captureException).toHaveBeenCalledWith(err, {
      distinctId: SERVER_DISTINCT_ID,
      properties: { route: "/api/cron/stock-watch" },
      options: { process_person_profile: false },
    });
  });

  it("błąd z sesją: id użytkownika, profil osoby zostaje", async () => {
    const { captureServerException } = await import("./server");
    const err = new Error("x");
    captureServerException(err, { route: "/zakupy" }, "user-1");
    expect(captureException).toHaveBeenCalledWith(err, {
      distinctId: "user-1",
      properties: { route: "/zakupy" },
    });
  });

  it("zdarzenie serwera nie tworzy profilu osoby", async () => {
    const { captureServerEvent, SERVER_DISTINCT_ID } = await import("./server");
    captureServerEvent("cron_run", { job: "stock-watch" });
    expect(capture).toHaveBeenCalledWith({
      distinctId: SERVER_DISTINCT_ID,
      event: "cron_run",
      properties: { job: "stock-watch" },
      options: { process_person_profile: false },
    });
  });
});
