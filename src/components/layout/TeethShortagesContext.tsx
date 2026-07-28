"use client";

import { createContext, useContext, useMemo } from "react";
import type { ActiveTeethShortageEntry } from "@/lib/data/teeth-shortages";
import type { TeethLineDetail, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import type { TeethShortageMatchHit } from "@/lib/teeth/teeth-shortage-match";
import { matchTeethShortagesForOrderLine } from "@/lib/teeth/teeth-shortage-ui";

const TeethShortagesContext = createContext<ActiveTeethShortageEntry[]>([]);

export function TeethShortagesProvider({
  shortages,
  children,
}: {
  shortages: ActiveTeethShortageEntry[];
  children: React.ReactNode;
}) {
  return (
    <TeethShortagesContext.Provider value={shortages}>
      {children}
    </TeethShortagesContext.Provider>
  );
}

export function useActiveTeethShortages(): ActiveTeethShortageEntry[] {
  return useContext(TeethShortagesContext);
}

/** Dopasowanie braków do pozycji prośby (obsługuje dual-kind). */
export function useTeethShortageHits(input: {
  productLine?: TeethProductLine | null;
  details?: TeethLineDetail[] | null;
  supplierId?: string | null;
  dualKindMode?: boolean;
}): TeethShortageMatchHit[] {
  const shortages = useActiveTeethShortages();
  const { productLine, details, supplierId, dualKindMode } = input;

  return useMemo(
    () =>
      matchTeethShortagesForOrderLine({
        productLine,
        details,
        shortages,
        supplierId,
        dualKindMode,
      }),
    [productLine, details, supplierId, dualKindMode, shortages],
  );
}
