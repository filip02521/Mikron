import { afterEach, describe, expect, it } from "vitest";
import {
  getSubiektConfig,
  getSubiektConfigSummary,
  getSubiektOrdersConfig,
  isSubiektConfigured,
  isSubiektOrdersTestBaseUrl,
  resolveSubiektOrdersConfig,
  subiektSameApiOrigin,
} from "./config";

const ENV_KEYS = [
  "SUBIEKT_API_BASE_URL",
  "SUBIEKT_API_ORDERS_BASE_URL",
  "SUBIEKT_API_ORDERS_TIMEOUT_MS",
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
    expect(config?.healthPath).toBe("/health");
  });

  it("honoruje authMode=none bez klucza", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    const config = getSubiektConfig();
    expect(config?.authMode).toBe("none");
    expect(config?.healthPath).toBe("/health");
  });

  it("summary bez sekretów", () => {
    process.env.SUBIEKT_API_BASE_URL = "https://subiekt.example.com";
    process.env.SUBIEKT_API_KEY = "secret";
    const summary = getSubiektConfigSummary();
    expect(summary.configured).toBe(true);
    expect(summary.baseUrl).toBe("https://subiekt.example.com");
    expect(summary.authMode).toBe("bearer");
    expect(summary.ordersConfigured).toBe(false);
    expect(summary.ordersBlockedReason).toBe("missing_orders_url");
  });

  it("orders NIGDY nie spada na live — bez ORDERS_URL = null", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    expect(getSubiektOrdersConfig()).toBeNull();
    const resolved = resolveSubiektOrdersConfig();
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe("missing_orders_url");
  });

  it("orders na :5082 działa obok live :5080", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_ORDERS_BASE_URL = "http://192.168.0.140:5082/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    const orders = getSubiektOrdersConfig();
    expect(orders?.baseUrl).toBe("http://192.168.0.140:5082/api/v1");
    expect(getSubiektConfig()?.baseUrl).toBe("http://192.168.0.140:5080/api/v1");
    const summary = getSubiektConfigSummary();
    expect(summary.ordersConfigured).toBe(true);
    expect(summary.ordersBaseUrl).toBe("http://192.168.0.140:5082/api/v1");
  });

  it("blokuje ORDERS gdy wskazuje na ten sam host co live", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_ORDERS_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    const resolved = resolveSubiektOrdersConfig();
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe("same_as_live");
    expect(getSubiektOrdersConfig()).toBeNull();
  });

  it("blokuje ORDERS gdy port ≠ 5082", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_ORDERS_BASE_URL = "http://192.168.0.140:5099/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    const resolved = resolveSubiektOrdersConfig();
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe("not_test_port");
  });

  it("isSubiektOrdersTestBaseUrl / same origin", () => {
    expect(isSubiektOrdersTestBaseUrl("http://192.168.0.140:5082/api/v1")).toBe(
      true
    );
    expect(isSubiektOrdersTestBaseUrl("http://192.168.0.140:5080/api/v1")).toBe(
      false
    );
    expect(
      subiektSameApiOrigin(
        "http://192.168.0.140:5080/api/v1",
        "http://192.168.0.140:5080/api/v1"
      )
    ).toBe(true);
    expect(
      subiektSameApiOrigin(
        "http://192.168.0.140:5080/api/v1",
        "http://192.168.0.140:5082/api/v1"
      )
    ).toBe(false);
  });
});
