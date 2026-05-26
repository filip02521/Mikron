import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSubiektAvailability,
  resetSubiektAvailabilityCache,
} from "./availability";

vi.mock("./client", () => ({
  testSubiektConnection: vi.fn(),
}));

vi.mock("./config", () => ({
  isSubiektConfigured: vi.fn(),
  getSubiektConfigSummary: vi.fn(() => ({
    configured: true,
    baseUrl: "http://test",
    authMode: "none",
    healthPath: "/health",
  })),
}));

import { testSubiektConnection } from "./client";
import { isSubiektConfigured } from "./config";

describe("getSubiektAvailability", () => {
  beforeEach(() => {
    resetSubiektAvailabilityCache();
    vi.mocked(isSubiektConfigured).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetSubiektAvailabilityCache();
  });

  it("zwraca offline bez ponownego health gdy cache świeży", async () => {
    vi.mocked(testSubiektConnection).mockResolvedValue({
      ok: false,
      configured: true,
      message: "timeout",
    });

    const first = await getSubiektAvailability({ force: true });
    expect(first.reachable).toBe(false);

    vi.mocked(testSubiektConnection).mockClear();
    const second = await getSubiektAvailability();
    expect(second.reachable).toBe(false);
    expect(testSubiektConnection).not.toHaveBeenCalled();
  });

  it("zwraca wyłączony gdy brak konfiguracji", async () => {
    vi.mocked(isSubiektConfigured).mockReturnValue(false);
    const status = await getSubiektAvailability({ force: true });
    expect(status.configured).toBe(false);
    expect(status.reachable).toBe(false);
    expect(testSubiektConnection).not.toHaveBeenCalled();
  });
});
