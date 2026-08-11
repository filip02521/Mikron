/**
 * Jednorazowy claim autorun „Przygotuj ZD” (Strict Mode + remount).
 * Klucz pochodzi z SSR (launchKey) — bez tego launchedRef resetuje się przy remount.
 */

export const ZD_ESTIMATE_LAUNCH_AUTORUN_STORAGE_PREFIX =
  "zd-estimate-launch-autorun:";

export type ZdEstimateLaunchAutorunClaim =
  | "claimed"
  | "already_done"
  | "unavailable";

function storageKey(launchKey: string): string {
  return `${ZD_ESTIMATE_LAUNCH_AUTORUN_STORAGE_PREFIX}${launchKey}`;
}

export function claimZdEstimateLaunchAutorun(
  launchKey: string | null | undefined
): ZdEstimateLaunchAutorunClaim {
  const key = String(launchKey ?? "").trim();
  if (!key) return "unavailable";
  if (typeof sessionStorage === "undefined") return "unavailable";
  try {
    const full = storageKey(key);
    if (sessionStorage.getItem(full) === "done") return "already_done";
    sessionStorage.setItem(full, "pending");
    return "claimed";
  } catch {
    return "unavailable";
  }
}

/** Po cleanup effectu (Strict Mode) — pozwól remountowi ponowić claim. */
export function releaseZdEstimateLaunchAutorunPending(
  launchKey: string | null | undefined
): void {
  const key = String(launchKey ?? "").trim();
  if (!key || typeof sessionStorage === "undefined") return;
  try {
    const full = storageKey(key);
    if (sessionStorage.getItem(full) === "pending") {
      sessionStorage.removeItem(full);
    }
  } catch {
    // ignore
  }
}

export function markZdEstimateLaunchAutorunDone(
  launchKey: string | null | undefined
): void {
  const key = String(launchKey ?? "").trim();
  if (!key || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(key), "done");
  } catch {
    // ignore
  }
}

export function isZdEstimateLaunchAutorunDone(
  launchKey: string | null | undefined
): boolean {
  const key = String(launchKey ?? "").trim();
  if (!key || typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(storageKey(key)) === "done";
  } catch {
    return false;
  }
}

/** Czy feedback / komunikat to timeout / abort limitu serwera. */
export function isZdEstimateLaunchTimeoutFeedback(input: {
  code?: string | null;
  message?: string | null;
  title?: string | null;
}): boolean {
  const code = String(input.code ?? "").toLowerCase();
  if (code === "timeout") return true;
  const blob = `${input.title ?? ""} ${input.message ?? ""}`.toLowerCase();
  return (
    blob.includes("timeout") ||
    blob.includes("limit czasu") ||
    blob.includes("przekroczono czas") ||
    blob.includes("aborted") ||
    blob.includes("504") ||
    blob.includes("timed out")
  );
}

export const ZD_ESTIMATE_LAUNCH_TIMEOUT_FEEDBACK = {
  title: "Przygotowanie ZD trwało zbyt długo",
  message:
    "Limit czasu serwera został przekroczony przy budowaniu listy do zamówienia.",
  hint: "Spróbuj ponownie (Policz listę) albo zawęź zakres. Duże cechy (np. Ivoclar) mogą wymagać kilku minut.",
} as const;
