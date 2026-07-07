"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { usePatchAppShellNavBadges } from "@/components/layout/AppShellMetricsContext";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { teethAutoRefreshStore as autoRefreshStore } from "@/lib/client/teeth-auto-refresh-store";

const POLL_MS = 25_000;
const INITIAL_POLL_DELAY_MS = 4_000;
const AUTO_REFRESH_MS = 3 * 60_000;

type TeethUpdatesContextValue = {
  hasUpdates: boolean;
  refreshNow: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  lastSyncedAt: number | null;
  lastPollAt: number | null;
};

const TeethUpdatesContext = createContext<TeethUpdatesContextValue | null>(
  null
);

export function useTeethUpdates() {
  return useContext(TeethUpdatesContext);
}

async function fetchTeethVersion(): Promise<{
  version: string | null;
  queueCount: number | null;
  verificationCount: number | null;
}> {
  try {
    const res = await fetch("/api/operations/teeth-panel-version", {
      cache: "no-store",
    });
    if (!res.ok) return { version: null, queueCount: null, verificationCount: null };
    const body = (await res.json()) as {
      version?: string;
      queueCount?: number;
      verificationCount?: number;
    };
    return {
      version: body.version ?? null,
      queueCount:
        typeof body.queueCount === "number" ? body.queueCount : null,
      verificationCount:
        typeof body.verificationCount === "number" ? body.verificationCount : null,
    };
  } catch {
    return { version: null, queueCount: null, verificationCount: null };
  }
}

export function TeethUpdatesProvider({
  children,
  initialVersion,
  enabled,
}: {
  children: React.ReactNode;
  initialVersion: string | null;
  enabled: boolean;
}) {
  const router = useRouter();
  const patchNavBadges = usePatchAppShellNavBadges();
  const [baseline, setBaseline] = useState(initialVersion);
  const [latest, setLatest] = useState(initialVersion);
  const autoRefresh = usePersistedFlag(autoRefreshStore);
  const syncingRef = useRef(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const versionKey = `${enabled}\0${initialVersion ?? ""}`;
  const [appliedVersionKey, setAppliedVersionKey] = useState(versionKey);

  if (enabled && initialVersion != null && versionKey !== appliedVersionKey) {
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
    void fetchTeethVersion()
      .then(({ version, queueCount, verificationCount }) => {
        if (version) syncBaseline(version);
        if (queueCount != null) patchNavBadges({ teethQueue: queueCount });
        if (verificationCount != null) patchNavBadges({ teethVerification: verificationCount });
        const now = Date.now();
        setLastSyncedAt(now);
        setLastPollAt(now);
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [router, latest, syncBaseline, patchNavBadges]);

  const poll = useCallback(async () => {
    const { version, queueCount, verificationCount } = await fetchTeethVersion();
    if (queueCount != null) patchNavBadges({ teethQueue: queueCount });
    if (verificationCount != null) patchNavBadges({ teethVerification: verificationCount });
    if (!version) return;
    const now = Date.now();
    setLatest(version);
    setLastPollAt(now);
    setBaseline((prev) => prev ?? version);
  }, [patchNavBadges]);

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
    <TeethUpdatesContext.Provider
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
    </TeethUpdatesContext.Provider>
  );
}

export function TeethUpdatesBanner() {
  const ctx = useTeethUpdates();
  const pathname = usePathname();
  if (!ctx?.hasUpdates || pathname.startsWith("/zeby")) return null;

  return (
    <SystemNotice
      variant="action"
      className="mb-4 sm:mb-6"
      title="Są nowe pozycje w panelu zębów"
      description={MICROCOPY.notices.teethUpdates}
      action={
        <Button type="button" size="sm" className="min-h-10 shrink-0" onClick={ctx.refreshNow}>
          {MICROCOPY.actions.refresh}
        </Button>
      }
    />
  );
}
