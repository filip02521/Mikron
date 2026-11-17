"use client";

import { useCallback, useState } from "react";
import { ZdEstimateExternalSessionFloatingNotice } from "@/components/zakupy/ZdEstimateExternalSessionFloatingNotice";
import { ZdEstimateRunFloatingNotice } from "@/components/zakupy/ZdEstimateRunFloatingNotice";
import {
  dismissZdEstimateTrackedRun,
  releaseZdEstimateRunOwnership,
  resolveZdEstimateTrackedRun,
  trackZdEstimateRunStarted,
} from "@/lib/client/zd-estimate-run-tracker";
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

const E2E_RUN_ID = "e2e-run-1";
const e2eRunStatus = async () => ({ state: "running" as const, pagesCommitted: 3, totalPages: 9 });

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
        ZD estimate - sesja zewnętrzna (kontrakt)
      </h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="zd-external-session-seed"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={seedActiveSession}
        >
          Symuluj Policz (token)
        </button>
        <button
          type="button"
          data-testid="zd-external-session-leave"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={leaveWizard}
        >
          Wyjdź z kreatora
        </button>
        <button
          type="button"
          data-testid="zd-external-session-return"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={returnToWizard}
        >
          {zdEstimateExternalSessionReturnCtaLabel}
        </button>
        <button
          type="button"
          data-testid="zd-external-session-cancel"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
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

      <h2 className="pt-2 text-sm font-semibold text-slate-900">ZD estimate - liczenie w tle (zakładka)</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="zd-run-notice-start"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={() => {
            trackZdEstimateRunStarted({
              runId: E2E_RUN_ID,
              ownerUserId: "e2e-user",
              label: "Ivoclar Vivadent - EXCEL",
              supplierId: "e2e-supplier",
              scopeMode: "cecha",
              grupaId: null,
              cechaId: 2738,
              startedAtMs: Date.now(),
            });
            // Jak wyjście z Kreatora w trakcie liczenia.
            releaseZdEstimateRunOwnership();
          }}
        >
          Symuluj liczenie w tle
        </button>
        <button
          type="button"
          data-testid="zd-run-notice-ready"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={() => resolveZdEstimateTrackedRun(E2E_RUN_ID, { state: "ready", sessionId: "e2e-session-2" })}
        >
          Lista gotowa
        </button>
        <button
          type="button"
          data-testid="zd-run-notice-fail"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={() =>
            resolveZdEstimateTrackedRun(E2E_RUN_ID, {
              state: "failed",
              message: "Subiekt nie odpowiedział w czasie.",
            })
          }
        >
          Błąd liczenia
        </button>
        <button
          type="button"
          data-testid="zd-run-notice-clear"
          className="rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-xs font-medium text-slate-800"
          onClick={() => dismissZdEstimateTrackedRun(E2E_RUN_ID)}
        >
          Wyczyść
        </button>
      </div>
      <ZdEstimateRunFloatingNotice forceEnabled getStatus={e2eRunStatus} />
    </section>
  );
}
