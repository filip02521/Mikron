"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { SalesInboxPanel } from "@/components/sales/SalesInboxBell";

const POLL_MS = 45_000;
const INITIAL_POLL_DELAY_MS = 4_000;

type SalesInboxContextValue = {
  snapshot: SalesDayStartSnapshot | null;
  count: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  ringing: boolean;
};

const SalesInboxContext = createContext<SalesInboxContextValue | null>(null);

export function useSalesInbox() {
  return useContext(SalesInboxContext);
}

async function fetchInboxSnapshot(): Promise<SalesDayStartSnapshot | null> {
  try {
    const res = await fetch("/api/sales/inbox", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SalesDayStartSnapshot;
  } catch {
    return null;
  }
}

export function SalesInboxProvider({
  children,
  initialSnapshot = null,
  enabled,
}: {
  children: ReactNode;
  initialSnapshot?: SalesDayStartSnapshot | null;
  enabled: boolean;
}) {
  const salesUpdates = useSalesUpdates();
  const [snapshot, setSnapshot] = useState<SalesDayStartSnapshot | null>(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const prevCountRef = useRef(initialSnapshot?.totalActionCount ?? 0);
  const ringingTimerRef = useRef<number | null>(null);

  const applySnapshot = useCallback((next: SalesDayStartSnapshot | null) => {
    if (!next) return;
    const prev = prevCountRef.current;
    const nextCount = next.totalActionCount;
    if (nextCount > prev && prev >= 0) {
      setRinging(true);
      if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = window.setTimeout(() => setRinging(false), 1400);
    }
    prevCountRef.current = nextCount;
    setSnapshot(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const next = await fetchInboxSnapshot();
    applySnapshot(next);
  }, [applySnapshot, enabled]);

  useEffect(() => {
    if (!enabled || !initialSnapshot) return;
    const id = window.setTimeout(() => applySnapshot(initialSnapshot), 0);
    return () => window.clearTimeout(id);
  }, [applySnapshot, enabled, initialSnapshot]);

  useEffect(() => {
    if (!enabled || !open) return;
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [enabled, open, refresh]);

  useEffect(() => {
    if (!enabled || !salesUpdates?.hasUpdates) return;
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [enabled, refresh, salesUpdates?.hasUpdates]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let intervalId: number | null = null;

    const poll = async () => {
      const next = await fetchInboxSnapshot();
      if (!cancelled) applySnapshot(next);
    };

    const initialId = window.setTimeout(() => {
      void poll();
      intervalId = window.setInterval(() => void poll(), POLL_MS);
    }, INITIAL_POLL_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [applySnapshot, enabled]);

  useEffect(
    () => () => {
      if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
    },
    []
  );

  const count = snapshot?.totalActionCount ?? 0;

  return (
    <SalesInboxContext.Provider
      value={{
        snapshot,
        count,
        open,
        setOpen,
        refresh,
        ringing,
      }}
    >
      {children}
      {enabled ? <SalesInboxPanel open={open} onClose={() => setOpen(false)} /> : null}
    </SalesInboxContext.Provider>
  );
}
