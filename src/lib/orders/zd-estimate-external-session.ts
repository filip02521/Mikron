export const ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY =
  "zd_estimate_ui_external_session_token_v1";

// Timer liczymy od realnego „wyjścia z kreatora”, ale stan (pozostały czas) trzymamy w tokenie.
export const ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS = 3 * 60 * 1000;

// Wersja schematu snapshotu payloadu zapisywanego w DB.
export const ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION = 1;

export type ZdEstimateExternalSessionScopeMode = "grupa" | "cecha";

export type ZdEstimateExternalSessionToken = {
  sessionId: string;
  schemaVersion: number;

  // Metadane do UX / CTA; pełny stan UI pochodzi z payloadu z serwera.
  supplierId: string | null;
  scopeMode: ZdEstimateExternalSessionScopeMode;
  grupaId: number | null;
  cechaId: number | null;

  // Timer po stronie klienta.
  // - gdy `awayExpiresAtMs === null` => użytkownik jest w kreatorze; remainingMs
  //   to budżet na *następne* wyjście (po powrocie zawsze pełne okno 3 min)
  // - gdy `awayExpiresAtMs !== null` => timer leci; remaining liczony od deadline
  remainingMs: number;
  awayExpiresAtMs: number | null;
};

function clampRemainingMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor(ms));
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readRawTokenFromSessionStorage(): string | null {
  if (!canUseSessionStorage()) return null;
  return window.sessionStorage.getItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY);
}

function writeRawTokenToSessionStorage(raw: string): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY, raw);
}

export function getZdEstimateExternalSessionRemainingMs(
  token: ZdEstimateExternalSessionToken,
  nowMs = Date.now()
): number {
  if (token.awayExpiresAtMs != null) {
    return clampRemainingMs(token.awayExpiresAtMs - nowMs);
  }
  return clampRemainingMs(token.remainingMs);
}

export function createZdEstimateExternalSessionToken(input: {
  sessionId: string;
  schemaVersion: number;
  supplierId: string | null;
  scopeMode: ZdEstimateExternalSessionScopeMode;
  grupaId: number | null;
  cechaId: number | null;
}): ZdEstimateExternalSessionToken {
  return {
    sessionId: input.sessionId,
    schemaVersion: input.schemaVersion,

    supplierId: input.supplierId,
    scopeMode: input.scopeMode,
    grupaId: input.grupaId,
    cechaId: input.cechaId,

    remainingMs: ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
    awayExpiresAtMs: null,
  };
}

export function startAwayTimerForExternalSession(
  token: ZdEstimateExternalSessionToken,
  nowMs = Date.now()
): ZdEstimateExternalSessionToken {
  // Jeśli timer już leci (jesteśmy poza kreatorem), nie resetujemy go.
  if (token.awayExpiresAtMs != null) return token;

  const remainingMs = getZdEstimateExternalSessionRemainingMs(token, nowMs);
  return {
    ...token,
    awayExpiresAtMs: nowMs + remainingMs,
  };
}

/**
 * Powrót do kreatora: zatrzymaj away i **odnów** pełne okno 3 min.
 * Kolejne wyjście zaczyna odliczanie od nowa (nie od resztki poprzedniego away).
 * Wygasły token (remaining ≤ 0) zostaje z 0 — caller sprząta sesję.
 */
export function pauseAwayTimerOnReturnToExternalSession(
  token: ZdEstimateExternalSessionToken,
  nowMs = Date.now()
): ZdEstimateExternalSessionToken {
  if (token.awayExpiresAtMs == null) {
    // Już w kreatorze — upewnij się, że budżet na następne wyjście jest pełny.
    if (token.remainingMs === ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS) {
      return token;
    }
    return {
      ...token,
      remainingMs: ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
      awayExpiresAtMs: null,
    };
  }

  const remainingMs = getZdEstimateExternalSessionRemainingMs(token, nowMs);
  if (remainingMs <= 0) {
    return {
      ...token,
      remainingMs: 0,
      awayExpiresAtMs: null,
    };
  }

  return {
    ...token,
    remainingMs: ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
    awayExpiresAtMs: null,
  };
}

export function isZdEstimateExternalSessionExpired(
  token: ZdEstimateExternalSessionToken,
  nowMs = Date.now()
): boolean {
  return getZdEstimateExternalSessionRemainingMs(token, nowMs) <= 0;
}

/** Parsuje surowy JSON bez mutacji sessionStorage (bezpieczne w renderze). */
export function parseZdEstimateExternalSessionTokenJson(
  raw: string,
  nowMs = Date.now()
): ZdEstimateExternalSessionToken | null {
  const token = parseZdEstimateExternalSessionTokenJsonAllowExpired(raw);
  if (!token) return null;
  if (isZdEstimateExternalSessionExpired(token, nowMs)) return null;
  return token;
}

/**
 * Jak parse, ale zwraca też wygasły token (do cleanup DB / storage).
 * Nie mutuje sessionStorage.
 */
export function parseZdEstimateExternalSessionTokenJsonAllowExpired(
  raw: string
): ZdEstimateExternalSessionToken | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ZdEstimateExternalSessionToken>;
    if (!parsed.sessionId || typeof parsed.schemaVersion !== "number") return null;

    if (parsed.scopeMode !== "grupa" && parsed.scopeMode !== "cecha") {
      return null;
    }

    return {
      sessionId: String(parsed.sessionId),
      schemaVersion: Number(parsed.schemaVersion),
      supplierId: parsed.supplierId != null ? String(parsed.supplierId) : null,
      scopeMode: parsed.scopeMode,
      grupaId: parsed.grupaId != null ? Number(parsed.grupaId) : null,
      cechaId: parsed.cechaId != null ? Number(parsed.cechaId) : null,
      remainingMs: clampRemainingMs(
        Number(parsed.remainingMs ?? ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS)
      ),
      awayExpiresAtMs:
        parsed.awayExpiresAtMs == null ? null : Number(parsed.awayExpiresAtMs),
    };
  } catch {
    return null;
  }
}

/** Odczyt bez czyszczenia wygasłego tokenu — do renderu / peek. */
export function peekZdEstimateExternalSessionToken(
  nowMs = Date.now()
): ZdEstimateExternalSessionToken | null {
  const raw = readRawTokenFromSessionStorage();
  if (!raw) return null;
  return parseZdEstimateExternalSessionTokenJson(raw, nowMs);
}

/**
 * Jeśli w storage jest wygasły / uszkodzony token — wyczyść go i zwróć sessionId
 * do usunięcia rekordu w DB. Żywy token zostawia bez zmian.
 */
export function consumeExpiredOrInvalidZdEstimateExternalSessionToken(
  nowMs = Date.now()
): string | null {
  const raw = readRawTokenFromSessionStorage();
  if (!raw) return null;

  const token = parseZdEstimateExternalSessionTokenJsonAllowExpired(raw);
  if (!token) {
    clearZdEstimateExternalSessionToken();
    return null;
  }
  if (!isZdEstimateExternalSessionExpired(token, nowMs)) return null;

  clearZdEstimateExternalSessionToken();
  return token.sessionId;
}

export function readZdEstimateExternalSessionToken(
  nowMs = Date.now()
): ZdEstimateExternalSessionToken | null {
  const raw = readRawTokenFromSessionStorage();
  if (!raw) return null;

  const token = parseZdEstimateExternalSessionTokenJsonAllowExpired(raw);
  if (!token) {
    clearZdEstimateExternalSessionToken();
    return null;
  }

  if (isZdEstimateExternalSessionExpired(token, nowMs)) {
    clearZdEstimateExternalSessionToken();
    return null;
  }

  return token;
}

export function writeZdEstimateExternalSessionToken(token: ZdEstimateExternalSessionToken): void {
  writeRawTokenToSessionStorage(JSON.stringify(token));
}

export function clearZdEstimateExternalSessionToken(): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY);
}

export function clearZdEstimateExternalSessionTokenAndReturnSessionId(): string | null {
  const raw = readRawTokenFromSessionStorage();
  if (!raw) return null;
  const token = parseZdEstimateExternalSessionTokenJsonAllowExpired(raw);
  clearZdEstimateExternalSessionToken();
  return token?.sessionId ?? null;
}

// ---------------------------------------------------------------------------
// Odroczony start away — module-level, żeby remount anulował poprzedni timeout
// (Strict Mode + szybki leave→return; instance useRef tego nie ogarnia).
// ---------------------------------------------------------------------------

const ZD_ESTIMATE_AWAY_START_DEFER_MS = 120;

let pendingAwayStartTimerId: number | null = null;
let pendingAwayStartGeneration = 0;

/** Anuluj zaplanowany start away (mount kreatora / end session / pause). */
export function cancelPendingZdEstimateExternalSessionAwayStart(): void {
  pendingAwayStartGeneration += 1;
  if (typeof window === "undefined") {
    pendingAwayStartTimerId = null;
    return;
  }
  if (pendingAwayStartTimerId != null) {
    window.clearTimeout(pendingAwayStartTimerId);
    pendingAwayStartTimerId = null;
  }
}

/**
 * Zaplanuj start away po krótkim deferze.
 * Jeśli w międzyczasie ktoś wywoła cancel (nowy mount kreatora) — nie startujemy.
 */
export function scheduleZdEstimateExternalSessionAwayStart(opts?: {
  deferMs?: number;
  /** Gdy token wygasł / remaining=0 — caller usuwa rekord DB. */
  onExpiredSessionId?: (sessionId: string) => void;
}): void {
  if (typeof window === "undefined") return;
  const deferMs = opts?.deferMs ?? ZD_ESTIMATE_AWAY_START_DEFER_MS;
  cancelPendingZdEstimateExternalSessionAwayStart();
  const gen = pendingAwayStartGeneration;
  pendingAwayStartTimerId = window.setTimeout(() => {
    pendingAwayStartTimerId = null;
    if (gen !== pendingAwayStartGeneration) return;

    const token = readZdEstimateExternalSessionToken();
    if (!token) {
      const expired = consumeExpiredOrInvalidZdEstimateExternalSessionToken();
      if (expired) opts?.onExpiredSessionId?.(expired);
      return;
    }
    if (token.awayExpiresAtMs != null) return;

    const started = startAwayTimerForExternalSession(token);
    if (getZdEstimateExternalSessionRemainingMs(started) <= 0) {
      clearZdEstimateExternalSessionToken();
      opts?.onExpiredSessionId?.(token.sessionId);
      return;
    }
    writeZdEstimateExternalSessionToken(started);
  }, deferMs);
}

/**
 * Odtwórz token po recreate sesji DB.
 * Away w toku: zachowaj deadline. W kreatorze (paused): pełne okno na następne wyjście.
 */
export function recreateZdEstimateExternalSessionTokenPreservingTimer(input: {
  sessionId: string;
  schemaVersion: number;
  supplierId: string | null;
  scopeMode: ZdEstimateExternalSessionScopeMode;
  grupaId: number | null;
  cechaId: number | null;
  previous: ZdEstimateExternalSessionToken | null;
  nowMs?: number;
}): ZdEstimateExternalSessionToken {
  const base = createZdEstimateExternalSessionToken({
    sessionId: input.sessionId,
    schemaVersion: input.schemaVersion,
    supplierId: input.supplierId,
    scopeMode: input.scopeMode,
    grupaId: input.grupaId,
    cechaId: input.cechaId,
  });
  if (!input.previous) return base;

  const nowMs = input.nowMs ?? Date.now();
  if (input.previous.awayExpiresAtMs != null) {
    const remainingMs = getZdEstimateExternalSessionRemainingMs(
      input.previous,
      nowMs
    );
    return {
      ...base,
      remainingMs,
      awayExpiresAtMs: input.previous.awayExpiresAtMs,
    };
  }

  // Paused w kreatorze — następne wyjście zawsze od pełnych 3 min.
  return base;
}

// Pomocnik dla CTA „Wróć do kreatora” — link ma wyłącznie nawigować; restore idzie po tokenie.
export function buildReturnToWizardUrl(input?: {
  resumeParam?: boolean;
}): string {
  const resumeParam = input?.resumeParam ?? true;
  if (!resumeParam) return "/zakupy/szacunek";
  return "/zakupy/szacunek?resume=1";
}

