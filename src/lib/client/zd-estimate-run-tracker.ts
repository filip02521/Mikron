/**
 * Liczenie listy do ZD, które trwa (albo skończyło się) poza otwartym Kreatorem.
 *
 * Kreator zapisuje tu start liczenia. Dopóki jest otwarty, sam odbiera wynik i kasuje wpis.
 * Gdy użytkownik wyjdzie z Kreatora albo odświeży stronę, wpis zostaje — zakładka przy krawędzi
 * (`ZdEstimateRunFloatingNotice`) pyta serwer o status i mówi, kiedy lista jest gotowa.
 *
 * sessionStorage: przeżywa odświeżenie karty, nie przechodzi między kartami (jak token sesji Kreatora).
 */

export const ZD_ESTIMATE_RUN_TRACKER_STORAGE_KEY = "zd_estimate_run_pending_v1";

export type ZdEstimateTrackedRun = {
  runId: string;
  /** Konto, które zaczęło liczenie — inne konto w tej samej karcie go nie zobaczy. */
  ownerUserId: string;
  /** Dostawca albo nazwa zakresu — do zdania w powiadomieniu. */
  label: string;
  supplierId: string | null;
  scopeMode: "grupa" | "cecha";
  grupaId: number | null;
  cechaId: number | null;
  startedAtMs: number;
  state: "running" | "ready" | "failed";
  /** Sesja Kreatora z gotową listą (state = ready). */
  sessionId: string | null;
  /** Powód (state = failed). */
  message: string | null;
};

type Snapshot = { run: ZdEstimateTrackedRun | null; ownedRunId: string | null };

let snapshot: Snapshot = { run: null, ownedRunId: null };
let loaded = false;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: Snapshot = { run: null, ownedRunId: null };

function storage(): Storage | null {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined" ? window.sessionStorage : null;
}

export function parseZdEstimateTrackedRun(raw: string | null): ZdEstimateTrackedRun | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ZdEstimateTrackedRun>;
    if (typeof p.runId !== "string" || !p.runId) return null;
    if (typeof p.ownerUserId !== "string" || !p.ownerUserId) return null;
    if (p.scopeMode !== "grupa" && p.scopeMode !== "cecha") return null;
    if (p.state !== "running" && p.state !== "ready" && p.state !== "failed") return null;
    const sessionId = typeof p.sessionId === "string" && p.sessionId ? p.sessionId : null;
    if (p.state === "ready" && !sessionId) return null;
    return {
      runId: p.runId,
      ownerUserId: p.ownerUserId,
      label: typeof p.label === "string" ? p.label : "",
      supplierId: typeof p.supplierId === "string" && p.supplierId ? p.supplierId : null,
      scopeMode: p.scopeMode,
      grupaId: Number.isFinite(Number(p.grupaId)) && Number(p.grupaId) > 0 ? Number(p.grupaId) : null,
      cechaId: Number.isFinite(Number(p.cechaId)) && Number(p.cechaId) > 0 ? Number(p.cechaId) : null,
      startedAtMs: Number.isFinite(Number(p.startedAtMs)) ? Number(p.startedAtMs) : 0,
      state: p.state,
      sessionId,
      message: typeof p.message === "string" && p.message ? p.message : null,
    };
  } catch {
    return null;
  }
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = { ...snapshot, run: parseZdEstimateTrackedRun(storage()?.getItem(ZD_ESTIMATE_RUN_TRACKER_STORAGE_KEY) ?? null) };
}

function commit(next: Snapshot): void {
  snapshot = next;
  const s = storage();
  if (s) {
    if (next.run) s.setItem(ZD_ESTIMATE_RUN_TRACKER_STORAGE_KEY, JSON.stringify(next.run));
    else s.removeItem(ZD_ESTIMATE_RUN_TRACKER_STORAGE_KEY);
  }
  for (const l of listeners) l();
}

export function subscribeZdEstimateRunTracker(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getZdEstimateRunTrackerSnapshot(): Snapshot {
  ensureLoaded();
  return snapshot;
}

export function getZdEstimateRunTrackerServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

/** Kreator zaczął liczenie i sam czeka na wynik. */
export function trackZdEstimateRunStarted(run: Omit<ZdEstimateTrackedRun, "state" | "sessionId" | "message">): void {
  ensureLoaded();
  commit({ run: { ...run, state: "running", sessionId: null, message: null }, ownedRunId: run.runId });
}

/** Kreator odebrał wynik (albo błąd) na ekranie — nie ma o czym powiadamiać. */
export function settleZdEstimateRunInWizard(runId: string): void {
  ensureLoaded();
  if (snapshot.run?.runId !== runId) {
    if (snapshot.ownedRunId === runId) commit({ ...snapshot, ownedRunId: null });
    return;
  }
  commit({ run: null, ownedRunId: null });
}

/** Kreator zniknął z ekranu w trakcie liczenia — status przejmuje zakładka. */
export function releaseZdEstimateRunOwnership(): void {
  ensureLoaded();
  if (snapshot.ownedRunId != null) commit({ ...snapshot, ownedRunId: null });
}

/** Wynik z serwera dla liczenia śledzonego poza Kreatorem. Ignoruje spóźnione odpowiedzi dla innego liczenia. */
export function resolveZdEstimateTrackedRun(
  runId: string,
  outcome: { state: "ready"; sessionId: string } | { state: "failed"; message: string }
): void {
  ensureLoaded();
  const run = snapshot.run;
  if (!run || run.runId !== runId || run.state !== "running") return;
  commit({
    ...snapshot,
    run:
      outcome.state === "ready"
        ? { ...run, state: "ready", sessionId: outcome.sessionId, message: null }
        : { ...run, state: "failed", sessionId: null, message: outcome.message },
  });
}

export function dismissZdEstimateTrackedRun(runId: string): void {
  ensureLoaded();
  if (snapshot.run?.runId === runId) commit({ ...snapshot, run: null });
}

/** Test helper. */
export function __resetZdEstimateRunTrackerForTests(): void {
  snapshot = { run: null, ownedRunId: null };
  loaded = false;
  listeners.clear();
}
