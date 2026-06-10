import { headers } from "next/headers";
import {
  appUrlFromForwardedHeaders,
  getAppUrl,
  isInternalAppHostname,
  isLoopbackAppUrl,
  normalizeAppBaseUrl,
} from "@/lib/env/app-config";

function configuredServerAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  return normalizeAppBaseUrl(raw);
}

/**
 * URL aplikacji do linków auth (reset / zaproszenie).
 * Priorytet: APP_URL (runtime) → NEXT_PUBLIC bez localhost → Host żądania → fallback env.
 */
export async function resolveAppUrl(): Promise<string> {
  const fromServerEnv = configuredServerAppUrl();
  if (fromServerEnv) return fromServerEnv;

  const fromPublicEnv = getAppUrl();
  if (!isLoopbackAppUrl(fromPublicEnv)) return fromPublicEnv;

  try {
    const fromRequest = appUrlFromForwardedHeaders(await headers());
    if (fromRequest && !isLoopbackAppUrl(fromRequest)) {
      try {
        if (isInternalAppHostname(new URL(fromRequest).hostname)) return fromRequest;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* poza kontekstem żądania (cron, testy) */
  }

  return fromPublicEnv;
}
