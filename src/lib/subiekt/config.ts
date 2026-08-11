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

/** Port testowej kopii Subiekta (szacunek ZD / groups) — nigdy live :5080. */
export const SUBIEKT_ORDERS_TEST_PORT = 5082;

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

/**
 * Czy URL wygląda na testową kopię (:5082), a nie live (:5080).
 * Używane wyłącznie do sandboxu szacunku — zero ruchu na live.
 */
export function isSubiektOrdersTestBaseUrl(baseUrl: string): boolean {
  const port = portOf(baseUrl);
  return port === SUBIEKT_ORDERS_TEST_PORT;
}

/**
 * Snapshot historii szacunku — zapis na ORDERS :5082 (host_kind=orders_test)
 * oraz na przyszłym live. Filtr odczytu rozróżnia hosty.
 */
export function shouldPersistZdEstimateOrderSnapshots(baseUrl: string): boolean {
  return Boolean(baseUrl?.trim());
}

export type ZdEstimateSnapshotHostKind = "orders_test" | "live";

/** Tag hosta dla snapshotów historii. */
export function zdEstimateSnapshotHostKind(
  baseUrl: string
): ZdEstimateSnapshotHostKind {
  return isSubiektOrdersTestBaseUrl(baseUrl) ? "orders_test" : "live";
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
      reason:
        | "missing_orders_url"
        | "invalid_orders_url"
        | "same_as_live"
        | "not_test_port";
      message: string;
      ordersBaseUrl: string | null;
      liveBaseUrl: string | null;
    };

/**
 * Host wyłącznie pod sandbox szacunku (`/groups`, `/cechy/towarow`, `/orders/zd/estimate`).
 *
 * **Nigdy** nie spada na `SUBIEKT_API_BASE_URL` (live :5080).
 * Wymaga jawnego `SUBIEKT_API_ORDERS_BASE_URL` na porcie testowym :5082
 * i innym originie niż live.
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
        "Brak SUBIEKT_API_ORDERS_BASE_URL — szacunek działa tylko na testowym Subiekcie (:5082), nie na live (:5080).",
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

  if (liveBaseUrl && subiektSameApiOrigin(liveBaseUrl, baseUrl)) {
    return {
      ok: false,
      reason: "same_as_live",
      message:
        "SUBIEKT_API_ORDERS_BASE_URL wskazuje na ten sam host co live (SUBIEKT_API_BASE_URL). Szacunek jest zablokowany — ustaw :5082.",
      ordersBaseUrl: baseUrl,
      liveBaseUrl,
    };
  }

  if (!isSubiektOrdersTestBaseUrl(baseUrl)) {
    return {
      ok: false,
      reason: "not_test_port",
      message: `Szacunek wymaga testowego portu :${SUBIEKT_ORDERS_TEST_PORT} (teraz: ${baseUrl}). Live :5080 jest zabroniony.`,
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
 * Konfiguracja testowego API zamówień — `null` gdy brak / niebezpiecznie (= live).
 * Nie używaj jako fallbacku do codziennego Subiekta.
 */
export function getSubiektOrdersConfig(): SubiektConfig | null {
  const resolved = resolveSubiektOrdersConfig();
  return resolved.ok ? resolved.config : null;
}

export type SubiektOrdersBlockReason =
  | "missing_orders_url"
  | "invalid_orders_url"
  | "same_as_live"
  | "not_test_port";

export function getSubiektConfigSummary(): {
  configured: boolean;
  baseUrl: string | null;
  authMode: SubiektAuthMode | null;
  healthPath: string | null;
  ordersBaseUrl: string | null;
  ordersConfigured: boolean;
  ordersBlockedReason: SubiektOrdersBlockReason | null;
  ordersMessage: string | null;
} {
  const config = getSubiektConfig();
  const orders = resolveSubiektOrdersConfig();
  return {
    configured: Boolean(config),
    baseUrl: config?.baseUrl ?? null,
    authMode: config?.authMode ?? null,
    healthPath: config?.healthPath ?? null,
    ordersBaseUrl: orders.ok
      ? orders.config.baseUrl
      : (orders.ordersBaseUrl ?? null),
    ordersConfigured: orders.ok,
    ordersBlockedReason: orders.ok ? null : orders.reason,
    ordersMessage: orders.ok ? null : orders.message,
  };
}
