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

const POLL_MS = 45_000;
const AUTO_REFRESH_MS = 3 * 60_000;
const STORAGE_KEY = "sales-auto-refresh";

type SalesUpdatesContextValue = {
  hasUpdates: boolean;
  refreshNow: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
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
    void fetchVersion().then((v) => {
      if (v) syncBaseline(v);
      syncingRef.current = false;
    });
  }, [router, latest, syncBaseline]);

  const poll = useCallback(async () => {
    const v = await fetchVersion();
    if (v) setLatest(v);
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
      value={{ hasUpdates, refreshNow, autoRefresh, setAutoRefresh }}
    >
      {children}
    </SalesUpdatesContext.Provider>
  );
}

export function SalesUpdatesBanner() {
  const ctx = useSalesUpdates();
  if (!ctx?.hasUpdates) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-indigo-200/90 bg-[var(--primary-muted)] px-3 py-3 text-sm text-indigo-950 shadow-[var(--shadow-card)] sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-4"
    >
      <div>
        <p className="font-semibold">Są nowe informacje o zamówieniach</p>
        <p className="mt-0.5 text-xs text-indigo-800/90">
          Status, termin lub dostawa mogły się zmienić — odśwież widok, aby zobaczyć aktualny stan.
          Automatyczne odświeżanie włączysz na stronie Moje zamówienia.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={ctx.refreshNow}
          className="min-h-10 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Odśwież teraz
        </button>
      </div>
    </div>
  );
}
