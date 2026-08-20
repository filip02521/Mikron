"use client";

import { useCallback, useState } from "react";
import { ZdEstimateExternalSessionFloatingNotice } from "@/components/zakupy/ZdEstimateExternalSessionFloatingNotice";
import {
  clearZdEstimateExternalSessionToken,
  createZdEstimateExternalSessionToken,
  getZdEstimateExternalSessionRemainingMs,
  pauseAwayTimerOnReturnToExternalSession,
  readZdEstimateExternalSessionToken,
  startAwayTimerForExternalSession,
  writeZdEstimateExternalSessionToken,
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/orders/zd-estimate-external-session";
import {
  zdEstimateExternalSessionCancelButtonLabel,
  zdEstimateExternalSessionReturnCtaLabel,
} from "@/lib/orders/zd-estimate-ui-copy";

/**
 * Harness sesji kreatora ZD — symuluje Policz → wyjście → powiadomienie → powrót → anulowanie.
 * Playwright weryfikuje kontrakt bez auth / Subiekta.
 */
export function E2ELabExternalSessionSection() {
  const [phase, setPhase] = useState<
    "idle" | "active" | "away" | "returned" | "cancelled"
  >("idle");

  const seedActiveSession = useCallback(() => {
    clearZdEstimateExternalSessionToken();
    const token = createZdEstimateExternalSessionToken({
      sessionId: "e2e-session-1",
      schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      supplierId: "e2e-supplier",
      scopeMode: "grupa",
      grupaId: 42,
      cechaId: null,
    });
    writeZdEstimateExternalSessionToken(token);
    setPhase("active");
  }, []);

  const leaveWizard = useCallback(() => {
    const token = readZdEstimateExternalSessionToken();
    if (!token) return;
    const away = startAwayTimerForExternalSession(token);
    writeZdEstimateExternalSessionToken(away);
    setPhase("away");
  }, []);

  const returnToWizard = useCallback(() => {
    const token = readZdEstimateExternalSessionToken();
    if (!token) return;
    const paused = pauseAwayTimerOnReturnToExternalSession(token);
    writeZdEstimateExternalSessionToken(paused);
    setPhase("returned");
  }, []);

  const cancelSession = useCallback(() => {
    clearZdEstimateExternalSessionToken();
    setPhase("cancelled");
  }, []);

  const remainingMs =
    phase === "away"
      ? getZdEstimateExternalSessionRemainingMs(
          readZdEstimateExternalSessionToken() ?? {
            sessionId: "",
            schemaVersion: 1,
            supplierId: null,
            scopeMode: "grupa",
            grupaId: null,
            cechaId: null,
            remainingMs: 0,
            awayExpiresAtMs: null,
          }
        )
      : null;

  return (
    <section
      data-testid="zd-external-session-lab"
      className="space-y-3 rounded-md border border-slate-200 p-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        ZD estimate — sesja zewnętrzna (kontrakt)
      </h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="zd-external-session-seed"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={seedActiveSession}
        >
          Symuluj Policz (token)
        </button>
        <button
          type="button"
          data-testid="zd-external-session-leave"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={leaveWizard}
        >
          Wyjdź z kreatora
        </button>
        <button
          type="button"
          data-testid="zd-external-session-return"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={returnToWizard}
        >
          {zdEstimateExternalSessionReturnCtaLabel}
        </button>
        <button
          type="button"
          data-testid="zd-external-session-cancel"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={cancelSession}
        >
          {zdEstimateExternalSessionCancelButtonLabel}
        </button>
      </div>

      <p data-testid="zd-external-session-phase" className="text-sm text-slate-700">
        {phase}
      </p>

      {remainingMs != null ? (
        <p
          data-testid="zd-external-session-remaining"
          className="text-xs text-slate-600"
        >
          {remainingMs}
        </p>
      ) : null}

      <ZdEstimateExternalSessionFloatingNotice
        forceEnabled
        data-testid="zd-external-session-floating-notice-host"
      />
    </section>
  );
}
