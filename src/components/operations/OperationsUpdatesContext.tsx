"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { operationsAutoRefreshStore as autoRefreshStore } from "@/lib/client/operations-auto-refresh-store";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { systemNoticePanelStripClass } from "@/lib/ui/ontime-theme";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { usePatchAppShellNavBadges } from "@/components/layout/AppShellMetricsContext";
import {
  boardQuestionsSoundMutedStore,
  isBoardQuestionsSoundEnabled,
} from "@/lib/client/board-questions-sound";
import { useBoardNotificationSoundEffects } from "@/lib/client/board-notification-sound-effects";
import { unlockNotificationSound } from "@/lib/client/notification-sound";

const POLL_MS = 25_000;
/** Pierwszy poll z opóźnieniem — SSR licznika może być nieaktualny; unikamy fałszywego dźwięku. */
const INITIAL_POLL_DELAY_MS = 4_000;
const AUTO_REFRESH_MS = 3 * 60_000;
const FRESH_HIGHLIGHT_MS = 5_000;
const boardQuestionsSoundStore = boardQuestionsSoundMutedStore;

type OperationsUpdatesContextValue = {
  hasUpdates: boolean;
  refreshNow: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  boardQuestionsSound: boolean;
  setBoardQuestionsSound: (value: boolean) => void;
  lastSyncedAt: number | null;
  lastPollAt: number | null;
  refreshGeneration: number;
  freshHighlightUntil: number;
};

const OperationsUpdatesContext = createContext<OperationsUpdatesContextValue | null>(
  null
);

export function useOperationsUpdates() {
  return useContext(OperationsUpdatesContext);
}

async function fetchVersion(): Promise<{
  version: string | null;
  openBoardQuestions: number | null;
}> {
  try {
    const res = await fetch("/api/operations/daily-panel-version", {
      cache: "no-store",
    });
    if (!res.ok) return { version: null, openBoardQuestions: null };
    const body = (await res.json()) as {
      version?: string;
      openBoardQuestions?: number;
    };
    return {
      version: body.version ?? null,
      openBoardQuestions:
        typeof body.openBoardQuestions === "number" ? body.openBoardQuestions : null,
    };
  } catch {
    return { version: null, openBoardQuestions: null };
  }
}

export function OperationsUpdatesProvider({
  children,
  initialVersion,
  initialOpenBoardQuestions = 0,
  enabled,
  soundBaselineReady = true,
}: {
  children: React.ReactNode;
  initialVersion: string | null;
  initialOpenBoardQuestions?: number;
  enabled: boolean;
  soundBaselineReady?: boolean;
}) {
  const router = useRouter();
  const patchNavBadges = usePatchAppShellNavBadges();
  const hydrated = useClientHydrated();
  const [baseline, setBaseline] = useState(initialVersion);
  const [latest, setLatest] = useState(initialVersion);
  const autoRefresh = usePersistedFlag(autoRefreshStore);
  const boardQuestionsSoundMuted = usePersistedFlag(boardQuestionsSoundStore);
  const boardQuestionsSound = isBoardQuestionsSoundEnabled(boardQuestionsSoundMuted);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [freshHighlightUntil, setFreshHighlightUntil] = useState(0);
  const syncingRef = useRef(false);
  const versionKey = `${enabled}\0${initialVersion ?? ""}`;
  const [appliedVersionKey, setAppliedVersionKey] = useState("");
  if (enabled && initialVersion != null && versionKey !== appliedVersionKey) {
    setAppliedVersionKey(versionKey);
    setBaseline(initialVersion);
    setLatest(initialVersion);
  }

  const setBoardQuestionsSound = useCallback((value: boolean) => {
    boardQuestionsSoundStore.setValue(!value);
    if (value) {
      void unlockNotificationSound();
    }
  }, []);

  const onBoardQuestionsCountApplied = useCallback(
    (nextCount: number) => {
      patchNavBadges({ departmentBoardQuestions: nextCount });
    },
    [patchNavBadges]
  );

  const { applyCount: applyOpenBoardQuestionsCount } = useBoardNotificationSoundEffects({
    enabled,
    soundEnabled: hydrated && boardQuestionsSound,
    initialCount: initialOpenBoardQuestions,
    baselineReady: soundBaselineReady,
    onCountApplied: onBoardQuestionsCountApplied,
  });

  const syncBaseline = useCallback((version: string | null) => {
    setBaseline(version);
    setLatest(version);
  }, []);

  const refreshNow = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    router.refresh();
    if (latest) setBaseline(latest);
    void fetchVersion()
      .then(({ version, openBoardQuestions }) => {
        if (version) syncBaseline(version);
        applyOpenBoardQuestionsCount(openBoardQuestions);
        const now = Date.now();
        setLastSyncedAt(now);
        setLastPollAt(now);
        setRefreshGeneration((g) => g + 1);
        setFreshHighlightUntil(now + FRESH_HIGHLIGHT_MS);
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [router, latest, syncBaseline, applyOpenBoardQuestionsCount]);

  const setAutoRefresh = useCallback((value: boolean) => {
    autoRefreshStore.setValue(value);
    if (value && enabled && latest && baseline && latest !== baseline) {
      refreshNow();
    }
  }, [enabled, latest, baseline, refreshNow]);

  const poll = useCallback(async () => {
    const { version, openBoardQuestions } = await fetchVersion();
    applyOpenBoardQuestionsCount(openBoardQuestions);
    if (!version) return;
    const now = Date.now();
    setLatest(version);
    setLastPollAt(now);
    setBaseline((prev) => prev ?? version);
  }, [applyOpenBoardQuestionsCount]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void poll();
    }, INITIAL_POLL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, poll]);

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, poll]);

  useEffect(() => {
    if (!enabled || !autoRefresh) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (latest && baseline && latest !== baseline) {
        refreshNow();
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled, autoRefresh, latest, baseline, refreshNow]);

  const hasUpdates = Boolean(
    enabled && baseline && latest && latest !== baseline
  );

  return (
    <OperationsUpdatesContext.Provider
      value={{
        hasUpdates,
        refreshNow,
        autoRefresh,
        setAutoRefresh,
        boardQuestionsSound,
        setBoardQuestionsSound,
        lastSyncedAt,
        lastPollAt,
        refreshGeneration,
        freshHighlightUntil,
      }}
    >
      {children}
    </OperationsUpdatesContext.Provider>
  );
}

export function OperationsUpdatesBanner() {
  const ctx = useOperationsUpdates();
  const pathname = usePathname();
  if (!ctx?.hasUpdates || pathname === "/podsumowanie") return null;

  return (
    <SystemNotice
      variant="action"
      className="mb-4 sm:mb-6"
      title="Są nowe prośby lub zmiany w panelu dziennym"
      description={MICROCOPY.notices.operationsUpdates}
      action={
        <Button type="button" size="sm" className="min-h-10 shrink-0" onClick={ctx.refreshNow}>
          {MICROCOPY.actions.refresh}
        </Button>
      }
    />
  );
}

/** Kompaktowy pasek w panelu — widoczny przy przewijaniu (sticky pod zakładkami). */
export function OperationsPanelRefreshStrip() {
  const ctx = useOperationsUpdates();
  if (!ctx?.hasUpdates) return null;

  return (
    <div role="status" aria-live="polite" className={systemNoticePanelStripClass}>
      <p className="text-sm font-medium text-slate-900">
        {MICROCOPY.notices.operationsQueueChanged}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-10 w-full shrink-0 border-slate-200 bg-white sm:min-h-9 sm:w-auto"
        onClick={ctx.refreshNow}
      >
        Odśwież panel
      </Button>
    </div>
  );
}
