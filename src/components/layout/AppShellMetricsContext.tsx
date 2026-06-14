"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_APP_SHELL_METRICS,
  type AppShellMetrics,
} from "@/lib/layout/app-shell-metrics-types";

type AppShellMetricsContextValue = {
  metrics: AppShellMetrics;
  setMetrics: (metrics: AppShellMetrics) => void;
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

export function AppShellMetricsSync({ payload }: { payload: AppShellMetrics }) {
  const setMetrics = useContext(AppShellMetricsContext)?.setMetrics;
  useLayoutEffect(() => {
    setMetrics?.(payload);
  }, [setMetrics, payload]);
  return null;
}
