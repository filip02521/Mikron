"use client";

import { useEffect, useMemo, useState } from "react";
import { ZdEstimateLoadingBody } from "@/components/zakupy/ZdEstimateLoadingBody";
import { ZdEstimateLoadingWindow } from "@/components/zakupy/ZdEstimateLoadingWindow";
import {
  launchProgressStepFromElapsed,
  ZD_ESTIMATE_ROUTE_LOADING_STEP_COUNT,
  ZD_ESTIMATE_ROUTE_LOADING_STEP_MS,
} from "@/lib/orders/zd-estimate-launch-progress";
import { zdEstimateLoadingElapsedLabel } from "@/lib/orders/zd-estimate-loading-ui";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  zdEstimateLoadingBusyDetailRoute,
  zdEstimateRouteLoadingAriaLabel,
  zdEstimateRouteLoadingFooter,
  zdEstimateRouteLoadingHint,
  zdEstimateRouteLoadingSteps,
  zdEstimateRouteLoadingTitle,
} from "@/lib/orders/zd-estimate-ui-copy";

/**
 * Loading trasy — animowana checklista bootstrapu (nie kroki Policz).
 * Kroki idą z czasem, żeby nie stać wiecznie na „1”, zanim RSC odda stronę.
 */
export function ZdEstimateRouteLoading() {
  const steps = useMemo(() => zdEstimateRouteLoadingSteps(), []);
  const [startedAtMs] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const activeStepIndex = launchProgressStepFromElapsed(elapsedMs, {
    scopeAlreadyResolved: false,
    stepMs: ZD_ESTIMATE_ROUTE_LOADING_STEP_MS,
    stepCount: Math.min(
      steps.length,
      ZD_ESTIMATE_ROUTE_LOADING_STEP_COUNT
    ),
  });
  const clamped = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
  const progressPct = Math.min(
    92,
    ((clamped +
      Math.min(
        1,
        (elapsedMs % ZD_ESTIMATE_ROUTE_LOADING_STEP_MS) /
          ZD_ESTIMATE_ROUTE_LOADING_STEP_MS
      )) /
      steps.length) *
      100
  );
  const title = zdEstimateRouteLoadingTitle();
  const activeHint = steps[clamped]!.activeHint;

  return (
    <ZdEstimateLoadingWindow
      description={ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION}
      hint={zdEstimateRouteLoadingHint()}
      hostPlaceholder
    >
      <ZdEstimateLoadingBody
        statusTitle={title}
        statusHint={activeHint}
        elapsedLabel={zdEstimateLoadingElapsedLabel({
          elapsedMs,
          busyDetail: zdEstimateLoadingBusyDetailRoute(),
        })}
        steps={steps}
        activeStepIndex={clamped}
        progressPct={progressPct}
        footerNote={zdEstimateRouteLoadingFooter()}
        ariaLabel={zdEstimateRouteLoadingAriaLabel()}
        progressAriaLabel="Postęp wczytywania kreatora"
      />
    </ZdEstimateLoadingWindow>
  );
}
