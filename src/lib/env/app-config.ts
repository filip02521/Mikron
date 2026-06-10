/** Czy aplikacja działa w trybie produkcyjnym (Vercel / NODE_ENV). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

const DEFAULT_APP_URL = "http://localhost:3000";

/** Usuwa końcowy slash — spójne linki w mailach i auth. */
export function normalizeAppBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function getAppUrl(): string {
  return normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL);
}

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

export function isLoopbackAppUrl(url: string): boolean {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Host z reverse proxy — używane przy generowaniu linków auth na serwerze. */
export function appUrlFromForwardedHeaders(h: Headers): string | null {
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.trim();
  if (!host) return null;

  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() || "http";
  if (proto !== "http" && proto !== "https") return null;

  return normalizeAppBaseUrl(`${proto}://${host}`);
}

/** Wewnętrzna sieć firmowa (LAN / domena .mikran.pl) — HTTP jest OK. */
export function isInternalAppHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return false;
  if (h.endsWith(".mikran.pl") || h === "mikran.pl") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

/**
 * Produkcyjny URL aplikacji: https publicznie albo wewnętrzna domena/IP (HTTP w LAN).
 * Ustaw APP_ALLOW_HTTP=1 aby wymusić akceptację dowolnego http:// w health checku.
 */
export function isAppUrlProductionReady(): boolean {
  if (process.env.APP_ALLOW_HTTP === "1") return true;
  try {
    const u = new URL(getAppUrl());
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && isInternalAppHostname(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Adresy do Supabase → Authentication → Redirect URLs (whitelist). */
export function getSupabaseAuthRedirectUrls(): string[] {
  const urls = new Set<string>();
  const base = getAppUrl();
  urls.add(`${base}/**`);

  const serverAppUrl = process.env.APP_URL?.trim();
  if (serverAppUrl) {
    urls.add(`${normalizeAppBaseUrl(serverAppUrl)}/**`);
  }

  const serverHost = process.env.APP_SERVER_HOST?.trim();
  const port = process.env.APP_PORT?.trim() || "3000";
  if (serverHost) {
    urls.add(`http://${serverHost}:${port}/**`);
    urls.add(`http://${serverHost}/**`);
  }

  try {
    const parsed = new URL(base);
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      urls.add(`${parsed.protocol}//${parsed.hostname}/**`);
    }
  } catch {
    /* ignore */
  }

  for (const entry of (process.env.APP_EXTRA_REDIRECT_URLS ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    urls.add(trimmed.endsWith("/**") ? trimmed : `${normalizeAppBaseUrl(trimmed)}/**`);
  }

  return [...urls];
}

export function getCronSecret(): string | undefined {
  const s = process.env.CRON_SECRET?.trim();
  if (!s || s === "change-me-in-production") return undefined;
  return s;
}
