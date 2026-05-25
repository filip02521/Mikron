import { getSubiektConfig, type SubiektConfig } from "@/lib/subiekt/config";
import { SubiektNotConfiguredError, SubiektRequestError } from "@/lib/subiekt/errors";

export type SubiektHealthResult = {
  ok: boolean;
  configured: boolean;
  url?: string;
  status?: number;
  durationMs?: number;
  message?: string;
  error?: string;
};

function buildAuthHeaders(config: SubiektConfig): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  switch (config.authMode) {
    case "bearer":
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      break;
    case "api-key-header":
      if (config.apiKey) headers[config.apiKeyHeader] = config.apiKey;
      break;
    case "basic": {
      const user = config.username ?? "";
      const pass = config.password ?? config.apiKey ?? "";
      if (user && pass) {
        headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
      }
      break;
    }
    case "none":
      break;
  }

  return headers;
}

function resolveUrl(config: SubiektConfig, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${config.baseUrl}${normalized}`;
}

function snippet(text: string, max = 240): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

/** Niskopoziomowe wywołanie HTTP do API Subiekta (mostek REST / własny serwis). */
export async function subiektFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const config = getSubiektConfig();
  if (!config) throw new SubiektNotConfiguredError();

  const headers = new Headers(buildAuthHeaders(config));
  const extra = init.headers ? new Headers(init.headers) : null;
  if (extra) {
    extra.forEach((value, key) => headers.set(key, value));
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    return await fetch(resolveUrl(config, path), {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function subiektJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await subiektFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new SubiektRequestError(res.status, snippet(text || res.statusText));
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SubiektRequestError(res.status, "Odpowiedź nie jest poprawnym JSON");
  }
}

/** Test połączenia — domyślnie GET na SUBIEKT_API_HEALTH_PATH. */
export async function testSubiektConnection(): Promise<SubiektHealthResult> {
  const config = getSubiektConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      error: "not_configured",
      message: "Uzupełnij SUBIEKT_API_BASE_URL w .env.local",
    };
  }

  const url = resolveUrl(config, config.healthPath);
  const started = Date.now();

  try {
    const res = await subiektFetch(config.healthPath, { method: "GET" });
    const durationMs = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        url,
        status: res.status,
        durationMs,
        error: "http_error",
        message: snippet(text || res.statusText),
      };
    }

    return {
      ok: true,
      configured: true,
      url,
      status: res.status,
      durationMs,
      message:
        text.length > 0
          ? `Połączenie OK (${res.status}) — ${snippet(text, 120)}`
          : `Połączenie OK (${res.status})`,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? `Przekroczono limit czasu (${config.timeoutMs} ms)`
          : e.message
        : "Nieznany błąd połączenia";

    return {
      ok: false,
      configured: true,
      url,
      durationMs,
      error: "network_error",
      message,
    };
  }
}
