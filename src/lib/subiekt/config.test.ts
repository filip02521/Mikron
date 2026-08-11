import { afterEach, describe, expect, it } from "vitest";
import {
  getSubiektConfig,
  getSubiektConfigSummary,
  getSubiektOrdersConfig,
  isSubiektConfigured,
  isSubiektOrdersAllowedBaseUrl,
  isSubiektOrdersLiveBaseUrl,
  isSubiektOrdersTestBaseUrl,
  resolveSubiektOrdersConfig,
  shouldPersistZdEstimateOrderSnapshots,
  subiektSameApiOrigin,
  zdEstimateOrdersHostLabel,
  zdEstimateSnapshotHostKind,
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
    expect(summary.ordersIsLive).toBe(false);
  });

  it("orders nie spada na live bez jawnego ORDERS_URL", () => {
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
    expect(summary.ordersHostKind).toBe("orders_test");
    expect(summary.ordersIsLive).toBe(false);
    expect(summary.ordersPort).toBe(5082);
  });

  it("pozwala ORDERS na live :5080 (aktualna baza) — host_kind=live", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_ORDERS_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    const resolved = resolveSubiektOrdersConfig();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.config.baseUrl).toBe("http://192.168.0.140:5080/api/v1");
    }
    const summary = getSubiektConfigSummary();
    expect(summary.ordersConfigured).toBe(true);
    expect(summary.ordersHostKind).toBe("live");
    expect(summary.ordersIsLive).toBe(true);
    expect(summary.ordersPort).toBe(5080);
    expect(summary.ordersHostLabel).toContain("LIVE");
  });

  it("blokuje ORDERS gdy port spoza :5080/:5082", () => {
    process.env.SUBIEKT_API_BASE_URL = "http://192.168.0.140:5080/api/v1";
    process.env.SUBIEKT_API_ORDERS_BASE_URL = "http://192.168.0.140:5099/api/v1";
    process.env.SUBIEKT_API_AUTH_MODE = "none";
    const resolved = resolveSubiektOrdersConfig();
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.reason).toBe("not_allowed_port");
    expect(getSubiektOrdersConfig()).toBeNull();
  });

  it("isSubiektOrders*BaseUrl / same origin / labels", () => {
    expect(isSubiektOrdersTestBaseUrl("http://192.168.0.140:5082/api/v1")).toBe(
      true
    );
    expect(isSubiektOrdersLiveBaseUrl("http://192.168.0.140:5080/api/v1")).toBe(
      true
    );
    expect(isSubiektOrdersAllowedBaseUrl("http://192.168.0.140:5080/api/v1")).toBe(
      true
    );
    expect(isSubiektOrdersAllowedBaseUrl("http://192.168.0.140:5099/api/v1")).toBe(
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
    expect(zdEstimateOrdersHostLabel("http://192.168.0.140:5080/api/v1")).toMatch(
      /LIVE/
    );
    expect(zdEstimateOrdersHostLabel("http://192.168.0.140:5082/api/v1")).toMatch(
      /Test/
    );
  });

  it("shouldPersistZdEstimateOrderSnapshots tylko na dozwolonych portach", () => {
    expect(
      shouldPersistZdEstimateOrderSnapshots("http://192.168.0.140:5082/api/v1")
    ).toBe(true);
    expect(
      shouldPersistZdEstimateOrderSnapshots("http://192.168.0.140:5080/api/v1")
    ).toBe(true);
    expect(shouldPersistZdEstimateOrderSnapshots("")).toBe(false);
    expect(
      shouldPersistZdEstimateOrderSnapshots("http://192.168.0.140:5099/api/v1")
    ).toBe(false);
  });

  it("zdEstimateSnapshotHostKind rozróżnia :5082 vs live (inaczej null)", () => {
    expect(
      zdEstimateSnapshotHostKind("http://192.168.0.140:5082/api/v1")
    ).toBe("orders_test");
    expect(
      zdEstimateSnapshotHostKind("http://192.168.0.140:5080/api/v1")
    ).toBe("live");
    expect(
      zdEstimateSnapshotHostKind("http://192.168.0.140:5099/api/v1")
    ).toBeNull();
  });
});
