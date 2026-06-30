"use client";

import { createContext, useContext, useMemo } from "react";
import type { TeethManufacturer, TeethKind, TeethProductLine } from "@/lib/teeth/teeth-catalog";

export type TeethProductInfo = {
  twIds: Set<number>;
  manufacturerByTwId: Map<number, TeethManufacturer | null>;
  productLineByTwId: Map<number, TeethProductLine | null>;
  kindByTwId: Map<number, TeethKind | null>;
};

const TeethExemptContext = createContext<TeethProductInfo>({
  twIds: new Set(),
  manufacturerByTwId: new Map(),
  productLineByTwId: new Map(),
  kindByTwId: new Map(),
});

export function TeethExemptProvider({
  teethProductInfo,
  children,
}: {
  teethProductInfo: {
    twId: number;
    manufacturer: string | null;
    productLine?: string | null;
    kind?: string | null;
  }[];
  children: React.ReactNode;
}) {
  const info = useMemo<TeethProductInfo>(() => {
    const twIds = new Set<number>();
    const manufacturerByTwId = new Map<number, TeethManufacturer | null>();
    const productLineByTwId = new Map<number, TeethProductLine | null>();
    const kindByTwId = new Map<number, TeethKind | null>();
    for (const entry of teethProductInfo) {
      const id = Math.trunc(entry.twId);
      if (id <= 0) continue;
      twIds.add(id);
      manufacturerByTwId.set(
        id,
        (entry.manufacturer as TeethManufacturer | null) ?? null,
      );
      productLineByTwId.set(
        id,
        (entry.productLine as TeethProductLine | null) ?? null,
      );
      kindByTwId.set(
        id,
        (entry.kind as TeethKind | null) ?? null,
      );
    }
    return { twIds, manufacturerByTwId, productLineByTwId, kindByTwId };
  }, [teethProductInfo]);

  return <TeethExemptContext.Provider value={info}>{children}</TeethExemptContext.Provider>;
}

export function useTeethExemptTwIds(): ReadonlySet<number> {
  return useContext(TeethExemptContext).twIds;
}

export function useTeethProductInfo(): TeethProductInfo {
  return useContext(TeethExemptContext);
}
