"use client";

import { useEffect, useMemo, useState } from "react";
import { ZdEstimateLoadingBody } from "@/components/zakupy/ZdEstimateLoadingBody";
import { ZdEstimateLoadingWindow } from "@/components/zakupy/ZdEstimateLoadingWindow";
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import {
  launchProgressStepFromElapsed,
  ZD_ESTIMATE_SESSION_RESUME_STEP_COUNT,
  ZD_ESTIMATE_SESSION_RESUME_STEP_MS,
} from "@/lib/orders/zd-estimate-launch-progress";
import { zdEstimateLoadingElapsedLabel } from "@/lib/orders/zd-estimate-loading-ui";
import { ZD_ESTIMATE_LAUNCH_FOCUS_ID } from "@/lib/orders/zd-estimate-launch-scroll";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  zdEstimateLoadingBusyDetailSessionResume,
  zdEstimatePageHint,
  zdEstimateSessionResumeProgressCompleteHint,
  zdEstimateSessionResumeProgressCompleteTitle,
  zdEstimateSessionResumeProgressFooter,
  zdEstimateSessionResumeProgressSteps,
  zdEstimateSessionResumeProgressTitle,
  zdEstimateSessionResumeScopeChipLabel,
} from "@/lib/orders/zd-estimate-ui-copy";

export function ZdEstimateSessionResumeProgressPanel({
  startedAtMs,
  returningFromAway = true,
  forceComplete = false,
  scopeLabel,
  scopeMode,
  supplierName,
  ordersIsLive = false,
  host = null,
}: {
  startedAtMs: number;
  returningFromAway?: boolean;
  forceComplete?: boolean;
  scopeLabel?: string | null;
  scopeMode?: "grupa" | "cecha" | null;
  supplierName?: string | null;
  ordersIsLive?: boolean;
  host?: ZdEstimateHostStrip | null;
}) {
  const steps = useMemo(() => zdEstimateSessionResumeProgressSteps(), []);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (forceComplete) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [forceComplete, startedAtMs]);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const activeStepIndex = forceComplete
    ? steps.length - 1
    : launchProgressStepFromElapsed(elapsedMs, {
        scopeAlreadyResolved: true,
        stepMs: ZD_ESTIMATE_SESSION_RESUME_STEP_MS,
        stepCount: ZD_ESTIMATE_SESSION_RESUME_STEP_COUNT,
      });

  const clamped = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
  const title = forceComplete
    ? zdEstimateSessionResumeProgressCompleteTitle()
    : zdEstimateSessionResumeProgressTitle({ returningFromAway });
  const statusHint = forceComplete
    ? zdEstimateSessionResumeProgressCompleteHint()
    : steps[clamped]!.activeHint;

  const chips = [
    ...(supplierName
      ? [{ label: "Dostawca", value: supplierName } as const]
      : []),
    ...(scopeLabel && scopeMode
      ? [
          {
            label: zdEstimateSessionResumeScopeChipLabel(scopeMode),
            value: scopeLabel,
            tone: "emerald" as const,
          },
        ]
      : []),
  ];

  return (
    <ZdEstimateLoadingWindow
      focusId={ZD_ESTIMATE_LAUNCH_FOCUS_ID}
      description={ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION}
      hint={zdEstimatePageHint({
        isLive: ordersIsLive,
        configured: host?.configured ?? true,
      })}
      host={host}
    >
      <ZdEstimateLoadingBody
        statusTitle={title}
        statusHint={statusHint}
        chips={chips.length > 0 ? chips : null}
        elapsedLabel={zdEstimateLoadingElapsedLabel({
          elapsedMs,
          forceComplete,
          busyDetail: zdEstimateLoadingBusyDetailSessionResume(),
        })}
        steps={steps}
        activeStepIndex={clamped}
        forceComplete={forceComplete}
        busy={!forceComplete}
        ariaLabel={title}
        progressAriaLabel="Postęp wznawiania sesji"
        footerNote={
          forceComplete ? null : zdEstimateSessionResumeProgressFooter()
        }
        disclaimer={
          forceComplete
            ? null
            : "Nie liczymy listy od nowa — wczytujemy zapis z poprzedniej sesji."
        }
      />
    </ZdEstimateLoadingWindow>
  );
}
