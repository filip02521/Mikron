"use client";

import { useEffect, useMemo, useState } from "react";
import { ZdEstimateLoadingBody } from "@/components/zakupy/ZdEstimateLoadingBody";
import { ZdEstimateLoadingWindow } from "@/components/zakupy/ZdEstimateLoadingWindow";
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import { launchProgressStepFromElapsed } from "@/lib/orders/zd-estimate-launch-progress";
import { zdEstimateLoadingElapsedLabel } from "@/lib/orders/zd-estimate-loading-ui";
import { ZD_ESTIMATE_LAUNCH_FOCUS_ID } from "@/lib/orders/zd-estimate-launch-scroll";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  zdEstimateLaunchProgressCompleteHint,
  zdEstimateLaunchProgressCompleteTitle,
  zdEstimateLaunchProgressFooter,
  zdEstimateLaunchProgressSteps,
  zdEstimateLaunchProgressTitle,
  zdEstimateLoadingBusyDetailProgress,
  zdEstimatePageHint,
} from "@/lib/orders/zd-estimate-ui-copy";

export function ZdEstimateLaunchProgressPanel({
  supplierName,
  scopeLabel,
  scopeMode,
  startedAtMs,
  scopeAlreadyResolved = true,
  forceComplete = false,
  ordersIsLive = false,
  host = null,
}: {
  supplierName?: string | null;
  scopeLabel?: string | null;
  scopeMode?: "grupa" | "cecha" | null;
  startedAtMs: number;
  scopeAlreadyResolved?: boolean;
  forceComplete?: boolean;
  ordersIsLive?: boolean;
  host?: ZdEstimateHostStrip | null;
}) {
  const steps = useMemo(
    () =>
      zdEstimateLaunchProgressSteps({
        isLive: ordersIsLive,
        scopeAlreadyResolved,
      }),
    [ordersIsLive, scopeAlreadyResolved]
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const manualWithScope = Boolean(scopeAlreadyResolved && scopeLabel);

  useEffect(() => {
    if (forceComplete) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAtMs, forceComplete]);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const activeStepIndex = forceComplete
    ? steps.length - 1
    : launchProgressStepFromElapsed(elapsedMs, {
        scopeAlreadyResolved,
        stepCount: steps.length,
      });

  const clamped = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
  const title = forceComplete
    ? zdEstimateLaunchProgressCompleteTitle()
    : zdEstimateLaunchProgressTitle({ manualWithScope });
  const statusHint = forceComplete
    ? zdEstimateLaunchProgressCompleteHint()
    : steps[clamped]!.activeHint;

  const chips = [
    ...(supplierName
      ? [{ label: "Dostawca", value: supplierName } as const]
      : []),
    ...(scopeLabel
      ? [
          {
            label: scopeMode === "cecha" ? "Cecha" : "Grupa",
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
          busyDetail: zdEstimateLoadingBusyDetailProgress(),
        })}
        steps={steps}
        activeStepIndex={clamped}
        forceComplete={forceComplete}
        busy={!forceComplete}
        ariaLabel={title}
        progressAriaLabel="Postęp liczenia listy"
        footerNote={
          forceComplete ? null : zdEstimateLaunchProgressFooter()
        }
      />
    </ZdEstimateLoadingWindow>
  );
}
