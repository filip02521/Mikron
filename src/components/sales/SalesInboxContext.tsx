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
import { useSearchParams } from "next/navigation";
import {
  snapshotActionWeight,
  type SalesDayStartSnapshot,
} from "@/lib/sales/sales-day-start";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { SalesInboxPanel } from "@/components/sales/SalesInboxPanel";

const POLL_MS = 45_000;
const INITIAL_POLL_DELAY_MS = 4_000;

type SalesInboxContextValue = {
  snapshot: SalesDayStartSnapshot | null;
  count: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  ringing: boolean;
  /** Inkrementowany przy każdym ring — restart CSS animation. */
  ringToken: number;
  visible: boolean;
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
  sessionSalesPersonId = null,
}: {
  children: ReactNode;
  initialSnapshot?: SalesDayStartSnapshot | null;
  enabled: boolean;
  /** Własny profil handlowca — ukryj inbox w podglądzie ?dla= innego handlowca. */
  sessionSalesPersonId?: string | null;
}) {
  const salesUpdates = useSalesUpdates();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla")?.trim() || null;
  const teamPreviewActive = Boolean(
    previewDla && sessionSalesPersonId && previewDla !== sessionSalesPersonId
  );
  const effectiveEnabled = enabled && !teamPreviewActive;

  const [snapshot, setSnapshot] = useState<SalesDayStartSnapshot | null>(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [ringToken, setRingToken] = useState(0);
  const prevCountRef = useRef(initialSnapshot?.totalActionCount ?? 0);
  const prevWeightRef = useRef(
    initialSnapshot ? snapshotActionWeight(initialSnapshot) : 0
  );
  const bootstrappedRef = useRef(Boolean(initialSnapshot));
  const ringingTimerRef = useRef<number | null>(null);

  const applySnapshot = useCallback((next: SalesDayStartSnapshot | null) => {
    if (!next) return;
    const prev = prevCountRef.current;
    const prevWeight = prevWeightRef.current;
    const nextCount = next.totalActionCount;
    const nextWeight = snapshotActionWeight(next);
    const shouldRing = !bootstrappedRef.current
      ? nextCount > 0
      : nextCount > prev || nextWeight > prevWeight;
    if (shouldRing) {
      setRingToken((token) => token + 1);
      setRinging(true);
      if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = window.setTimeout(() => setRinging(false), 1400);
    }
    prevCountRef.current = nextCount;
    prevWeightRef.current = nextWeight;
    setSnapshot(next);
    bootstrappedRef.current = true;
  }, []);

  const bootstrapSnapshot = useCallback((next: SalesDayStartSnapshot | null) => {
    if (!next) return;
    const nextCount = next.totalActionCount;
    prevCountRef.current = nextCount;
    prevWeightRef.current = snapshotActionWeight(next);
    setSnapshot(next);
    bootstrappedRef.current = true;
    if (nextCount > 0) {
      setRingToken((token) => token + 1);
      setRinging(true);
      if (ringingTimerRef.current) window.clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = window.setTimeout(() => setRinging(false), 1400);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!effectiveEnabled) return;
    const next = await fetchInboxSnapshot();
    applySnapshot(next);
  }, [applySnapshot, effectiveEnabled]);

  useEffect(() => {
    if (effectiveEnabled || !open) return;
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [effectiveEnabled, open]);

  useEffect(() => {
    if (!effectiveEnabled || !initialSnapshot) return;
    const id = window.setTimeout(() => bootstrapSnapshot(initialSnapshot), 0);
    return () => window.clearTimeout(id);
  }, [bootstrapSnapshot, effectiveEnabled, initialSnapshot]);

  useEffect(() => {
    if (!effectiveEnabled || !open) return;
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [effectiveEnabled, open, refresh]);

  useEffect(() => {
    if (!effectiveEnabled || !salesUpdates?.hasUpdates) return;
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [effectiveEnabled, refresh, salesUpdates?.hasUpdates]);

  useEffect(() => {
    if (!effectiveEnabled) return;
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
  }, [applySnapshot, effectiveEnabled]);

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
        ringToken,
        visible: effectiveEnabled,
      }}
    >
      {children}
      {effectiveEnabled ? <SalesInboxPanel open={open} onClose={() => setOpen(false)} /> : null}
    </SalesInboxContext.Provider>
  );
}
