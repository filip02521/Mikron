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

function trimOrUndefined(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

export function isSubiektConfigured(): boolean {
  return Boolean(trimOrUndefined(process.env.SUBIEKT_API_BASE_URL));
}

/** Konfiguracja z env — bez sekretów w odpowiedziach API. */
export function getSubiektConfig(): SubiektConfig | null {
  const baseUrl = trimOrUndefined(process.env.SUBIEKT_API_BASE_URL);
  if (!baseUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }

  const apiKey = trimOrUndefined(process.env.SUBIEKT_API_KEY);
  const username = trimOrUndefined(process.env.SUBIEKT_API_USER);
  const password = trimOrUndefined(process.env.SUBIEKT_API_PASSWORD);
  const apiKeyHeader =
    trimOrUndefined(process.env.SUBIEKT_API_KEY_HEADER) ?? "X-Api-Key";

  let authMode: SubiektAuthMode = "none";
  if (apiKey) {
    const mode = trimOrUndefined(process.env.SUBIEKT_API_AUTH_MODE);
    if (mode === "basic") authMode = "basic";
    else if (mode === "api-key-header") authMode = "api-key-header";
    else authMode = "bearer";
  } else if (username && password) {
    authMode = "basic";
  }

  const healthPath = trimOrUndefined(process.env.SUBIEKT_API_HEALTH_PATH) ?? "/";
  const timeoutRaw = Number(process.env.SUBIEKT_API_TIMEOUT_MS ?? "15000");
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15000;

  return {
    baseUrl: parsed.origin + parsed.pathname.replace(/\/$/, ""),
    authMode,
    apiKey,
    apiKeyHeader,
    username,
    password,
    healthPath: healthPath.startsWith("/") ? healthPath : `/${healthPath}`,
    timeoutMs,
  };
}

export function getSubiektConfigSummary(): {
  configured: boolean;
  baseUrl: string | null;
  authMode: SubiektAuthMode | null;
  healthPath: string | null;
} {
  const config = getSubiektConfig();
  if (!config) {
    return { configured: false, baseUrl: null, authMode: null, healthPath: null };
  }
  return {
    configured: true,
    baseUrl: config.baseUrl,
    authMode: config.authMode,
    healthPath: config.healthPath,
  };
}
