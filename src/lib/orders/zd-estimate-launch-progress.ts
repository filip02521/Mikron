/**
 * Deterministyczny postęp checklisty „Przygotuj ZD”.
 * Nie zależy od setInterval w workbenchu (resetowany przy change `estimating`).
 *
 * Preferuj live snapshot z `zd-estimate-run-progress` (strony Subiekta).
 * Timed parkOnFetch to tylko fallback gdy store nie odpowiada.
 */

import {
  launchProgressStepFromRunPhase,
  type ZdEstimateRunPhase,
  type ZdEstimateRunProgressSnapshot,
} from "@/lib/orders/zd-estimate-run-progress";

export const ZD_ESTIMATE_LAUNCH_STEP_MS = 1600;
export const ZD_ESTIMATE_LAUNCH_MIN_VISIBLE_MS = 3200;
export const ZD_ESTIMATE_LAUNCH_STEP_COUNT = 4;

/**
 * Po „Policz listę” prawdziwy wait to odczyt Subiekta („Towary i stany”).
 * Parkujemy na tym kroku — wcześniej checklista zbyt szybko lądowała na „Lista do ZD”.
 */
export const ZD_ESTIMATE_LAUNCH_FETCH_HOLD_MS = 55_000;
export const ZD_ESTIMATE_LAUNCH_CALC_HOLD_MS = 8_000;
/** Duże cechy (np. Ivoclar) — dłuższy park na odczycie. */
export const ZD_ESTIMATE_LAUNCH_FETCH_HOLD_CECHA_MS = 90_000;

/** Po tylu missach polla wracamy do timed park (store niedostępny). */
export const ZD_ESTIMATE_LAUNCH_PROGRESS_MISS_FALLBACK = 3;

export {
  launchProgressStepFromRunPhase,
  launchProgressPctFromRun,
} from "@/lib/orders/zd-estimate-run-progress";
export type {
  ZdEstimateRunPhase,
  ZdEstimateRunProgressSnapshot,
} from "@/lib/orders/zd-estimate-run-progress";

/** Live snapshot wygrywa z timed park. */
export function resolveLaunchProgressStep(input: {
  elapsedMs: number;
  scopeAlreadyResolved?: boolean;
  scopeMode?: "grupa" | "cecha" | null;
  livePhase?: ZdEstimateRunPhase | null;
  stepCount?: number;
}): number {
  if (input.livePhase) {
    return launchProgressStepFromRunPhase(input.livePhase, {
      scopeAlreadyResolved: input.scopeAlreadyResolved,
      stepCount: input.stepCount,
    });
  }
  return launchProgressStepFromElapsed(input.elapsedMs, {
    scopeAlreadyResolved: input.scopeAlreadyResolved,
    parkOnFetch: true,
    scopeMode: input.scopeMode,
    stepCount: input.stepCount,
  });
}

export function formatLaunchProgressPagesLabel(
  snapshot: Pick<
    ZdEstimateRunProgressSnapshot,
    "pagesCommitted" | "totalPages" | "linesSoFar"
  >
): string | null {
  const total = snapshot.totalPages;
  const page = snapshot.pagesCommitted;
  if (!(total > 0) || !(page > 0)) return null;
  const lines =
    snapshot.linesSoFar > 0 ? ` · ~${snapshot.linesSoFar} towarów` : "";
  return `Strona ${page}/${total}${lines}`;
}

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
 * @param parkOnFetch — tryb „Policz listę”: długo na „Towary i stany”, nie na fałszywym końcu
 */
export function launchProgressStepFromElapsed(
  elapsedMs: number,
  opts?: {
    scopeAlreadyResolved?: boolean;
    stepMs?: number;
    stepCount?: number;
    parkOnFetch?: boolean;
    scopeMode?: "grupa" | "cecha" | null;
  }
): number {
  const stepMs = opts?.stepMs ?? ZD_ESTIMATE_LAUNCH_STEP_MS;
  const stepCount = opts?.stepCount ?? ZD_ESTIMATE_LAUNCH_STEP_COUNT;
  const last = Math.max(0, stepCount - 1);
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

  if (opts?.parkOnFetch) {
    const fetchHoldMs =
      opts.scopeMode === "cecha"
        ? ZD_ESTIMATE_LAUNCH_FETCH_HOLD_CECHA_MS
        : ZD_ESTIMATE_LAUNCH_FETCH_HOLD_MS;
    // 0 Zakres → 1 Towary (park) → 2 Sprzedaż → 3 Lista
    if (!opts.scopeAlreadyResolved && safeElapsed < stepMs) return 0;
    if (safeElapsed < fetchHoldMs) return Math.min(1, last);
    if (safeElapsed < fetchHoldMs + ZD_ESTIMATE_LAUNCH_CALC_HOLD_MS) {
      return Math.min(2, last);
    }
    return last;
  }

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
