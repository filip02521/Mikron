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
import { salesUpdatesBannerClass } from "@/lib/ui/ontime-theme";

const POLL_MS = 45_000;
const AUTO_REFRESH_MS = 3 * 60_000;
const STORAGE_KEY = "sales-auto-refresh";

type SalesUpdatesContextValue = {
  hasUpdates: boolean;
  refreshNow: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  lastSyncedAt: number | null;
  lastPollAt: number | null;
};

const SalesUpdatesContext = createContext<SalesUpdatesContextValue | null>(null);

export function useSalesUpdates() {
  return useContext(SalesUpdatesContext);
}

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/sales/activity-version", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  }
}

export function SalesUpdatesProvider({
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
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void poll();
  }, [enabled, poll, pathname]);

  useEffect(() => {
    if (!enabled || !initialVersion) return;
    setBaseline(initialVersion);
    setLatest(initialVersion);
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
    <SalesUpdatesContext.Provider
      value={{
        hasUpdates,
        refreshNow,
        autoRefresh,
        setAutoRefresh,
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
  if (!ctx?.hasUpdates || pathname === "/moje") return null;

  return (
    <div role="status" className={salesUpdatesBannerClass}>
      <div>
        <p className="font-semibold">Są nowe informacje o zamówieniach</p>
        <p className="mt-0.5 text-xs text-indigo-800/90">
          Status, termin lub dostawa mogły się zmienić — odśwież widok, aby zobaczyć aktualny stan.
          Automatyczne odświeżanie włączysz na stronie Moje zamówienia.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="min-h-11 shrink-0" onClick={ctx.refreshNow}>
          Odśwież teraz
        </Button>
      </div>
    </div>
  );
}
