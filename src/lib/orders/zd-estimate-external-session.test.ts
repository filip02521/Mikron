/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
  ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
  cancelPendingZdEstimateExternalSessionAwayStart,
  createZdEstimateExternalSessionToken,
  getZdEstimateExternalSessionRemainingMs,
  pauseAwayTimerOnReturnToExternalSession,
  readZdEstimateExternalSessionToken,
  recreateZdEstimateExternalSessionTokenPreservingTimer,
  scheduleZdEstimateExternalSessionAwayStart,
  startAwayTimerForExternalSession,
  clearZdEstimateExternalSessionToken,
  consumeExpiredOrInvalidZdEstimateExternalSessionToken,
  writeZdEstimateExternalSessionToken,
} from "@/lib/orders/zd-estimate-external-session";

describe("zd-estimate-external-session helpers", () => {
  beforeEach(() => {
    cancelPendingZdEstimateExternalSessionAwayStart();
    clearZdEstimateExternalSessionToken();
  });

  afterEach(() => {
    cancelPendingZdEstimateExternalSessionAwayStart();
    clearZdEstimateExternalSessionToken();
  });

  it("returns null when token not present", () => {
    expect(readZdEstimateExternalSessionToken(0)).toBeNull();
  });

  it("clamps remainingMs from awayExpiresAtMs when awayExpiresAtMs < now", () => {
    const now = 10_000;
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });

    const awayToken = { ...token, awayExpiresAtMs: now - 1_000 };
    expect(getZdEstimateExternalSessionRemainingMs(awayToken, now)).toBe(0);
  });

  it("computes remainingMs from awayExpiresAtMs when awayExpiresAtMs > now", () => {
    const now = 10_000;
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });

    const awayToken = { ...token, awayExpiresAtMs: now + 5_500 };
    expect(getZdEstimateExternalSessionRemainingMs(awayToken, now)).toBe(5_500);
  });

  it("on return resets remaining to full window for next leave", () => {
    const now = 10_000;
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });

    const awayToken = { ...token, awayExpiresAtMs: now + 3_000 };

    const paused = pauseAwayTimerOnReturnToExternalSession(awayToken, now + 1_234);
    expect(paused.awayExpiresAtMs).toBeNull();
    expect(paused.remainingMs).toBe(ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS);

    const nextAway = startAwayTimerForExternalSession(paused, now + 2_000);
    expect(nextAway.awayExpiresAtMs).toBe(
      now + 2_000 + ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS
    );
  });

  it("on return of expired away keeps remaining 0", () => {
    const now = 10_000;
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    const expired = pauseAwayTimerOnReturnToExternalSession(
      { ...token, awayExpiresAtMs: now - 1 },
      now
    );
    expect(expired.remainingMs).toBe(0);
    expect(expired.awayExpiresAtMs).toBeNull();
  });

  it("starts away timer only when awayExpiresAtMs is null", () => {
    const now = 10_000;
    const token = createZdEstimateExternalSessionToken({
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });

    const started = startAwayTimerForExternalSession(token, now);
    expect(started.awayExpiresAtMs).toBe(now + ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS);
    // remainingMs stays as the "last known remaining"
    expect(started.remainingMs).toBe(ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS);

    const alreadyAway = startAwayTimerForExternalSession(started, now + 5000);
    expect(alreadyAway.awayExpiresAtMs).toBe(started.awayExpiresAtMs);
  });

  it("read clears token when it is expired", () => {
    const now = 10_000;
    const rawToken = {
      sessionId: "s1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
      remainingMs: ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS,
      awayExpiresAtMs: now - 1,
    };

    window.sessionStorage.setItem(
      ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
      JSON.stringify(rawToken)
    );

    expect(readZdEstimateExternalSessionToken(now)).toBeNull();
    expect(
      window.sessionStorage.getItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY)
    ).toBeNull();
  });

  it("consumeExpired returns sessionId and clears storage", () => {
    const now = 10_000;
    window.sessionStorage.setItem(
      ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
      JSON.stringify({
        sessionId: "expired-1",
        schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
        supplierId: "sup1",
        scopeMode: "grupa",
        grupaId: 1,
        cechaId: null,
        remainingMs: 0,
        awayExpiresAtMs: now - 1,
      })
    );

    expect(consumeExpiredOrInvalidZdEstimateExternalSessionToken(now)).toBe(
      "expired-1"
    );
    expect(
      window.sessionStorage.getItem(ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY)
    ).toBeNull();
    expect(consumeExpiredOrInvalidZdEstimateExternalSessionToken(now)).toBeNull();
  });

  it("consumeExpired leaves live paused token untouched", () => {
    const token = createZdEstimateExternalSessionToken({
      sessionId: "live-1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    window.sessionStorage.setItem(
      ZD_ESTIMATE_EXTERNAL_SESSION_STORAGE_KEY,
      JSON.stringify(token)
    );
    expect(consumeExpiredOrInvalidZdEstimateExternalSessionToken()).toBeNull();
    expect(readZdEstimateExternalSessionToken()?.sessionId).toBe("live-1");
  });

  it("recreate while paused uses full window for next leave", () => {
    const previous = {
      ...createZdEstimateExternalSessionToken({
        sessionId: "old",
        schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
        supplierId: "sup1",
        scopeMode: "grupa" as const,
        grupaId: 1,
        cechaId: null,
      }),
      remainingMs: 45_000,
      awayExpiresAtMs: null,
    };
    const next = recreateZdEstimateExternalSessionTokenPreservingTimer({
      sessionId: "new",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
      previous,
    });
    expect(next.sessionId).toBe("new");
    expect(next.remainingMs).toBe(ZD_ESTIMATE_EXTERNAL_SESSION_AWAY_WINDOW_MS);
    expect(next.awayExpiresAtMs).toBeNull();
  });

  it("module-level away start is cancelled by remount cancel", async () => {
    const token = createZdEstimateExternalSessionToken({
      sessionId: "away-1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    writeZdEstimateExternalSessionToken(token);

    scheduleZdEstimateExternalSessionAwayStart({ deferMs: 30 });
    cancelPendingZdEstimateExternalSessionAwayStart();

    await new Promise((r) => setTimeout(r, 50));
    const after = readZdEstimateExternalSessionToken();
    expect(after?.awayExpiresAtMs).toBeNull();
    expect(after?.sessionId).toBe("away-1");
  });

  it("module-level away start fires when not cancelled", async () => {
    const token = createZdEstimateExternalSessionToken({
      sessionId: "away-2",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "sup1",
      scopeMode: "grupa",
      grupaId: 1,
      cechaId: null,
    });
    writeZdEstimateExternalSessionToken(token);

    scheduleZdEstimateExternalSessionAwayStart({ deferMs: 20 });
    await new Promise((r) => setTimeout(r, 40));
    const after = readZdEstimateExternalSessionToken();
    expect(after?.awayExpiresAtMs).not.toBeNull();
  });
});
