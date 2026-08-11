export type SubiektAuthMode = "bearer" | "basic" | "api-key-header" | "none";

export type SubiektConfig = {
  baseUrl: string;
  authMode: SubiektAuthMode;
  apiKey?: string;
  apiKeyHeader: string;
  username?: string;
  password?: string;
  healthPath: string;
  timeoutMs: number;
};

/** Port testowej kopii Subiekta (sandbox historyczny). */
export const SUBIEKT_ORDERS_TEST_PORT = 5082;

/**
 * Port live Subiekta (aktualna baza MIKRAN).
 * Szacunek ZD / create ZD mogą iść tutaj — świadomie, z host_kind=live.
 */
export const SUBIEKT_ORDERS_LIVE_PORT = 5080;

/** Dozwolone porty hosta ORDERS (szacunek / create ZD). */
export const SUBIEKT_ORDERS_ALLOWED_PORTS = [
  SUBIEKT_ORDERS_LIVE_PORT,
  SUBIEKT_ORDERS_TEST_PORT,
] as const;

function trimOrUndefined(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

function normalizeBaseUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  return parsed.origin + parsed.pathname.replace(/\/$/, "");
}

function resolveAuth(params: {
  apiKey?: string;
  username?: string;
  password?: string;
  authModeEnv?: string;
}): Pick<SubiektConfig, "authMode" | "apiKey" | "username" | "password"> {
  const { apiKey, username, password, authModeEnv } = params;
  let authMode: SubiektAuthMode = "none";
  if (authModeEnv === "none") {
    authMode = "none";
  } else if (apiKey) {
    if (authModeEnv === "basic") authMode = "basic";
    else if (authModeEnv === "api-key-header") authMode = "api-key-header";
    else authMode = "bearer";
  } else if (username && password) {
    authMode = "basic";
  }
  return { authMode, apiKey, username, password };
}

function originKey(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function portOf(baseUrl: string): number | null {
  try {
    const u = new URL(baseUrl);
    if (u.port) return Number(u.port);
    return u.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

/** Czy dwa base URL wskazują na ten sam origin (host:port). */
export function subiektSameApiOrigin(a: string, b: string): boolean {
  const ka = originKey(a);
  const kb = originKey(b);
  return Boolean(ka && kb && ka === kb);
}

/** Czy URL to testowa kopia (:5082). */
export function isSubiektOrdersTestBaseUrl(baseUrl: string): boolean {
  const port = portOf(baseUrl);
  return port === SUBIEKT_ORDERS_TEST_PORT;
}

/** Czy URL to live Subiekt (:5080, aktualna baza). */
export function isSubiektOrdersLiveBaseUrl(baseUrl: string): boolean {
  const port = portOf(baseUrl);
  return port === SUBIEKT_ORDERS_LIVE_PORT;
}

/** Czy URL jest dozwolonym hostem ORDERS (live lub test). */
export function isSubiektOrdersAllowedBaseUrl(baseUrl: string): boolean {
  const port = portOf(baseUrl);
  return (
    port === SUBIEKT_ORDERS_LIVE_PORT || port === SUBIEKT_ORDERS_TEST_PORT
  );
}

/**
 * Snapshot historii szacunku — zapis na dozwolonym hoście ORDERS.
 * Filtr odczytu rozróżnia hosty przez host_kind.
 */
export function shouldPersistZdEstimateOrderSnapshots(baseUrl: string): boolean {
  return Boolean(baseUrl?.trim()) && isSubiektOrdersAllowedBaseUrl(baseUrl);
}

export type ZdEstimateSnapshotHostKind = "orders_test" | "live";

/**
 * Tag hosta dla snapshotów historii.
 * Tylko jawne porty :5080 → live, :5082 → orders_test.
 */
export function zdEstimateSnapshotHostKind(
  baseUrl: string
): ZdEstimateSnapshotHostKind | null {
  if (isSubiektOrdersLiveBaseUrl(baseUrl)) return "live";
  if (isSubiektOrdersTestBaseUrl(baseUrl)) return "orders_test";
  return null;
}

/** Jak `zdEstimateSnapshotHostKind`, ale rzuca gdy URL nie jest dozwolonym ORDERS. */
export function requireZdEstimateSnapshotHostKind(
  baseUrl: string
): ZdEstimateSnapshotHostKind {
  const kind = zdEstimateSnapshotHostKind(baseUrl);
  if (!kind) {
    throw new Error(
      `host_kind wymaga portu :${SUBIEKT_ORDERS_LIVE_PORT} lub :${SUBIEKT_ORDERS_TEST_PORT} (URL: ${baseUrl}).`
    );
  }
  return kind;
}

/** Krótka etykieta hosta ORDERS do UI / logów. */
export function zdEstimateOrdersHostLabel(baseUrl: string): string {
  const port = portOf(baseUrl);
  if (port === SUBIEKT_ORDERS_LIVE_PORT) {
    return `LIVE baza aktualna (:${SUBIEKT_ORDERS_LIVE_PORT})`;
  }
  if (port === SUBIEKT_ORDERS_TEST_PORT) {
    return `Test (:${SUBIEKT_ORDERS_TEST_PORT})`;
  }
  return port != null ? `Subiekt :${port}` : "Subiekt ORDERS";
}

export function isSubiektConfigured(): boolean {
  return Boolean(trimOrUndefined(process.env.SUBIEKT_API_BASE_URL));
}

/** Konfiguracja z env — bez sekretów w odpowiedziach API. */
export function getSubiektConfig(): SubiektConfig | null {
  const baseUrlRaw = trimOrUndefined(process.env.SUBIEKT_API_BASE_URL);
  if (!baseUrlRaw) return null;

  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  if (!baseUrl) return null;

  const apiKey = trimOrUndefined(process.env.SUBIEKT_API_KEY);
  const username = trimOrUndefined(process.env.SUBIEKT_API_USER);
  const password = trimOrUndefined(process.env.SUBIEKT_API_PASSWORD);
  const apiKeyHeader =
    trimOrUndefined(process.env.SUBIEKT_API_KEY_HEADER) ?? "X-Api-Key";
  const authModeEnv = trimOrUndefined(process.env.SUBIEKT_API_AUTH_MODE);
  const auth = resolveAuth({ apiKey, username, password, authModeEnv });

  const healthPath = trimOrUndefined(process.env.SUBIEKT_API_HEALTH_PATH) ?? "/health";
  const timeoutRaw = Number(process.env.SUBIEKT_API_TIMEOUT_MS ?? "15000");
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15000;

  return {
    baseUrl,
    ...auth,
    apiKeyHeader,
    healthPath: healthPath.startsWith("/") ? healthPath : `/${healthPath}`,
    timeoutMs,
  };
}

export type SubiektOrdersConfigStatus =
  | { ok: true; config: SubiektConfig }
  | {
      ok: false;
      reason: "missing_orders_url" | "invalid_orders_url" | "not_allowed_port";
      message: string;
      ordersBaseUrl: string | null;
      liveBaseUrl: string | null;
    };

/**
 * Host pod szacunek ZD (`/groups`, `/cechy/towarow`, `/orders/zd/estimate`, create ZD).
 *
 * Wymaga jawnego `SUBIEKT_API_ORDERS_BASE_URL` na dozwolonym porcie:
 * - `:5080` — LIVE, aktualna baza MIKRAN (produkcyjne dokumenty),
 * - `:5082` — testowa kopia (gdy dostępna).
 *
 * Nie spada cicho na `SUBIEKT_API_BASE_URL` — ORDERS musi być ustawione wprost.
 */
export function resolveSubiektOrdersConfig(): SubiektOrdersConfigStatus {
  const live = getSubiektConfig();
  const liveBaseUrl = live?.baseUrl ?? null;
  const ordersRaw = trimOrUndefined(process.env.SUBIEKT_API_ORDERS_BASE_URL);

  if (!ordersRaw) {
    return {
      ok: false,
      reason: "missing_orders_url",
      message:
        "Brak SUBIEKT_API_ORDERS_BASE_URL — ustaw host szacunku (:5080 live / :5082 test).",
      ordersBaseUrl: null,
      liveBaseUrl,
    };
  }

  const baseUrl = normalizeBaseUrl(ordersRaw);
  if (!baseUrl) {
    return {
      ok: false,
      reason: "invalid_orders_url",
      message: "SUBIEKT_API_ORDERS_BASE_URL jest niepoprawnym URL.",
      ordersBaseUrl: ordersRaw,
      liveBaseUrl,
    };
  }

  if (!isSubiektOrdersAllowedBaseUrl(baseUrl)) {
    const port = portOf(baseUrl);
    return {
      ok: false,
      reason: "not_allowed_port",
      message: `Szacunek wymaga portu :${SUBIEKT_ORDERS_LIVE_PORT} (live) lub :${SUBIEKT_ORDERS_TEST_PORT} (test) — teraz: ${
        port != null ? `:${port}` : baseUrl
      }.`,
      ordersBaseUrl: baseUrl,
      liveBaseUrl,
    };
  }

  const apiKey = trimOrUndefined(process.env.SUBIEKT_API_KEY);
  const username = trimOrUndefined(process.env.SUBIEKT_API_USER);
  const password = trimOrUndefined(process.env.SUBIEKT_API_PASSWORD);
  const apiKeyHeader =
    trimOrUndefined(process.env.SUBIEKT_API_KEY_HEADER) ??
    live?.apiKeyHeader ??
    "X-Api-Key";
  const authModeEnv = trimOrUndefined(process.env.SUBIEKT_API_AUTH_MODE);
  const auth = resolveAuth({ apiKey, username, password, authModeEnv });

  const healthPath =
    trimOrUndefined(process.env.SUBIEKT_API_HEALTH_PATH) ??
    live?.healthPath ??
    "/health";
  const timeoutRaw = Number(
    process.env.SUBIEKT_API_ORDERS_TIMEOUT_MS ??
      process.env.SUBIEKT_API_TIMEOUT_MS ??
      "60000"
  );
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0
      ? timeoutRaw
      : (live?.timeoutMs ?? 60000);

  return {
    ok: true,
    config: {
      baseUrl,
      ...auth,
      apiKeyHeader,
      healthPath: healthPath.startsWith("/") ? healthPath : `/${healthPath}`,
      timeoutMs,
    },
  };
}

/**
 * Konfiguracja API zamówień / szacunku — `null` gdy brak lub niedozwolony port.
 * Nie używaj jako fallbacku do codziennego Subiekta bez świadomego ORDERS_URL.
 */
export function getSubiektOrdersConfig(): SubiektConfig | null {
  const resolved = resolveSubiektOrdersConfig();
  return resolved.ok ? resolved.config : null;
}

export type SubiektOrdersBlockReason =
  | "missing_orders_url"
  | "invalid_orders_url"
  | "not_allowed_port";

export function getSubiektConfigSummary(): {
  configured: boolean;
  baseUrl: string | null;
  authMode: SubiektAuthMode | null;
  healthPath: string | null;
  ordersBaseUrl: string | null;
  ordersConfigured: boolean;
  ordersBlockedReason: SubiektOrdersBlockReason | null;
  ordersMessage: string | null;
  ordersHostKind: ZdEstimateSnapshotHostKind | null;
  ordersIsLive: boolean;
  ordersPort: number | null;
  ordersHostLabel: string | null;
} {
  const config = getSubiektConfig();
  const orders = resolveSubiektOrdersConfig();
  const ordersBaseUrl = orders.ok
    ? orders.config.baseUrl
    : (orders.ordersBaseUrl ?? null);
  const ordersHostKind = orders.ok
    ? zdEstimateSnapshotHostKind(orders.config.baseUrl)
    : null;
  const ordersPort = orders.ok ? portOf(orders.config.baseUrl) : null;
  return {
    configured: Boolean(config),
    baseUrl: config?.baseUrl ?? null,
    authMode: config?.authMode ?? null,
    healthPath: config?.healthPath ?? null,
    ordersBaseUrl,
    ordersConfigured: orders.ok,
    ordersBlockedReason: orders.ok ? null : orders.reason,
    ordersMessage: orders.ok ? null : orders.message,
    ordersHostKind,
    ordersIsLive: ordersHostKind === "live",
    ordersPort,
    ordersHostLabel: orders.ok
      ? zdEstimateOrdersHostLabel(orders.config.baseUrl)
      : null,
  };
}
