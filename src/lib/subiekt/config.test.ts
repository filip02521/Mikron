import { afterEach, describe, expect, it } from "vitest";
import { getSubiektConfig, getSubiektConfigSummary, isSubiektConfigured } from "./config";

const ENV_KEYS = [
  "SUBIEKT_API_BASE_URL",
  "SUBIEKT_API_KEY",
  "SUBIEKT_API_USER",
  "SUBIEKT_API_PASSWORD",
  "SUBIEKT_API_AUTH_MODE",
  "SUBIEKT_API_KEY_HEADER",
  "SUBIEKT_API_HEALTH_PATH",
  "SUBIEKT_API_TIMEOUT_MS",
] as const;

function clearSubiektEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("subiekt config", () => {
  afterEach(() => {
    clearSubiektEnv();
  });

  it("nie jest skonfigurowane bez base URL", () => {
    clearSubiektEnv();
    expect(isSubiektConfigured()).toBe(false);
    expect(getSubiektConfig()).toBeNull();
  });

  it("parsuje bearer z kluczem API", () => {
    process.env.SUBIEKT_API_BASE_URL = "https://subiekt.example.com/api/";
    process.env.SUBIEKT_API_KEY = "secret";
    const config = getSubiektConfig();
    expect(config?.baseUrl).toBe("https://subiekt.example.com/api");
    expect(config?.authMode).toBe("bearer");
    expect(config?.healthPath).toBe("/");
  });

  it("summary bez sekretów", () => {
    process.env.SUBIEKT_API_BASE_URL = "https://subiekt.example.com";
    process.env.SUBIEKT_API_KEY = "secret";
    const summary = getSubiektConfigSummary();
    expect(summary.configured).toBe(true);
    expect(summary.baseUrl).toBe("https://subiekt.example.com");
    expect(summary.authMode).toBe("bearer");
  });
});
