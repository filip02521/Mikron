/**
 * Czysta logika prezentacji loadingów Kreatora ZD (testowalna, bez JSX).
 */

export type ZdEstimateLoadingStatusTone = "busy" | "complete" | "warning";

export type ZdEstimateLoadingStepVisual = {
  failed: boolean;
  done: boolean;
  active: boolean;
  pending: boolean;
};

/** Kompaktowy czas: `12s` albo `1:05` — wspólny dla route / launch / create. */
export function formatZdEstimateElapsedCompact(elapsedMs: number): string {
  const sec = Math.floor(Math.max(0, elapsedMs) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function zdEstimateLoadingElapsedLabel(input: {
  elapsedMs: number;
  forceComplete?: boolean;
  /** Opis fazy przy busy, np. „postęp szacunkowy”. */
  busyDetail: string;
}): string {
  const t = formatZdEstimateElapsedCompact(input.elapsedMs);
  return input.forceComplete ? `${t} · gotowe` : `${t} · ${input.busyDetail}`;
}

export function resolveZdEstimateLoadingStatusTone(input: {
  forceComplete?: boolean;
  statusTone?: ZdEstimateLoadingStatusTone;
  completeFailed?: boolean;
}): ZdEstimateLoadingStatusTone {
  if (input.statusTone) return input.statusTone;
  if (input.completeFailed) return "warning";
  if (input.forceComplete) return "complete";
  return "busy";
}

export function resolveZdEstimateLoadingBarPct(input: {
  forceComplete?: boolean;
  progressPct?: number;
  activeStepIndex: number;
  stepCount: number;
}): number {
  const clamped = Math.max(
    0,
    Math.min(
      input.activeStepIndex,
      Math.max(0, input.stepCount - 1)
    )
  );
  const derivedPct = input.forceComplete
    ? 100
    : Math.min(
        96,
        ((clamped + 0.45) / Math.max(1, input.stepCount)) * 100
      );
  return Math.max(
    input.forceComplete ? 100 : 4,
    Math.min(100, input.progressPct ?? derivedPct)
  );
}

export function resolveZdEstimateLoadingStepVisual(input: {
  index: number;
  activeStepIndex: number;
  forceComplete?: boolean;
  stepId: string;
  stepFailureId?: string | null;
}): ZdEstimateLoadingStepVisual {
  const failed = Boolean(
    input.forceComplete &&
      input.stepFailureId &&
      input.stepId === input.stepFailureId
  );
  const done =
    !failed && (input.index < input.activeStepIndex || Boolean(input.forceComplete));
  const active = input.index === input.activeStepIndex && !input.forceComplete;
  const pending = !done && !active && !failed;
  return { failed, done, active, pending };
}
