"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { actionGetZdEstimateRunStatus, type ZdEstimateRunStatus } from "@/app/actions/zd-estimate";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import {
  dismissZdEstimateTrackedRun,
  getZdEstimateRunTrackerServerSnapshot,
  getZdEstimateRunTrackerSnapshot,
  resolveZdEstimateTrackedRun,
  subscribeZdEstimateRunTracker,
  type ZdEstimateTrackedRun,
} from "@/lib/client/zd-estimate-run-tracker";
import {
  buildReturnToWizardUrl,
  clearZdEstimateExternalSessionToken,
  createZdEstimateExternalSessionToken,
  peekZdEstimateExternalSessionToken,
  writeZdEstimateExternalSessionToken,
  ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/orders/zd-estimate-external-session";
import { deleteZdEstimateExternalSessionRecord } from "@/lib/orders/zd-estimate-external-session-actions";
import { ZD_ESTIMATE_RUN_LOST_MESSAGE, zdEstimateRunNoticeCopy } from "@/lib/orders/zd-estimate-run-notice-copy";
import { floatingZdSessionRailClass } from "@/lib/ui/sales-mobile-chrome";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

const WIZARD_PATH = "/zakupy/szacunek";
const STATUS_POLL_MS = 3_000;
const COLLAPSED_W = "3rem";
const EXPANDED_W = "17.5rem";
const PANEL_H = "11.5rem";
const CLOSE_DELAY_MS = 240;

/** Liczenie śledzone poza Kreatorem (Kreator sam obsługuje to, na które czeka na ekranie). */
export function useZdEstimateTrackedRunAway(): ZdEstimateTrackedRun | null {
  const { run, ownedRunId } = useSyncExternalStore(
    subscribeZdEstimateRunTracker,
    getZdEstimateRunTrackerSnapshot,
    getZdEstimateRunTrackerServerSnapshot
  );
  return run && run.runId !== ownedRunId ? run : null;
}

type GetRunStatus = (runId: string, ownerUserId: string) => Promise<ZdEstimateRunStatus>;

function RunNoticePanel({
  run,
  onWizard,
  getStatus,
}: {
  run: ZdEstimateTrackedRun;
  onWizard: boolean;
  getStatus: GetRunStatus;
}) {
  const router = useRouter();
  // Gotowa lista i błąd same się rozwijają — to jest powiadomienie; zwijają się dopiero, gdy
  // użytkownik najedzie i odjedzie (zobaczył). Liczenie jest zwinięte, poza Kreatorem: tam
  // rozwinięte mówi, że lista już się liczy i nie trzeba klikać „Policz” drugi raz.
  const [pinned, setPinned] = useState(run.state !== "running" || onWizard);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState({ pagesCommitted: 0, totalPages: 0 });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const running = run.state === "running";
  const expanded = hovered || pinned;

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const status = await getStatus(run.runId, run.ownerUserId);
        if (stopped) return;
        if (status.state === "running") {
          setProgress({ pagesCommitted: status.pagesCommitted, totalPages: status.totalPages });
        } else if (status.state === "ready") {
          // Serwer zastąpił poprzednią sesję Kreatora tą listą — stary token już nic nie otworzy.
          if (peekZdEstimateExternalSessionToken()?.sessionId !== status.sessionId) {
            clearZdEstimateExternalSessionToken();
          }
          resolveZdEstimateTrackedRun(run.runId, status);
        } else if (status.state === "not_yours") {
          // Inne konto w tej karcie — to nie jego liczenie.
          dismissZdEstimateTrackedRun(run.runId);
        } else if (status.state === "unavailable") {
          // Wygasła sesja albo podgląd innego panelu — zapytamy ponownie, lista nie przepada.
        } else {
          resolveZdEstimateTrackedRun(run.runId, {
            state: "failed",
            message: status.state === "failed" ? status.message : ZD_ESTIMATE_RUN_LOST_MESSAGE,
          });
        }
      } catch {
        // Zerwane połączenie — spróbujemy przy kolejnym pytaniu.
      } finally {
        inFlight = false;
      }
    };
    const bootId = window.setTimeout(() => void tick(), 0);
    const pollId = window.setInterval(() => void tick(), STATUS_POLL_MS);
    const clockId = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => {
      stopped = true;
      window.clearTimeout(bootId);
      window.clearInterval(pollId);
      window.clearInterval(clockId);
    };
  }, [run.runId, run.ownerUserId, running, getStatus]);

  useEffect(
    () => () => {
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  const open = () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setHovered(true);
  };
  const scheduleClose = () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setHovered(false);
      setPinned(false);
    }, CLOSE_DELAY_MS);
  };

  const copy = zdEstimateRunNoticeCopy({
    state: run.state,
    label: run.label,
    message: run.message,
    elapsedMs: nowMs - run.startedAtMs,
    ...progress,
  });
  const failed = run.state === "failed";

  const goToWizard = (url: string) => {
    // W Kreatorze potrzebne jest świeże wejście — otwarty ekran nie podejmie sesji sam.
    if (onWizard) window.location.assign(url);
    else router.push(url);
  };

  const onPrimary = () => {
    if (run.state === "ready" && run.sessionId) {
      writeZdEstimateExternalSessionToken(
        createZdEstimateExternalSessionToken({
          sessionId: run.sessionId,
          schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
          supplierId: run.supplierId,
          scopeMode: run.scopeMode,
          grupaId: run.grupaId,
          cechaId: run.cechaId,
        })
      );
      dismissZdEstimateTrackedRun(run.runId);
      goToWizard(buildReturnToWizardUrl({ resumeParam: true }));
      return;
    }
    if (failed) dismissZdEstimateTrackedRun(run.runId);
    goToWizard(buildReturnToWizardUrl({ resumeParam: false }));
  };

  const onSecondary = async () => {
    if (run.state === "ready" && run.sessionId) {
      setBusy(true);
      await deleteZdEstimateExternalSessionRecord(run.sessionId).catch(() => {});
    }
    dismissZdEstimateTrackedRun(run.runId);
  };

  return (
    <div className={cn("pointer-events-none fixed z-[75]", floatingZdSessionRailClass)}>
      <div
        data-testid="zd-estimate-run-floating-notice"
        data-state={run.state}
        role="group"
        tabIndex={0}
        aria-label={`${copy.title}${copy.subject ? ` ${copy.subject}` : ""}`}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
        }}
        className={cn(
          "pointer-events-auto flex overflow-hidden origin-right",
          "rounded-l-xl border border-r-0 bg-card",
          "shadow-[0_8px_28px_rgba(15,23,42,0.12)]",
          "transition-[width] duration-200 ease-out will-change-[width] motion-reduce:transition-none",
          controlFocusClass,
          failed ? "border-amber-200/90" : "border-indigo-200/90"
        )}
        style={{ width: expanded ? EXPANDED_W : COLLAPSED_W, height: PANEL_H }}
      >
        <div
          className={cn(
            "flex h-full w-12 shrink-0 flex-col items-center justify-center gap-2 border-r px-1 py-2",
            failed ? "border-amber-100 bg-amber-50/95" : "border-indigo-100 bg-indigo-50/95"
          )}
          aria-hidden
        >
          {running ? (
            <BrandLoader size="sm" tile={false} />
          ) : (
            <span className={cn("inline-flex h-2 w-2 rounded-full", failed ? "bg-amber-500" : "bg-indigo-500")} />
          )}
          <span
            className={cn(
              "text-[11px] font-semibold [writing-mode:vertical-rl] rotate-180",
              failed ? "text-amber-800" : "text-indigo-800"
            )}
          >
            {copy.compact}
          </span>
        </div>

        <div
          className={cn(
            "flex h-full min-w-0 flex-1 flex-col transition-opacity duration-150 ease-out motion-reduce:transition-none",
            expanded ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={!expanded}
        >
          <div className="min-w-0 flex-1 overflow-hidden px-3 pt-3 pb-2" role="status" aria-live="polite">
            <p className="text-sm font-semibold leading-snug text-slate-900">{copy.title}</p>
            {copy.subject ? (
              <p className={cn("mt-0.5 truncate text-xs font-medium", failed ? "text-amber-800" : "text-indigo-700")}>
                {copy.subject}
              </p>
            ) : null}
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-slate-500">{copy.detail}</p>
          </div>

          <div
            className={cn(
              "flex flex-col gap-1.5 border-t px-3 py-2.5",
              failed ? "border-amber-100/90 bg-amber-50/40" : "border-indigo-100/90 bg-indigo-50/30"
            )}
          >
            <button
              type="button"
              tabIndex={expanded ? 0 : -1}
              onClick={onPrimary}
              className={cn(
                "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition",
                failed ? "bg-amber-600 hover:bg-warning-hover" : "bg-indigo-600 hover:bg-primary-hover",
                controlFocusClass
              )}
            >
              <IconClipboardList size={15} strokeWidth={2.25} />
              {copy.primaryCta}
            </button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              tabIndex={expanded ? 0 : -1}
              className="h-8 w-full text-xs text-slate-600"
              disabled={busy}
              onClick={() => void onSecondary()}
            >
              {copy.secondaryCta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Zakładka przy prawej krawędzi: lista do ZD liczy się w tle albo jest gotowa do otwarcia.
 * Widoczna na każdym ekranie, gdy Kreator nie czeka na ten wynik sam.
 */
export function ZdEstimateRunFloatingNotice({
  forceEnabled,
  getStatus = actionGetZdEstimateRunStatus,
}: {
  /** Harness /e2e-lab: pokaż mimo ścieżki laboratorium. */
  forceEnabled?: boolean;
  /** Harness: status bez serwera. */
  getStatus?: GetRunStatus;
}) {
  const pathname = usePathname() ?? "";
  const hydrated = useClientHydrated();
  const run = useZdEstimateTrackedRunAway();
  if (!hydrated || !run || (!forceEnabled && pathname.startsWith("/e2e-lab"))) return null;
  return createPortal(
    <RunNoticePanel
      key={`${run.runId}:${run.state}`}
      run={run}
      onWizard={pathname.startsWith(WIZARD_PATH)}
      getStatus={getStatus}
    />,
    document.body
  );
}
