"use client";

import { useEffect, useState } from "react";

/** true dopiero po mount na kliencie — bezpieczne przy Suspense / selective hydration. */
export function useClientHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
