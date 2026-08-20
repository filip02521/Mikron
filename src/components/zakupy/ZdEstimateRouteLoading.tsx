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
 * Krótki loading trasy (bootstrap SSR).
 * Wznowienie sesji robi wyłącznie workbench — tu nie duplikujemy gate'a resume.
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
  const stepMs = ZD_ESTIMATE_ROUTE_LOADING_STEP_MS;
  const stepCount = Math.min(steps.length, ZD_ESTIMATE_ROUTE_LOADING_STEP_COUNT);

  const activeStepIndex = launchProgressStepFromElapsed(elapsedMs, {
    scopeAlreadyResolved: false,
    stepMs,
    stepCount,
  });
  const clamped = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
  const progressPct = Math.min(
    92,
    ((clamped +
      Math.min(1, (elapsedMs % stepMs) / stepMs)) /
      steps.length) *
      100
  );

  const title = zdEstimateRouteLoadingTitle();
  const activeHint = steps[clamped]!.activeHint;
  const footerNote = zdEstimateRouteLoadingFooter();
  const ariaLabel = zdEstimateRouteLoadingAriaLabel();

  return (
    <ZdEstimateLoadingWindow
      description={ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION}
      hint={zdEstimateRouteLoadingHint()}
      hostPlaceholder
      className="items-start pt-[clamp(10rem,32vh,18rem)] pb-8 sm:pt-[clamp(11rem,34vh,20rem)] sm:pb-10"
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
        footerNote={footerNote}
        ariaLabel={ariaLabel}
        progressAriaLabel="Postęp wczytywania kreatora"
      />
    </ZdEstimateLoadingWindow>
  );
}
