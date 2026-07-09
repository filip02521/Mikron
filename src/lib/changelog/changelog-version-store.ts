"use client";

import { useSyncExternalStore } from "react";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";

const STORAGE_KEY = "changelog-seen-version";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function setSeenChangelogVersion(version: string) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
}

export function useSeenChangelogVersion(): string | null {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useClientHydrated();
  return hydrated ? stored : null;
}
