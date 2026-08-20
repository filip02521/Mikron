/**
 * Deterministyczny postęp checklisty „Przygotuj ZD”.
 * Nie zależy od setInterval w workbenchu (resetowany przy change `estimating`).
 */

export const ZD_ESTIMATE_LAUNCH_STEP_MS = 1600;
export const ZD_ESTIMATE_LAUNCH_MIN_VISIBLE_MS = 3200;
export const ZD_ESTIMATE_LAUNCH_STEP_COUNT = 4;

/** Wolniejszy rytm dla route loading (bootstrap SSR) — mniej „skacze”, dłużej żyje. */
export const ZD_ESTIMATE_ROUTE_LOADING_STEP_MS = 1100;
export const ZD_ESTIMATE_ROUTE_LOADING_STEP_COUNT = 3;

/** Wznowienie sesji po wyjściu z kreatora — szybszy rytm niż Policz, wolniejszy niż błysk. */
export const ZD_ESTIMATE_SESSION_RESUME_STEP_MS = 900;
export const ZD_ESTIMATE_SESSION_RESUME_STEP_COUNT = 3;
/** Krótki finisz animacji po restore — lista jest już gotowa pod spodem. */
export const ZD_ESTIMATE_SESSION_RESUME_MIN_VISIBLE_MS = 900;
/** Po udanym restore nie czekamy dłużej — tylko domknięcie checklisty. */
export const ZD_ESTIMATE_SESSION_RESUME_COMPLETE_TAIL_MS = 350;

/**
 * @param elapsedMs — czas od startu panelu
 * @param scopeAlreadyResolved — po SSR zakres jest znany → krok 0 od razu „done”
 */
export function launchProgressStepFromElapsed(
  elapsedMs: number,
  opts?: { scopeAlreadyResolved?: boolean; stepMs?: number; stepCount?: number }
): number {
  const stepMs = opts?.stepMs ?? ZD_ESTIMATE_LAUNCH_STEP_MS;
  const stepCount = opts?.stepCount ?? ZD_ESTIMATE_LAUNCH_STEP_COUNT;
  const last = Math.max(0, stepCount - 1);
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

  // Po resolve SSR zaczynamy od kroku 1 (zakres już ✓), potem 2, 3…
  const base = opts?.scopeAlreadyResolved ? 1 : 0;
  const advanced = Math.floor(safeElapsed / stepMs);
  return Math.min(last, base + advanced);
}

export function launchProgressMinRevealWaitMs(
  startedAtMs: number | null | undefined,
  nowMs = Date.now(),
  minVisibleMs = ZD_ESTIMATE_LAUNCH_MIN_VISIBLE_MS
): number {
  if (startedAtMs == null || !(startedAtMs > 0)) return minVisibleMs;
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return Math.max(0, minVisibleMs - elapsed);
}
