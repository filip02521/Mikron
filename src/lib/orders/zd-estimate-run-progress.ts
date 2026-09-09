/**
 * Ephemeral progress for „Policz listę”.
 *
 * Single-process OnTime (NSSM `next start`): Map on globalThis is shared between
 * actionRun and actionPoll. Multi-instance / serverless → poll may miss (UI falls
 * back to timed park). Not a durable job store.
 */

export type ZdEstimateRunPhase =
  | "starting"
  | "fetch"
  | "settings"
  | "enrich"
  | "compose"
  | "done"
  | "error";

export type ZdEstimateRunProgressSnapshot = {
  progressId: string;
  ownerUserId: string;
  phase: ZdEstimateRunPhase;
  pagesCommitted: number;
  totalPages: number;
  totalCountApi: number;
  linesSoFar: number;
  message: string | null;
  updatedAt: number;
  expiresAt: number;
};

export type ZdEstimateRunProgressPollResult =
  | { found: false }
  | { found: true; snapshot: ZdEstimateRunProgressSnapshot };

export type RegisterZdEstimateRunProgressResult =
  | { ok: true; snapshot: ZdEstimateRunProgressSnapshot }
  | { ok: false; reason: "invalid_id" | "owned_by_other" };

const TTL_MS = 5 * 60_000;
const MAX_PROGRESS_ID_LEN = 64;
const PROGRESS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GLOBAL_KEY = "__ontimeZdEstimateRunProgressStore" as const;

function store(): Map<string, ZdEstimateRunProgressSnapshot> {
  const g = globalThis as typeof globalThis & {
    [key: string]: Map<string, ZdEstimateRunProgressSnapshot> | undefined;
  };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY]!;
}

function gc(now = Date.now()): void {
  const m = store();
  for (const [id, row] of m) {
    if (row.expiresAt <= now) m.delete(id);
  }
}

/** Client-minted UUID; reject garbage / oversized ids. */
export function isValidZdEstimateRunProgressId(
  id: string | null | undefined
): id is string {
  if (typeof id !== "string") return false;
  const t = id.trim();
  return t.length > 0 && t.length <= MAX_PROGRESS_ID_LEN && PROGRESS_ID_RE.test(t);
}

/**
 * Register (or reset) a progress slot for this owner.
 * Never steals an active slot owned by someone else.
 */
export function registerZdEstimateRunProgress(input: {
  progressId: string;
  ownerUserId: string;
  nowMs?: number;
}): RegisterZdEstimateRunProgressResult {
  if (!isValidZdEstimateRunProgressId(input.progressId)) {
    return { ok: false, reason: "invalid_id" };
  }
  if (!input.ownerUserId.trim()) {
    return { ok: false, reason: "invalid_id" };
  }
  const now = input.nowMs ?? Date.now();
  gc(now);
  const id = input.progressId.trim();
  const existing = store().get(id);
  if (
    existing &&
    existing.expiresAt > now &&
    existing.ownerUserId !== input.ownerUserId
  ) {
    return { ok: false, reason: "owned_by_other" };
  }
  const snapshot: ZdEstimateRunProgressSnapshot = {
    progressId: id,
    ownerUserId: input.ownerUserId,
    phase: "starting",
    pagesCommitted: 0,
    totalPages: 0,
    totalCountApi: 0,
    linesSoFar: 0,
    message: null,
    updatedAt: now,
    expiresAt: now + TTL_MS,
  };
  store().set(id, snapshot);
  return { ok: true, snapshot };
}

/** Updates only when the slot belongs to `ownerUserId`. */
export function updateZdEstimateRunProgress(
  progressId: string,
  ownerUserId: string,
  patch: Partial<
    Pick<
      ZdEstimateRunProgressSnapshot,
      | "phase"
      | "pagesCommitted"
      | "totalPages"
      | "totalCountApi"
      | "linesSoFar"
      | "message"
    >
  >,
  nowMs = Date.now()
): ZdEstimateRunProgressSnapshot | null {
  const m = store();
  const cur = m.get(progressId);
  if (!cur || cur.expiresAt <= nowMs) {
    if (cur) m.delete(progressId);
    return null;
  }
  if (cur.ownerUserId !== ownerUserId) return null;
  const next: ZdEstimateRunProgressSnapshot = {
    ...cur,
    ...patch,
    ownerUserId: cur.ownerUserId,
    progressId: cur.progressId,
    updatedAt: nowMs,
    expiresAt: nowMs + TTL_MS,
  };
  m.set(progressId, next);
  return next;
}

export function getZdEstimateRunProgressForOwner(
  progressId: string,
  ownerUserId: string,
  nowMs = Date.now()
): ZdEstimateRunProgressPollResult {
  gc(nowMs);
  const row = store().get(progressId);
  if (!row || row.expiresAt <= nowMs) {
    if (row) store().delete(progressId);
    return { found: false };
  }
  if (row.ownerUserId !== ownerUserId) return { found: false };
  return { found: true, snapshot: { ...row } };
}

export function completeZdEstimateRunProgress(
  progressId: string,
  ownerUserId: string,
  nowMs = Date.now()
): void {
  updateZdEstimateRunProgress(
    progressId,
    ownerUserId,
    { phase: "done", message: null },
    nowMs
  );
}

export function failZdEstimateRunProgress(
  progressId: string,
  ownerUserId: string,
  message?: string | null,
  nowMs = Date.now()
): void {
  updateZdEstimateRunProgress(
    progressId,
    ownerUserId,
    { phase: "error", message: message?.trim() || null },
    nowMs
  );
}

/** Checklist index 0..3 for LaunchProgress (scope / fetch / calc / list). */
export function launchProgressStepFromRunPhase(
  phase: ZdEstimateRunPhase,
  opts?: { scopeAlreadyResolved?: boolean; stepCount?: number }
): number {
  const last = Math.max(0, (opts?.stepCount ?? 4) - 1);
  const scopeDone = opts?.scopeAlreadyResolved !== false;
  switch (phase) {
    case "starting":
      return scopeDone ? Math.min(1, last) : 0;
    case "fetch":
      return Math.min(1, last);
    case "settings":
    case "enrich":
      return Math.min(2, last);
    case "compose":
    case "done":
    case "error":
      return last;
    default:
      return Math.min(1, last);
  }
}

/**
 * Determinate 0–100. Fetch weighs ~70%; settings/enrich ~20%; compose ~8%.
 * Caps below 100 until done.
 */
export function launchProgressPctFromRun(
  snapshot: Pick<
    ZdEstimateRunProgressSnapshot,
    "phase" | "pagesCommitted" | "totalPages"
  >
): number {
  if (snapshot.phase === "done") return 100;
  if (snapshot.phase === "error") return Math.min(98, 94);
  if (snapshot.phase === "starting") return 2;

  if (snapshot.phase === "fetch") {
    const total = Math.max(1, snapshot.totalPages || 1);
    const committed = Math.max(0, Math.min(snapshot.pagesCommitted, total));
    const fetchFrac = committed / total;
    return Math.round(2 + fetchFrac * 68);
  }
  if (snapshot.phase === "settings") return 74;
  if (snapshot.phase === "enrich") return 86;
  if (snapshot.phase === "compose") return 94;
  return 50;
}

/**
 * Client poll miss policy: clear live snapshot only when we never got a hit
 * (registration lag / store miss → timed park). Keep last live on later misses.
 */
export function shouldClearRunProgressOnMiss(input: {
  consecutiveMisses: number;
  hadLiveSnapshot: boolean;
  missFallback: number;
}): boolean {
  if (input.hadLiveSnapshot) return false;
  return input.consecutiveMisses >= input.missFallback;
}

/** Test helper — clear store between unit tests. */
export function __resetZdEstimateRunProgressStoreForTests(): void {
  store().clear();
}
