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

/** Status bez wyniku: krótkie podsumowanie żyje dłużej niż sama lista. */
export type ZdEstimateRunJobSummaryState<S> =
  | { state: "running" }
  | { state: "done"; summary: S }
  | { state: "missing" };

type JobRow = {
  ownerUserId: string;
  done: boolean;
  /** Pełna lista — duża, trzymana krótko. null po `resultExpiresAt`. */
  result: unknown;
  resultExpiresAt: number;
  /** Co wyszło (sesja z listą albo powód błędu) — małe, trzymane do `expiresAt`. */
  summary: unknown;
  expiresAt: number;
};

type Store = {
  jobs: Map<string, JobRow>;
  /** Ostatnio zaczęte liczenie użytkownika — starsze nie nadpisuje jego zapisanej listy. */
  latestByOwner: Map<string, string>;
};

/** Najdłuższe liczenie, na które czekamy (profil 12 mies. + duża cecha mieszczą się z zapasem). */
export const ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS = 20 * 60_000;
/** Gotowa lista czeka w pamięci na odbiór przez otwarty Kreator. */
const RESULT_TTL_MS = 5 * 60_000;
/** Po pierwszym odbiorze lista zostaje chwilę — ponowienie po zerwanej odpowiedzi jej nie gubi. */
const COLLECTED_TTL_MS = 60_000;
/**
 * Podsumowanie dla zakładki poza Kreatorem: karta w tle albo uśpiony komputer pyta rzadko,
 * a zapisana sesja z listą żyje w bazie 24 h.
 */
export const ZD_ESTIMATE_RUN_JOB_SUMMARY_TTL_MS = 24 * 60 * 60_000;

const GLOBAL_KEY = "__ontimeZdEstimateRunJobStoreV2" as const;

function store(): Store {
  const g = globalThis as typeof globalThis & { [key: string]: Store | undefined };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { jobs: new Map(), latestByOwner: new Map() };
  return g[GLOBAL_KEY]!;
}

function gc(now: number): void {
  const { jobs, latestByOwner } = store();
  for (const [id, row] of jobs) {
    if (row.expiresAt <= now) {
      jobs.delete(id);
      if (latestByOwner.get(row.ownerUserId) === id) latestByOwner.delete(row.ownerUserId);
    } else if (row.result != null && row.resultExpiresAt <= now) {
      row.result = null;
    }
  }
}

function ownedRow(runId: string, ownerUserId: string, nowMs: number): JobRow | null {
  gc(nowMs);
  const row = store().jobs.get(runId);
  return row && row.ownerUserId === ownerUserId ? row : null;
}

/** Rejestruje zadanie. false, gdy id jest zajęte (inny użytkownik albo to samo liczenie już trwa). */
export function beginZdEstimateRunJob(runId: string, ownerUserId: string, nowMs = Date.now()): boolean {
  gc(nowMs);
  const s = store();
  if (!runId || !ownerUserId || s.jobs.has(runId)) return false;
  s.jobs.set(runId, {
    ownerUserId,
    done: false,
    result: null,
    resultExpiresAt: 0,
    summary: null,
    expiresAt: nowMs + ZD_ESTIMATE_RUN_JOB_RUNNING_TTL_MS,
  });
  s.latestByOwner.set(ownerUserId, runId);
  return true;
}

/**
 * Czy użytkownik zaczął już nowsze liczenie. Starsze nie zapisuje wtedy swojej listy jako
 * aktywnej sesji Kreatora — inaczej skasowałoby listę, na której użytkownik właśnie pracuje.
 * Liczenie spoza magazynu (bez `begin`) nigdy nie jest zastąpione.
 */
export function isZdEstimateRunJobSuperseded(runId: string, ownerUserId: string, nowMs = Date.now()): boolean {
  if (!ownedRow(runId, ownerUserId, nowMs)) return false;
  const latest = store().latestByOwner.get(ownerUserId);
  return latest != null && latest !== runId;
}

export function finishZdEstimateRunJob(
  runId: string,
  ownerUserId: string,
  result: unknown,
  summary: unknown,
  nowMs = Date.now()
): void {
  const row = ownedRow(runId, ownerUserId, nowMs);
  if (!row) return;
  row.done = true;
  row.result = result;
  row.resultExpiresAt = nowMs + RESULT_TTL_MS;
  row.summary = summary;
  row.expiresAt = nowMs + ZD_ESTIMATE_RUN_JOB_SUMMARY_TTL_MS;
}

/** Odbiór pełnej listy przez otwarty Kreator. */
export function collectZdEstimateRunJob<T>(
  runId: string,
  ownerUserId: string,
  nowMs = Date.now()
): ZdEstimateRunJobState<T> {
  const row = ownedRow(runId, ownerUserId, nowMs);
  if (!row) return { state: "missing" };
  if (!row.done) return { state: "running" };
  if (row.result == null) return { state: "missing" };
  row.resultExpiresAt = Math.min(row.resultExpiresAt, nowMs + COLLECTED_TTL_MS);
  return { state: "done", result: row.result as T };
}

/** Status dla powiadomienia poza Kreatorem — bez przesyłania listy i bez skracania jej życia. */
export function peekZdEstimateRunJobSummary<S>(
  runId: string,
  ownerUserId: string,
  nowMs = Date.now()
): ZdEstimateRunJobSummaryState<S> {
  const row = ownedRow(runId, ownerUserId, nowMs);
  if (!row) return { state: "missing" };
  return row.done ? { state: "done", summary: row.summary as S } : { state: "running" };
}

/** Test helper. */
export function __resetZdEstimateRunJobStoreForTests(): void {
  store().jobs.clear();
  store().latestByOwner.clear();
}
