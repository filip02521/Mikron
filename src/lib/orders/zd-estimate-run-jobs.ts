/**
 * Wynik „Policz listę” liczony w tle (po odpowiedzi akcji startu) i odbierany krótkimi zapytaniami.
 *
 * Powód: duże zakresy (np. cecha Ivoclar — 9 stron po ~11 s z Subiekta) liczą się ponad minutę,
 * a jedno długie żądanie HTTP zrywa reverse proxy (504), zanim serwer skończy.
 *
 * Jeden proces OnTime (NSSM `next start`): Map na globalThis, jak postęp w `zd-estimate-run-progress`.
 * To nie jest trwała kolejka — po restarcie usługi zadanie znika (klient dostaje „missing”).
 */

export type ZdEstimateRunJobState<T> =
  | { state: "running" }
  | { state: "done"; result: T }
  | { state: "missing" };

type JobRow = {
  ownerUserId: string;
  done: boolean;
  result: unknown;
  expiresAt: number;
};

/** Najdłuższe liczenie, na które czekamy (nocny profil + duża cecha mieszczą się z zapasem). */
export const ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS = 20 * 60_000;
/** Gotowy wynik czeka na odbiór. */
const DONE_TTL_MS = 5 * 60_000;
/** Po pierwszym odbiorze wynik zostaje chwilę — ponowienie po zerwanej odpowiedzi go nie gubi. */
const COLLECTED_TTL_MS = 60_000;

const GLOBAL_KEY = "__ontimeZdEstimateRunJobStore" as const;

function store(): Map<string, JobRow> {
  const g = globalThis as typeof globalThis & { [key: string]: Map<string, JobRow> | undefined };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY]!;
}

function gc(now: number): void {
  const m = store();
  for (const [id, row] of m) {
    if (row.expiresAt <= now) m.delete(id);
  }
}

/** Rejestruje zadanie. false, gdy id jest zajęte (inny użytkownik albo to samo liczenie już trwa). */
export function beginZdEstimateRunJob(runId: string, ownerUserId: string, nowMs = Date.now()): boolean {
  gc(nowMs);
  if (!runId || !ownerUserId || store().has(runId)) return false;
  store().set(runId, {
    ownerUserId,
    done: false,
    result: null,
    expiresAt: nowMs + ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS,
  });
  return true;
}

export function finishZdEstimateRunJob(runId: string, ownerUserId: string, result: unknown, nowMs = Date.now()): void {
  const row = store().get(runId);
  if (!row || row.ownerUserId !== ownerUserId) return;
  store().set(runId, { ownerUserId, done: true, result, expiresAt: nowMs + DONE_TTL_MS });
}

export function collectZdEstimateRunJob<T>(
  runId: string,
  ownerUserId: string,
  nowMs = Date.now()
): ZdEstimateRunJobState<T> {
  gc(nowMs);
  const row = store().get(runId);
  if (!row || row.ownerUserId !== ownerUserId) return { state: "missing" };
  if (!row.done) return { state: "running" };
  row.expiresAt = Math.min(row.expiresAt, nowMs + COLLECTED_TTL_MS);
  return { state: "done", result: row.result as T };
}

/** Test helper. */
export function __resetZdEstimateRunJobStoreForTests(): void {
  store().clear();
}
