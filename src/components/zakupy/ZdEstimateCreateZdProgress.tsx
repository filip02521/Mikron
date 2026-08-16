"use client";

import { useEffect, useState } from "react";
import { ZdEstimateLoadingBody } from "@/components/zakupy/ZdEstimateLoadingBody";
import { ZdEstimateLoadingWindow } from "@/components/zakupy/ZdEstimateLoadingWindow";
import {
  createZdProgressDurationHint,
  createZdProgressPercent,
  createZdProgressStepFromElapsed,
  ZD_CREATE_PROGRESS_STEPS,
} from "@/lib/orders/zd-estimate-create-progress";
import { zdEstimateLoadingElapsedLabel } from "@/lib/orders/zd-estimate-loading-ui";
import {
  ZD_ESTIMATE_UI,
  zdEstimateCreateProgressAriaLabel,
  zdEstimateCreateProgressCompleteHint,
  zdEstimateCreateProgressCompleteTitle,
  zdEstimateCreateProgressFooterBusy,
  zdEstimateCreateProgressFooterLong,
  zdEstimateCreateProgressSnapshotFailedHint,
  zdEstimateCreateProgressTitle,
  zdEstimateLoadingBusyDetailProgress,
} from "@/lib/orders/zd-estimate-ui-copy";

export function ZdEstimateCreateZdProgressPanel({
  startedAtMs,
  lineCount,
  supplierName,
  forceComplete = false,
  snapshotOk = null,
}: {
  startedAtMs: number;
  lineCount: number;
  supplierName?: string | null;
  forceComplete?: boolean;
  /** null = jeszcze w toku; true/false po create. */
  snapshotOk?: boolean | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (forceComplete) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAtMs, forceComplete]);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const stepIndex = createZdProgressStepFromElapsed(elapsedMs, {
    lineCount,
    forceComplete,
  });
  const clamped = Math.max(
    0,
    Math.min(stepIndex, ZD_CREATE_PROGRESS_STEPS.length - 1)
  );
  const percent = createZdProgressPercent(elapsedMs, { forceComplete });
  const active = ZD_CREATE_PROGRESS_STEPS[clamped]!;
  const completeFailed = forceComplete && snapshotOk === false;
  const statusTitle = forceComplete
    ? zdEstimateCreateProgressCompleteTitle({ snapshotOk })
    : zdEstimateCreateProgressTitle();
  const statusHint = forceComplete
    ? zdEstimateCreateProgressCompleteHint({ snapshotOk })
    : active.activeHint;

  const chips = [
    ...(supplierName
      ? [{ label: "Dostawca", value: supplierName } as const]
      : []),
    {
      label: "Lista",
      value: `${lineCount} poz.`,
    } as const,
  ];

  const footerNote = forceComplete
    ? null
    : elapsedMs >= 45_000
      ? zdEstimateCreateProgressFooterLong()
      : zdEstimateCreateProgressFooterBusy();

  return (
    <ZdEstimateLoadingWindow
      variant="embedded"
      showBrandHeader={false}
      windowClassName="shadow-none ring-1 ring-indigo-100/80 border-indigo-100/90"
    >
      <ZdEstimateLoadingBody
        statusTitle={statusTitle}
        statusHint={statusHint}
        statusTone={
          completeFailed ? "warning" : forceComplete ? "complete" : "busy"
        }
        chips={chips}
        disclaimer={
          forceComplete ? null : ZD_ESTIMATE_UI.createProgressDisclaimer
        }
        elapsedLabel={zdEstimateLoadingElapsedLabel({
          elapsedMs,
          forceComplete,
          busyDetail: zdEstimateLoadingBusyDetailProgress(),
        })}
        steps={ZD_CREATE_PROGRESS_STEPS}
        activeStepIndex={clamped}
        forceComplete={forceComplete}
        progressPct={percent}
        footerMeta={
          forceComplete ? null : createZdProgressDurationHint(lineCount)
        }
        footerNote={footerNote}
        busy={!forceComplete}
        ariaLabel={zdEstimateCreateProgressAriaLabel()}
        progressAriaLabel="Postęp tworzenia ZD"
        showStepDoneHints
        stepFailureId={completeFailed ? "snapshot" : null}
        stepFailureHint={
          completeFailed
            ? zdEstimateCreateProgressSnapshotFailedHint()
            : null
        }
      />
    </ZdEstimateLoadingWindow>
  );
}
