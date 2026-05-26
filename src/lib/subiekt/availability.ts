import { testSubiektConnection } from "@/lib/subiekt/client";
import { getSubiektConfigSummary, isSubiektConfigured } from "@/lib/subiekt/config";

/** Sonda health — nie blokuje strony tak długo jak pełne zapytania ZD. */
const PROBE_TIMEOUT_MS = 4_000;

/** Gdy API nie odpowiada — nie ponawiaj health co chwilę. */
const OFFLINE_CACHE_MS = 45_000;

/** Gdy działa — rzadsze pingi. */
const ONLINE_CACHE_MS = 120_000;

export type SubiektAvailability = {
  configured: boolean;
  reachable: boolean;
  checkedAt: number;
  /** Krótka etykieta w pasku statusu. */
  shortLabel: string;
  /** Jedno zdanie dla użytkownika. */
  message: string;
};

let cache: { at: number; value: SubiektAvailability } | null = null;

function notConfiguredAvailability(): SubiektAvailability {
  return {
    configured: false,
    reachable: false,
    checkedAt: Date.now(),
    shortLabel: "Subiekt: wyłączony",
    message: "Integracja Subiekt nie jest skonfigurowana — terminy z historii dostaw.",
  };
}

function offlineAvailability(message: string): SubiektAvailability {
  return {
    configured: true,
    reachable: false,
    checkedAt: Date.now(),
    shortLabel: "Subiekt: offline",
    message,
  };
}

function onlineAvailability(durationMs?: number): SubiektAvailability {
  const ms =
    durationMs != null ? ` (${durationMs} ms)` : "";
  return {
    configured: true,
    reachable: true,
    checkedAt: Date.now(),
    shortLabel: "Subiekt: połączony",
    message: `Połączenie z Subiektem działa${ms} — terminy ZD (tylko u powiązanego dostawcy) odświeżamy co ok. 2 godziny.`,
  };
}

function cacheTtlMs(reachable: boolean): number {
  return reachable ? ONLINE_CACHE_MS : OFFLINE_CACHE_MS;
}

/** Status integracji z krótką pamięcią — używaj przed kosztownymi zapytaniami ZD. */
export async function getSubiektAvailability(options?: {
  force?: boolean;
}): Promise<SubiektAvailability> {
  if (!isSubiektConfigured()) {
    cache = { at: Date.now(), value: notConfiguredAvailability() };
    return cache.value;
  }

  const now = Date.now();
  if (
    !options?.force &&
    cache &&
    now - cache.at < cacheTtlMs(cache.value.reachable)
  ) {
    return cache.value;
  }

  const result = await testSubiektConnection({ timeoutMs: PROBE_TIMEOUT_MS });
  const value: SubiektAvailability = result.ok
    ? onlineAvailability(result.durationMs)
    : offlineAvailability(
        result.message ??
          "Subiekt niedostępny (poza siecią firmową lub API wyłączone) — pokazujemy szacunki z historii."
      );

  cache = { at: now, value };
  return value;
}

/** Szybki gate — false = nie wywołuj search ZD / podpowiedzi. */
export async function isSubiektReachable(options?: {
  force?: boolean;
}): Promise<boolean> {
  const status = await getSubiektAvailability(options);
  return status.configured && status.reachable;
}

/** Reset cache (testy). */
export function resetSubiektAvailabilityCache(): void {
  cache = null;
}

/** Podsumowanie konfiguracji bez wywołania sieci. */
export function getSubiektAvailabilitySummary() {
  return getSubiektConfigSummary();
}
