import { useCallback, useEffect, useRef } from "react";
import { shouldPlaySoundOnCountIncrease } from "@/lib/client/board-questions-sound";
import {
  playPopNotificationSound,
  unlockNotificationSound,
} from "@/lib/client/notification-sound";

/** Globalne efekty dźwięku tablicy — działają na każdej stronie aplikacji. */
export function useBoardNotificationSoundEffects({
  enabled,
  soundEnabled,
  initialCount = 0,
  baselineReady = true,
  onCountApplied,
}: {
  enabled: boolean;
  soundEnabled: boolean;
  initialCount?: number;
  /** Gdy false — aktualizuj licznik bez dźwięku (np. zanim załadują się metryki SSR). */
  baselineReady?: boolean;
  onCountApplied?: (nextCount: number) => void;
}) {
  const countRef = useRef(initialCount);
  const pendingRef = useRef(false);
  const soundEnabledRef = useRef(soundEnabled);
  const baselineReadyRef = useRef(baselineReady);
  const onCountAppliedRef = useRef(onCountApplied);

  useEffect(() => {
    onCountAppliedRef.current = onCountApplied;
  }, [onCountApplied]);

  useEffect(() => {
    baselineReadyRef.current = baselineReady;
  }, [baselineReady]);

  useEffect(() => {
    countRef.current = initialCount;
  }, [initialCount]);

  const flushPending = useCallback(() => {
    if (!pendingRef.current || !soundEnabledRef.current) return;
    pendingRef.current = false;
    void playPopNotificationSound().then((played) => {
      if (!played) pendingRef.current = true;
    });
  }, []);

  const flushPendingRef = useRef(flushPending);
  useEffect(() => {
    flushPendingRef.current = flushPending;
  }, [flushPending]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (soundEnabled) flushPendingRef.current();
  }, [soundEnabled]);

  const applyCount = useCallback((nextCount: number | null) => {
    if (nextCount == null || !Number.isFinite(nextCount)) return;

    const previousCount = countRef.current;
    countRef.current = nextCount;
    onCountAppliedRef.current?.(nextCount);

    if (!baselineReadyRef.current) return;

    const increased = shouldPlaySoundOnCountIncrease(previousCount, nextCount);
    if (!increased || !soundEnabledRef.current) return;

    if (document.visibilityState !== "visible") {
      pendingRef.current = true;
      return;
    }

    void playPopNotificationSound().then((played) => {
      if (!played) pendingRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const unlock = () => {
      void unlockNotificationSound().then((ok) => {
        if (!ok) return;
        flushPendingRef.current();
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
      });
    };

    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);

    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        flushPendingRef.current();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);

  return { applyCount };
}
