"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { systemNoticePanelStripClass } from "@/lib/ui/ontime-theme";
import { MICROCOPY } from "@/lib/ui/microcopy";

const POLL_MS = 25_000;
const AUTO_REFRESH_MS = 3 * 60_000;
const FRESH_HIGHLIGHT_MS = 5_000;
const STORAGE_KEY = "operations-auto-refresh";

type OperationsUpdatesContextValue = {
  hasUpdates: boolean;
  refreshNow: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
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

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/operations/daily-panel-version", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  }
}

export function OperationsUpdatesProvider({
  children,
  initialVersion,
  enabled,
}: {
  children: React.ReactNode;
  initialVersion: string | null;
  enabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [baseline, setBaseline] = useState(initialVersion);
  const [latest, setLatest] = useState(initialVersion);
  const [autoRefresh, setAutoRefreshState] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() =>
    initialVersion != null ? Date.now() : null
  );
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [freshHighlightUntil, setFreshHighlightUntil] = useState(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    try {
      setAutoRefreshState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setAutoRefreshState(false);
    }
  }, []);

  const setAutoRefresh = useCallback((value: boolean) => {
    setAutoRefreshState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

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
      .then((v) => {
        if (v) syncBaseline(v);
        const now = Date.now();
        setLastSyncedAt(now);
        setLastPollAt(now);
        setRefreshGeneration((g) => g + 1);
        setFreshHighlightUntil(now + FRESH_HIGHLIGHT_MS);
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [router, latest, syncBaseline]);

  const poll = useCallback(async () => {
    const v = await fetchVersion();
    if (!v) return;
    const now = Date.now();
    setLatest(v);
    setLastPollAt(now);
    setBaseline((prev) => prev ?? v);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void poll();
  }, [enabled, poll, pathname]);

  useEffect(() => {
    if (!enabled || initialVersion == null) return;
    setBaseline(initialVersion);
    setLatest(initialVersion);
    setLastSyncedAt(Date.now());
  }, [enabled, initialVersion]);

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
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
