/**
 * Wspólna logika auto-odświeżania paneli live (ops / zęby / sales).
 *
 * Sprzedaż na /moje odświeża treść zaraz po zmianie wersji (cooldown ~12 s).
 * Panel dzienny i zęby powinny zachowywać się tak samo na ścieżkach głównych.
 */

export const LIVE_PANEL_AUTO_REFRESH_COOLDOWN_MS = 12_000;

/** Backup timer gdy flaga auto-odświeżania jest włączona (ścieżki poza primary). */
export const LIVE_PANEL_AUTO_REFRESH_INTERVAL_MS = 3 * 60_000;

export function shouldFireLivePanelAutoRefresh(input: {
  lastFiredAt: number;
  now?: number;
  cooldownMs?: number;
}): { fire: boolean; nextFiredAt: number } {
  const now = input.now ?? Date.now();
  const cooldownMs = input.cooldownMs ?? LIVE_PANEL_AUTO_REFRESH_COOLDOWN_MS;
  // 0 / ujemne = nigdy nie odpalano (ref startowy).
  if (input.lastFiredAt > 0 && now - input.lastFiredAt < cooldownMs) {
    return { fire: false, nextFiredAt: input.lastFiredAt };
  }
  return { fire: true, nextFiredAt: now };
}

function pathEqualsOrUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Ścieżki operacji, na których treść odświeża się od razu po zmianie wersji
 * — bez wymogu włączonego toggle w ustawieniach (jak /moje u handlowców).
 */
export function isOperationsPrimaryLiveRefreshPath(
  pathname: string | null | undefined
): boolean {
  if (!pathname) return false;
  return (
    pathEqualsOrUnder(pathname, "/podsumowanie") ||
    pathEqualsOrUnder(pathname, "/weryfikacja") ||
    pathEqualsOrUnder(pathname, "/zakupy/tablica")
  );
}

/** Panel zębów — treść kolejki / weryfikacji ma być bieżąca. */
export function isTeethPrimaryLiveRefreshPath(
  pathname: string | null | undefined
): boolean {
  return Boolean(pathname && pathEqualsOrUnder(pathname, "/zeby"));
}
