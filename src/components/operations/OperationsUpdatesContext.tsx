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
import { redirectToLoginIfUnauthorizedStatus } from "@/lib/auth/session-login-redirect";
import { usePatchAppShellNavBadges } from "@/components/layout/AppShellMetricsContext";
import {
  boardQuestionsSoundMutedStore,
  isBoardQuestionsSoundEnabled,
} from "@/lib/client/board-questions-sound";
import { useBoardNotificationSoundEffects } from "@/lib/client/board-notification-sound-effects";
import { unlockNotificationSound } from "@/lib/client/notification-sound";
import {
  isOperationsPrimaryLiveRefreshPath,
  LIVE_PANEL_AUTO_REFRESH_INTERVAL_MS,
  shouldFireLivePanelAutoRefresh,
} from "@/lib/client/live-panel-auto-refresh";

const POLL_MS = 25_000;
/** Pierwszy poll z opóźnieniem — SSR licznika może być nieaktualny; unikamy fałszywego dźwięku. */
const INITIAL_POLL_DELAY_MS = 4_000;
const AUTO_REFRESH_MS = LIVE_PANEL_AUTO_REFRESH_INTERVAL_MS;
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
  navBadge: number | null;
  verificationCount: number | null;
  realizacjaCount: number | null;
  operationsNotatki: number | null;
}> {
  try {
    const res = await fetch("/api/operations/daily-panel-version", {
      cache: "no-store",
    });
    if (redirectToLoginIfUnauthorizedStatus(res.status)) {
      return {
        version: null,
        openBoardQuestions: null,
        navBadge: null,
        verificationCount: null,
        realizacjaCount: null,
        operationsNotatki: null,
      };
    }
    if (!res.ok) {
      return {
        version: null,
        openBoardQuestions: null,
        navBadge: null,
        verificationCount: null,
        realizacjaCount: null,
        operationsNotatki: null,
      };
    }
    const body = (await res.json()) as {
      version?: string;
      openBoardQuestions?: number;
      navBadge?: number;
      verificationCount?: number;
      realizacjaCount?: number;
      operationsNotatki?: number;
    };
    return {
      version: body.version ?? null,
      openBoardQuestions:
        typeof body.openBoardQuestions === "number" ? body.openBoardQuestions : null,
      navBadge: typeof body.navBadge === "number" ? body.navBadge : null,
      verificationCount:
        typeof body.verificationCount === "number" ? body.verificationCount : null,
      realizacjaCount:
        typeof body.realizacjaCount === "number" ? body.realizacjaCount : null,
      operationsNotatki:
        typeof body.operationsNotatki === "number" ? body.operationsNotatki : null,
    };
  } catch {
    return {
      version: null,
      openBoardQuestions: null,
      navBadge: null,
      verificationCount: null,
      realizacjaCount: null,
      operationsNotatki: null,
    };
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
  const pathname = usePathname();
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
  const lastPrimaryAutoRefreshAtRef = useRef(0);
  const lastFlagAutoRefreshAtRef = useRef(0);
  /** Bump przy powrocie na kartę — effecty auto-refresh muszą się odpalić ponownie. */
  const [visibilityEpoch, setVisibilityEpoch] = useState(0);
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

  const patchLiveBadges = useCallback(
    (data: Awaited<ReturnType<typeof fetchVersion>>) => {
      const patch: Partial<Record<string, number>> = {};
      if (data.openBoardQuestions != null) {
        patch.departmentBoardQuestions = data.openBoardQuestions;
      }
      if (data.navBadge != null) patch.nowe = data.navBadge;
      if (data.verificationCount != null) patch.weryfikacja = data.verificationCount;
      if (data.realizacjaCount != null) patch.realizacja = data.realizacjaCount;
      if (data.operationsNotatki != null) patch.operationsNotatki = data.operationsNotatki;
      if (Object.keys(patch).length > 0) patchNavBadges(patch);
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
      .then(({ version, openBoardQuestions, ...rest }) => {
        if (version) syncBaseline(version);
        applyOpenBoardQuestionsCount(openBoardQuestions);
        patchLiveBadges({ version, openBoardQuestions, ...rest });
        const now = Date.now();
        setLastSyncedAt(now);
        setLastPollAt(now);
        setRefreshGeneration((g) => g + 1);
        setFreshHighlightUntil(now + FRESH_HIGHLIGHT_MS);
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [router, latest, syncBaseline, applyOpenBoardQuestionsCount, patchLiveBadges]);

  const setAutoRefresh = useCallback(
    (value: boolean) => {
      autoRefreshStore.setValue(value);
      if (value && enabled && latest && baseline && latest !== baseline) {
        refreshNow();
      }
    },
    [enabled, latest, baseline, refreshNow]
  );

  const poll = useCallback(async () => {
    const data = await fetchVersion();
    applyOpenBoardQuestionsCount(data.openBoardQuestions);
    patchLiveBadges(data);
    if (!data.version) return;
    const now = Date.now();
    setLatest(data.version);
    setLastPollAt(now);
    setBaseline((prev) => prev ?? data.version);
  }, [applyOpenBoardQuestionsCount, patchLiveBadges]);

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
      if (document.visibilityState !== "visible") return;
      void poll();
      // Poll sam w sobie może nie zmienić `latest` (już ustawiony w tle) —
      // epoch wymusza ponowną ocenę effectów primary/flag.
      setVisibilityEpoch((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, poll]);

  /**
   * Panel dzienny / weryfikacja / tablica zakupów: odśwież treść zaraz po zmianie
   * wersji (jak /moje u handlowców) — bez wymogu toggle w ustawieniach.
   *
   * Nie sprawdzamy syncingRef tutaj — refreshNow i tak jest idempotentny;
   * wczesny return przy syncing blokowałby retry po zakończeniu syncu.
   */
  useEffect(() => {
    if (!enabled) return;
    if (!latest || !baseline || latest === baseline) return;
    if (!isOperationsPrimaryLiveRefreshPath(pathname)) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const decision = shouldFireLivePanelAutoRefresh({
      lastFiredAt: lastPrimaryAutoRefreshAtRef.current,
    });
    if (!decision.fire) return;
    lastPrimaryAutoRefreshAtRef.current = decision.nextFiredAt;
    lastFlagAutoRefreshAtRef.current = decision.nextFiredAt;
    refreshNow();
  }, [enabled, latest, baseline, pathname, refreshNow, visibilityEpoch]);

  /**
   * Flaga auto-odświeżania: na pozostałych ścieżkach ops odśwież zaraz po diffie
   * (nie czekaj na timer 3 min). Primary path obsługuje osobny effect.
   */
  useEffect(() => {
    if (!enabled || !autoRefresh) return;
    if (!latest || !baseline || latest === baseline) return;
    if (isOperationsPrimaryLiveRefreshPath(pathname)) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const decision = shouldFireLivePanelAutoRefresh({
      lastFiredAt: lastFlagAutoRefreshAtRef.current,
    });
    if (!decision.fire) return;
    lastFlagAutoRefreshAtRef.current = decision.nextFiredAt;
    refreshNow();
  }, [enabled, autoRefresh, latest, baseline, pathname, refreshNow, visibilityEpoch]);

  /** Backup: gdy flaga ON, okresowo doganiaj (np. po długiej niewidoczności karty). */
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
  // Primary paths odświeżają się same — banner zbędny (jak /moje u handlowców).
  if (!ctx?.hasUpdates || isOperationsPrimaryLiveRefreshPath(pathname)) return null;

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

/**
 * Kompaktowy pasek w panelu — zwykle miga tylko chwilę przed auto-refresh.
 * Zostaje jako awaryjny przycisk, gdy cooldown / ukryta karta wstrzymały sync.
 */
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
