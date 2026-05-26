import { getSubiektConfig, type SubiektConfig } from "@/lib/subiekt/config";
import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import {
  feedbackFromException,
  getSubiektFeedback,
  type SubiektFeedback,
} from "@/lib/subiekt/feedback";

export type SubiektHealthResult = {
  ok: boolean;
  configured: boolean;
  url?: string;
  status?: number;
  durationMs?: number;
  message?: string;
  error?: string;
  /** Z GET /health — status API Subiekta */
  apiStatus?: "ok" | "degraded";
  sqlConfigured?: boolean;
  /** Komunikat dla użytkownika (sukces z ostrzeżeniem lub błąd) */
  feedback?: SubiektFeedback;
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
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new SubiektTimeoutError(config.timeoutMs);
    }
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new SubiektNetworkError(msg, e);
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
export async function testSubiektConnection(options?: {
  /** Krótszy limit na sondę dostępności (np. przed listą zamówień). */
  timeoutMs?: number;
}): Promise<SubiektHealthResult> {
  const config = getSubiektConfig();
  if (!config) {
    const feedback = getSubiektFeedback("not_configured", {
      hint: "Uzupełnij SUBIEKT_API_BASE_URL w .env.local (patrz .env.subiekt.work.example).",
    });
    return {
      ok: false,
      configured: false,
      error: feedback.code,
      message: feedback.message,
      feedback,
    };
  }

  const url = resolveUrl(config, config.healthPath);
  const started = Date.now();
  const probeTimeoutMs = Math.min(
    options?.timeoutMs ?? config.timeoutMs,
    config.timeoutMs
  );

  try {
    const headers = new Headers(buildAuthHeaders(config));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), probeTimeoutMs);
    let res: Response;
    try {
      res = await fetch(resolveUrl(config, config.healthPath), {
        method: "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new SubiektTimeoutError(probeTimeoutMs);
      }
      const msg = e instanceof Error ? e.message : "fetch failed";
      throw new SubiektNetworkError(msg, e);
    } finally {
      clearTimeout(timeout);
    }
    const durationMs = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      const feedback = feedbackFromException(
        new SubiektRequestError(res.status, snippet(text || res.statusText))
      );
      return {
        ok: false,
        configured: true,
        url,
        status: res.status,
        durationMs,
        error: feedback.code,
        message: feedback.message,
        feedback,
      };
    }

    let apiStatus: "ok" | "degraded" | undefined;
    let sqlConfigured: boolean | undefined;
    if (text) {
      try {
        const parsed = JSON.parse(text) as {
          data?: { status?: string; sqlConfigured?: boolean };
        };
        const data = parsed.data;
        if (data?.status === "ok" || data?.status === "degraded") {
          apiStatus = data.status;
        }
        if (typeof data?.sqlConfigured === "boolean") {
          sqlConfigured = data.sqlConfigured;
        }
      } catch {
        /* nie envelope — zostaw tylko HTTP OK */
      }
    }

    const healthOk = apiStatus === undefined || apiStatus === "ok";
    const parts: string[] = [`Połączenie OK (${res.status})`];
    if (apiStatus) parts.push(`status: ${apiStatus}`);
    if (sqlConfigured !== undefined) {
      parts.push(sqlConfigured ? "SQL: skonfigurowane" : "SQL: brak konfiguracji");
    }

    let feedback: SubiektFeedback | undefined;
    if (apiStatus === "degraded") {
      feedback = getSubiektFeedback("health_degraded");
    } else if (sqlConfigured === false) {
      feedback = getSubiektFeedback("sql_not_configured");
    }

    return {
      ok: healthOk,
      configured: true,
      url,
      status: res.status,
      durationMs,
      apiStatus,
      sqlConfigured,
      message: parts.join(" · "),
      error: healthOk ? undefined : "health_degraded",
      feedback,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    const feedback = feedbackFromException(e);

    return {
      ok: false,
      configured: true,
      url,
      durationMs,
      error: feedback.code,
      message: feedback.message,
      feedback,
    };
  }
}
