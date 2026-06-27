"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_APP_SHELL_METRICS,
  type AppShellMetrics,
  type AppShellNavBadges,
} from "@/lib/layout/app-shell-metrics-types";

type AppShellMetricsContextValue = {
  metrics: AppShellMetrics;
  setMetrics: React.Dispatch<React.SetStateAction<AppShellMetrics>>;
};

const AppShellMetricsContext = createContext<AppShellMetricsContextValue | null>(
  null
);

export function AppShellMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState(EMPTY_APP_SHELL_METRICS);
  const value = useMemo(
    () => ({ metrics, setMetrics }),
    [metrics]
  );
  return (
    <AppShellMetricsContext.Provider value={value}>
      {children}
    </AppShellMetricsContext.Provider>
  );
}

export function useAppShellMetrics(): AppShellMetrics {
  const ctx = useContext(AppShellMetricsContext);
  return ctx?.metrics ?? EMPTY_APP_SHELL_METRICS;
}

export function usePatchAppShellNavBadges(): (patch: Partial<AppShellNavBadges>) => void {
  const setMetrics = useContext(AppShellMetricsContext)?.setMetrics;
  return useCallback(
    (patch: Partial<AppShellNavBadges>) => {
      setMetrics?.((current) => ({
        ...current,
        navBadges: { ...current.navBadges, ...patch },
      }));
    },
    [setMetrics]
  );
}

export function AppShellMetricsSync({ payload }: { payload: AppShellMetrics }) {
  const setMetrics = useContext(AppShellMetricsContext)?.setMetrics;
  useLayoutEffect(() => {
    setMetrics?.(payload);
  }, [setMetrics, payload]);
  return null;
}
