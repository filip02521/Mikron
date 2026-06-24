"use client";

import { createContext, useContext, useMemo } from "react";

const TeethExemptContext = createContext<ReadonlySet<number>>(new Set());

export function TeethExemptProvider({
  twIds,
  children,
}: {
  twIds: number[];
  children: React.ReactNode;
}) {
  const set = useMemo(
    () => new Set(twIds.map((id) => Math.trunc(id)).filter((id) => id > 0)),
    [twIds]
  );
  return <TeethExemptContext.Provider value={set}>{children}</TeethExemptContext.Provider>;
}

export function useTeethExemptTwIds(): ReadonlySet<number> {
  return useContext(TeethExemptContext);
}
