"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { useBoardNotificationSoundEffects } from "@/lib/client/board-notification-sound-effects";
import {
  isSalesBoardAnswerSoundEnabled,
  salesBoardAnswerSoundMutedStore,
} from "@/lib/client/sales-board-answer-sound";
import { unlockNotificationSound } from "@/lib/client/notification-sound";

const POLL_MS = 45_000;
/** Pierwszy poll z opóźnieniem — SSR licznika może być nieaktualny; unikamy fałszywego dźwięku. */
const INITIAL_POLL_DELAY_MS = 4_000;
const AUTO_REFRESH_MS = 3 * 60_000;
const NOTATNIK_AUTO_REFRESH_COOLDOWN_MS = 15_000;
const MOJE_AUTO_REFRESH_COOLDOWN_MS = 12_000;
const STORAGE_KEY = "sales-auto-refresh";
const autoRefreshStore = createPersistedFlagStore(STORAGE_KEY);

import { isSalesZkNavPath } from "@/lib/sales/notepad-page-tabs";
import { clearMojeZdEtaSessionSync } from "@/components/moje/MojeZdEtaSyncClient";

type SalesUpdatesContextValue = {
  hasUpdates: boolean;
  refreshNow: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  boardAnswerSound: boolean;
  setBoardAnswerSound: (value: boolean) => void;
  lastSyncedAt: number | null;
  lastPollAt: number | null;
};

const SalesUpdatesContext = createContext<SalesUpdatesContextValue | null>(null);

export function useSalesUpdates() {
  return useContext(SalesUpdatesContext);
}

async function fetchVersion(): Promise<{
  version: string | null;
  unseenOwnAnswers: number | null;
}> {
  try {
    const res = await fetch("/api/sales/activity-version", {
      cache: "no-store",
    });
    if (!res.ok) return { version: null, unseenOwnAnswers: null };
    const body = (await res.json()) as {
      version?: string;
      unseenOwnAnswers?: number;
    };
    return {
      version: body.version ?? null,
      unseenOwnAnswers:
        typeof body.unseenOwnAnswers === "number" ? body.unseenOwnAnswers : null,
    };
  } catch {
    return { version: null, unseenOwnAnswers: null };
  }
}

export function SalesUpdatesProvider({
  children,
  initialVersion,
  initialUnseenOwnAnswers = 0,
  enabled,
  sessionSalesPersonId = null,
  soundBaselineReady = true,
}: {
  children: React.ReactNode;
  initialVersion: string | null;
  initialUnseenOwnAnswers?: number;
  enabled: boolean;
  /** Własny profil handlowca — do wykrycia podglądu ?dla= innego handlowca. */
  sessionSalesPersonId?: string | null;
  soundBaselineReady?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla")?.trim() || null;
  const teamPreviewActive = Boolean(
    previewDla && sessionSalesPersonId && previewDla !== sessionSalesPersonId
  );
  const effectiveEnabled = enabled && !teamPreviewActive;
  const [baseline, setBaseline] = useState(initialVersion);
  const [latest, setLatest] = useState(initialVersion);
  const autoRefresh = usePersistedFlag(autoRefreshStore);
  const hydrated = useClientHydrated();
  const boardAnswerSoundMuted = usePersistedFlag(salesBoardAnswerSoundMutedStore);
  const boardAnswerSound = isSalesBoardAnswerSoundEnabled(boardAnswerSoundMuted);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const syncingRef = useRef(false);
  const lastNotatnikAutoRefreshAtRef = useRef(0);
  const lastMojeAutoRefreshAtRef = useRef(0);
  const versionKey = `${effectiveEnabled}\0${initialVersion ?? ""}`;
  const [appliedVersionKey, setAppliedVersionKey] = useState("");
  if (effectiveEnabled && initialVersion && versionKey !== appliedVersionKey) {
    setAppliedVersionKey(versionKey);
    setBaseline(initialVersion);
    setLatest(initialVersion);
  }

  const setAutoRefresh = useCallback((value: boolean) => {
    autoRefreshStore.setValue(value);
  }, []);

  const setBoardAnswerSound = useCallback((value: boolean) => {
    salesBoardAnswerSoundMutedStore.setValue(!value);
    if (value) {
      void unlockNotificationSound();
    }
  }, []);

  const { applyCount: applyUnseenOwnAnswersCount } = useBoardNotificationSoundEffects({
    enabled: effectiveEnabled,
    soundEnabled: hydrated && boardAnswerSound,
    initialCount: initialUnseenOwnAnswers,
    baselineReady: soundBaselineReady,
  });

  const syncBaseline = useCallback((version: string | null) => {
    setBaseline(version);
    setLatest(version);
  }, []);

  const refreshNow = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const run = async () => {
      try {
        if (pathname === "/moje" && !teamPreviewActive) {
          clearMojeZdEtaSessionSync();
          try {
            await fetch("/api/sales/zd-eta-refresh", { method: "POST" });
          } catch {
            /* sync opcjonalny — i tak odświeżamy widok */
          }
        }
        router.refresh();
        const { version, unseenOwnAnswers } = await fetchVersion();
        if (version) syncBaseline(version);
        applyUnseenOwnAnswersCount(unseenOwnAnswers);
        const now = Date.now();
        setLastSyncedAt(now);
        setLastPollAt(now);
      } finally {
        syncingRef.current = false;
      }
    };

    void run();
  }, [router, syncBaseline, pathname, teamPreviewActive, applyUnseenOwnAnswersCount]);

  const poll = useCallback(async () => {
    const { version, unseenOwnAnswers } = await fetchVersion();
    applyUnseenOwnAnswersCount(unseenOwnAnswers);
    if (!version) return;
    const now = Date.now();
    setLatest(version);
    setLastPollAt(now);
  }, [applyUnseenOwnAnswersCount]);

  useEffect(() => {
    if (!effectiveEnabled) return;
    const timer = window.setTimeout(() => {
      void poll();
    }, INITIAL_POLL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [effectiveEnabled, poll]);

  useEffect(() => {
    if (!effectiveEnabled) return;

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
  }, [effectiveEnabled, poll]);

  useEffect(() => {
    if (!effectiveEnabled || !autoRefresh || isSalesZkNavPath(pathname)) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (latest && baseline && latest !== baseline) {
        refreshNow();
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [effectiveEnabled, autoRefresh, latest, baseline, refreshNow, pathname]);

  /** Notatnik: odśwież widok od razu po wykryciu zmian (ZK, prośby). */
  useEffect(() => {
    if (!effectiveEnabled || syncingRef.current) return;
    if (!latest || !baseline || latest === baseline) return;
    if (!isSalesZkNavPath(pathname)) return;

    const now = Date.now();
    if (now - lastNotatnikAutoRefreshAtRef.current < NOTATNIK_AUTO_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastNotatnikAutoRefreshAtRef.current = now;
    refreshNow();
  }, [effectiveEnabled, latest, baseline, pathname, refreshNow]);

  /** Moje zamówienia: po sync ZD w tle odśwież listę, gdy wersja aktywności się zmieni. */
  useEffect(() => {
    if (!effectiveEnabled || syncingRef.current) return;
    if (!latest || !baseline || latest === baseline) return;
    if (pathname !== "/moje") return;

    const now = Date.now();
    if (now - lastMojeAutoRefreshAtRef.current < MOJE_AUTO_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastMojeAutoRefreshAtRef.current = now;
    refreshNow();
  }, [effectiveEnabled, latest, baseline, pathname, refreshNow]);

  const hasUpdates = Boolean(
    effectiveEnabled && baseline && latest && latest !== baseline
  );

  return (
    <SalesUpdatesContext.Provider
      value={{
        hasUpdates,
        refreshNow,
        autoRefresh,
        setAutoRefresh,
        boardAnswerSound,
        setBoardAnswerSound,
        lastSyncedAt,
        lastPollAt,
      }}
    >
      {children}
    </SalesUpdatesContext.Provider>
  );
}

export function SalesUpdatesBanner() {
  const ctx = useSalesUpdates();
  const pathname = usePathname();
  if (!ctx?.hasUpdates || pathname === "/moje" || isSalesZkNavPath(pathname)) return null;

  const description =
    pathname === "/prosba"
      ? `${MICROCOPY.notices.updatesAvailable} Odśwież, aby zobaczyć aktualne statusy prośb.`
      : pathname === "/tablica"
        ? `${MICROCOPY.notices.updatesAvailable} Szczegóły prośb i terminów sprawdzisz w Moje zamówienia po odświeżeniu.`
        : pathname === "/plan"
          ? `${MICROCOPY.notices.updatesAvailable} Odśwież plan — statusy prośb są w Moje zamówienia.`
          : `${MICROCOPY.notices.updatesAvailable} Automatyczne odświeżanie włączysz w panelu synchronizacji na Moje zamówienia.`;

  return (
    <SystemNotice
      variant="action"
      className="mb-4 sm:mb-6"
      title="Są nowe informacje o zamówieniach"
      description={description}
      action={
        <Button type="button" size="sm" className="min-h-11 shrink-0" onClick={ctx.refreshNow}>
          {MICROCOPY.actions.refresh}
        </Button>
      }
    />
  );
}
