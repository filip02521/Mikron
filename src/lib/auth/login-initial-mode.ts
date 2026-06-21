import { canShowCachedQuickLogin } from "@/lib/auth/login-account-preference";

export type LoginFormModeParam = "email" | "picker";

/** SSR — bez localStorage. */
export function resolveInitialManualEmailLogin(input: {
  preloadedAccountCount: number;
  modeParam: string | null;
}): boolean {
  if (input.preloadedAccountCount > 0) return false;
  if (input.modeParam === "picker") return false;
  if (input.modeParam === "email") return true;
  return true;
}

/** Klient — z znanymi ID z localStorage (przed paint). */
export function resolveClientManualEmailLogin(input: {
  preloadedAccountCount: number;
  modeParam: string | null;
  recentAccountIds: string[];
  cachedQuickLogin: boolean;
}): boolean {
  if (input.preloadedAccountCount > 0) return false;
  if (input.modeParam === "picker") return false;
  if (input.modeParam === "email") return true;
  if (input.cachedQuickLogin || input.recentAccountIds.length > 0) return false;
  return true;
}

/** Po hydracji — picker tylko gdy są zapisane konta bez cache quick login. */
export function shouldPreferAccountPickerAfterHydration(input: {
  preloadedAccountCount: number;
  modeParam: string | null;
  recentAccountIds: string[];
}): boolean {
  if (input.preloadedAccountCount > 0) return false;
  if (input.modeParam === "email" || input.modeParam === "picker") return false;
  if (canShowCachedQuickLogin()) return false;
  return input.recentAccountIds.length > 0;
}

export function loginFormModeFromParam(value: string | null): LoginFormModeParam | null {
  if (value === "email" || value === "picker") return value;
  return null;
}

export function buildLoginPageHref(
  mode: LoginFormModeParam | null,
  params: { next?: string | null; reason?: string | null }
): string {
  const search = new URLSearchParams();
  if (mode) search.set("mode", mode);
  if (params.next?.trim()) search.set("next", params.next.trim());
  if (params.reason?.trim()) search.set("reason", params.reason.trim());
  const query = search.toString();
  return query ? `/login?${query}` : "/login";
}
