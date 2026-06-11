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
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { MICROCOPY } from "@/lib/ui/microcopy";

const POLL_MS = 45_000;
const AUTO_REFRESH_MS = 3 * 60_000;
const NOTATNIK_AUTO_REFRESH_COOLDOWN_MS = 15_000;
const STORAGE_KEY = "sales-auto-refresh";
const autoRefreshStore = createPersistedFlagStore(STORAGE_KEY);

import { isSalesZkNavPath } from "@/lib/sales/notepad-page-tabs";

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
  const autoRefresh = usePersistedFlag(autoRefreshStore);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() =>
    initialVersion != null ? Date.now() : null
  );
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const syncingRef = useRef(false);
  const lastNotatnikAutoRefreshAtRef = useRef(0);
  const versionKey = `${enabled}\0${initialVersion ?? ""}`;
  const [appliedVersionKey, setAppliedVersionKey] = useState("");
  if (enabled && initialVersion && versionKey !== appliedVersionKey) {
    setAppliedVersionKey(versionKey);
    setBaseline(initialVersion);
    setLatest(initialVersion);
  }

  const setAutoRefresh = useCallback((value: boolean) => {
    autoRefreshStore.setValue(value);
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
    const timer = window.setTimeout(() => {
      void poll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, poll, pathname]);

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
    if (!enabled || !autoRefresh || isSalesZkNavPath(pathname)) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (latest && baseline && latest !== baseline) {
        refreshNow();
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled, autoRefresh, latest, baseline, refreshNow, pathname]);

  /** Notatnik: odśwież widok od razu po wykryciu zmian (ZK, prośby). */
  useEffect(() => {
    if (!enabled || syncingRef.current) return;
    if (!latest || !baseline || latest === baseline) return;
    if (!isSalesZkNavPath(pathname)) return;

    const now = Date.now();
    if (now - lastNotatnikAutoRefreshAtRef.current < NOTATNIK_AUTO_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastNotatnikAutoRefreshAtRef.current = now;
    refreshNow();
  }, [enabled, latest, baseline, pathname, refreshNow]);

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
  if (!ctx?.hasUpdates || pathname === "/moje" || isSalesZkNavPath(pathname)) return null;

  return (
    <SystemNotice
      variant="action"
      className="mb-4 sm:mb-6"
      title="Są nowe informacje o zamówieniach"
      description={`${MICROCOPY.notices.updatesAvailable} Automatyczne odświeżanie włączysz na stronie Moje zamówienia.`}
      action={
        <Button type="button" size="sm" className="min-h-11 shrink-0" onClick={ctx.refreshNow}>
          {MICROCOPY.actions.refresh}
        </Button>
      }
    />
  );
}
