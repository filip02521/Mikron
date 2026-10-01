"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { useZdEstimateExternalSessionAwayNotice } from "@/lib/client/use-zd-estimate-external-session-away-notice";
import { buildReturnToWizardUrl } from "@/lib/orders/zd-estimate-external-session";
import { formatZdEstimateElapsedCompact } from "@/lib/orders/zd-estimate-loading-ui";
import {
  zdEstimateExternalSessionCloseCtaLabel,
  zdEstimateExternalSessionFloatingCompactLabel,
  zdEstimateExternalSessionFloatingCountdown,
  zdEstimateExternalSessionFloatingHint,
  zdEstimateExternalSessionFloatingTitle,
  zdEstimateExternalSessionReturnCtaLabel,
} from "@/lib/orders/zd-estimate-ui-copy";
import { floatingZdSessionRailClass } from "@/lib/ui/sales-mobile-chrome";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { Button } from "@/components/ui/Button";
import { IconClipboardList } from "@/components/icons/StrokeIcons";

const WIZARD_PATH_PREFIX = "/zakupy/szacunek";
const COLLAPSED_W = "3rem";
const EXPANDED_W = "17.5rem";
const PANEL_H = "11.5rem";
const CLOSE_DELAY_MS = 240;

function FloatingNoticePanel({
  dataTestId,
  remainingMs,
  closing,
  onCloseSession,
}: {
  dataTestId: string;
  remainingMs: number;
  closing: boolean;
  onCloseSession: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const open = () => {
    clearCloseTimer();
    setExpanded(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setExpanded(false);
    }, CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearCloseTimer(), []);

  const urgent = remainingMs <= 30_000;
  const timeLabel = formatZdEstimateElapsedCompact(remainingMs);
  const countdownLabel = zdEstimateExternalSessionFloatingCountdown({
    remainingMs,
  });
  const returnHref = buildReturnToWizardUrl({ resumeParam: true });

  return (
    <div
      className={cn(
        // Nad changelogiem (z-50) i sticky shell — portal do body.
        "pointer-events-none fixed z-[75]",
        floatingZdSessionRailClass
      )}
    >
      <div
        data-testid={dataTestId}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        aria-label={`${zdEstimateExternalSessionFloatingTitle}. ${countdownLabel}`}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            scheduleClose();
          }
        }}
        className={cn(
          "pointer-events-auto flex overflow-hidden origin-right",
          "rounded-l-xl border border-r-0 bg-white/95 backdrop-blur-md",
          "shadow-[0_8px_28px_rgba(15,23,42,0.12)]",
          "transition-[width] duration-200 ease-out will-change-[width]",
          controlFocusClass,
          urgent ? "border-amber-200/90" : "border-indigo-200/90"
        )}
        style={{
          width: expanded ? EXPANDED_W : COLLAPSED_W,
          height: PANEL_H,
        }}
      >
        <div
          className={cn(
            "flex h-full w-12 shrink-0 flex-col items-center justify-center gap-2 px-1 py-2",
            urgent ? "bg-amber-50/95" : "bg-indigo-50/95",
            "border-r",
            urgent ? "border-amber-100" : "border-indigo-100"
          )}
          aria-hidden
        >
          <span
            className={cn(
              "relative flex h-2 w-2",
              urgent ? "text-amber-500" : "text-indigo-500"
            )}
          >
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-50",
                urgent ? "bg-amber-400" : "bg-indigo-400"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                urgent ? "bg-amber-500" : "bg-indigo-500"
              )}
            />
          </span>
          <span
            className={cn(
              "font-mono text-[11px] font-semibold tabular-nums tracking-tight",
              "[writing-mode:vertical-rl] rotate-180",
              urgent ? "text-amber-800" : "text-indigo-800"
            )}
          >
            {timeLabel}
          </span>
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-[0.14em]",
              "[writing-mode:vertical-rl] rotate-180",
              urgent ? "text-amber-700/90" : "text-indigo-700/90"
            )}
          >
            {zdEstimateExternalSessionFloatingCompactLabel}
          </span>
        </div>

        <div
          className={cn(
            "flex h-full min-w-0 flex-1 flex-col",
            "transition-opacity duration-150 ease-out",
            expanded ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={!expanded}
        >
          <div className="min-w-0 flex-1 px-3 pt-3 pb-2">
            <p className="text-sm font-semibold leading-snug text-slate-900">
              {zdEstimateExternalSessionFloatingTitle}
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs font-medium tabular-nums",
                urgent ? "text-amber-800" : "text-indigo-700"
              )}
              role="status"
              aria-live="polite"
            >
              {countdownLabel}
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              {zdEstimateExternalSessionFloatingHint}
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col gap-1.5 border-t px-3 py-2.5",
              urgent
                ? "border-amber-100/90 bg-amber-50/40"
                : "border-indigo-100/90 bg-indigo-50/30"
            )}
          >
            <Link
              href={returnHref}
              tabIndex={expanded ? 0 : -1}
              className={cn(
                "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition",
                urgent
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-indigo-600 hover:bg-indigo-700",
                controlFocusClass
              )}
            >
              <IconClipboardList size={15} strokeWidth={2.25} />
              {zdEstimateExternalSessionReturnCtaLabel}
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              tabIndex={expanded ? 0 : -1}
              className="h-8 w-full text-xs text-slate-600"
              disabled={closing}
              onClick={onCloseSession}
            >
              {zdEstimateExternalSessionCloseCtaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Poza kreatorem: prawa zakładka z czasem (portal do body).
 * Hover/focus → panel z CTA „Wróć do kreatora”.
 */
export function ZdEstimateExternalSessionFloatingNotice({
  "data-testid": dataTestId = "zd-external-session-floating-notice",
  forceEnabled,
}: {
  "data-testid"?: string;
  /** W harnessie e2e wymuszamy widoczność poza kreatorem. */
  forceEnabled?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const onWizard = pathname.startsWith(WIZARD_PATH_PREFIX);
  const onE2eLab = pathname.startsWith("/e2e-lab");
  // Na /e2e-lab tylko harness z forceEnabled — unikamy podwójnego raila (AppShell + lab).
  const enabled = forceEnabled ?? (!onWizard && !onE2eLab);
  const startAwayIfPaused = forceEnabled ? false : true;
  const hydrated = useClientHydrated();

  const { notice, closing, closeSession, visible } =
    useZdEstimateExternalSessionAwayNotice({ enabled, startAwayIfPaused });

  if (!hydrated || !visible || !notice) return null;

  return createPortal(
    <FloatingNoticePanel
      key={notice.sessionId}
      dataTestId={dataTestId}
      remainingMs={notice.remainingMs}
      closing={closing}
      onCloseSession={() => void closeSession()}
    />,
    document.body
  );
}
