"use client";

import { useSyncExternalStore } from "react";

/** true dopiero po mount na kliencie — bezpieczne przy Suspense / selective hydration. */
export function useClientHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
