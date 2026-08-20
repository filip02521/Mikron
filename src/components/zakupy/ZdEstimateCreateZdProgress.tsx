"use client";

import { useEffect, useState } from "react";
import { ZdEstimateLoadingBody } from "@/components/zakupy/ZdEstimateLoadingBody";
import { ZdEstimateLoadingWindow } from "@/components/zakupy/ZdEstimateLoadingWindow";
import type { ZdEstimateHostStrip } from "@/lib/orders/zd-estimate-host";
import {
  createZdProgressDurationHint,
  createZdProgressPercent,
  createZdProgressStepFromElapsed,
  ZD_CREATE_PROGRESS_STEPS,
} from "@/lib/orders/zd-estimate-create-progress";
import { ZD_ESTIMATE_CREATE_PROGRESS_FOCUS_ID } from "@/lib/orders/zd-estimate-launch-scroll";
import { zdEstimateLoadingElapsedLabel } from "@/lib/orders/zd-estimate-loading-ui";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  zdEstimateCreateProgressAriaLabel,
  zdEstimateCreateProgressCompleteHint,
  zdEstimateCreateProgressCompleteTitle,
  zdEstimateCreateProgressFooterNote,
  zdEstimateCreateProgressSnapshotFailedHint,
  zdEstimateCreateProgressTitle,
  zdEstimateCreateProgressWindowHint,
  zdEstimateLoadingBusyDetailProgress,
} from "@/lib/orders/zd-estimate-ui-copy";

/**
 * Loading „Utwórz ZD” — to samo okno co Policz / wczytywanie trasy
 * (belka Kreatora, checklista, pasek). Kroki i pasek są szacunkowe.
 */
export function ZdEstimateCreateZdProgressPanel({
  startedAtMs,
  lineCount,
  supplierName,
  scopeLabel,
  scopeMode,
  forceComplete = false,
  snapshotOk = null,
  host = null,
  ordersIsLive = false,
  titleAs = "h2",
}: {
  startedAtMs: number;
  lineCount: number;
  supplierName?: string | null;
  scopeLabel?: string | null;
  scopeMode?: "grupa" | "cecha" | null;
  forceComplete?: boolean;
  /** null = jeszcze w toku; true/false po create. */
  snapshotOk?: boolean | null;
  host?: ZdEstimateHostStrip | null;
  ordersIsLive?: boolean;
  titleAs?: "h1" | "h2";
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isLive = host?.isLive ?? ordersIsLive;
  const configured = host?.configured ?? true;

  useEffect(() => {
    if (forceComplete) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAtMs, forceComplete]);

  useEffect(() => {
    const el = document.getElementById(ZD_ESTIMATE_CREATE_PROGRESS_FOCUS_ID);
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, []);

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
    ...(scopeLabel
      ? [
          {
            label: scopeMode === "cecha" ? "Cecha" : "Grupa",
            value: scopeLabel,
            tone: "emerald" as const,
          },
        ]
      : []),
    {
      label: "Lista",
      value: `${lineCount} poz.`,
    } as const,
  ];

  const footerNote = forceComplete
    ? null
    : zdEstimateCreateProgressFooterNote({
        elapsedMs,
        durationHint: createZdProgressDurationHint(lineCount),
      });

  return (
    <ZdEstimateLoadingWindow
      focusId={ZD_ESTIMATE_CREATE_PROGRESS_FOCUS_ID}
      titleAs={titleAs}
      description={ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION}
      hint={zdEstimateCreateProgressWindowHint({
        isLive,
        configured,
      })}
      host={host}
    >
      <ZdEstimateLoadingBody
        statusTitle={statusTitle}
        statusHint={statusHint}
        statusTone={
          completeFailed ? "warning" : forceComplete ? "complete" : "busy"
        }
        chips={chips}
        elapsedLabel={zdEstimateLoadingElapsedLabel({
          elapsedMs,
          forceComplete,
          busyDetail: zdEstimateLoadingBusyDetailProgress(),
        })}
        steps={ZD_CREATE_PROGRESS_STEPS}
        activeStepIndex={clamped}
        forceComplete={forceComplete}
        progressPct={percent}
        footerNote={footerNote}
        busy={!forceComplete}
        ariaLabel={zdEstimateCreateProgressAriaLabel()}
        progressAriaLabel="Postęp tworzenia ZD"
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
