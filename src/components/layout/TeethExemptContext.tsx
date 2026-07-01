"use client";

import { createContext, useContext, useMemo } from "react";
import type { TeethManufacturer, TeethKind, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import {
  buildTeethRegistryIndex,
  enrichTeethRegistryEntry,
  supportsDualKindBuilder,
  type TeethRegistryIndex,
} from "@/lib/teeth/teeth-dual-kind";

export type TeethProductInfo = {
  twIds: Set<number>;
  manufacturerByTwId: Map<number, TeethManufacturer | null>;
  productLineByTwId: Map<number, TeethProductLine | null>;
  kindByTwId: Map<number, TeethKind | null>;
  registryIndex: TeethRegistryIndex;
};

const EMPTY_REGISTRY = buildTeethRegistryIndex([]);

const TeethExemptContext = createContext<TeethProductInfo>({
  twIds: new Set(),
  manufacturerByTwId: new Map(),
  productLineByTwId: new Map(),
  kindByTwId: new Map(),
  registryIndex: EMPTY_REGISTRY,
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
    symbol?: string | null;
    name?: string | null;
    plu?: string | null;
  }[];
  children: React.ReactNode;
}) {
  const info = useMemo<TeethProductInfo>(() => {
    const twIds = new Set<number>();
    const manufacturerByTwId = new Map<number, TeethManufacturer | null>();
    const productLineByTwId = new Map<number, TeethProductLine | null>();
    const kindByTwId = new Map<number, TeethKind | null>();
    const registryEntries = [];
    for (const entry of teethProductInfo) {
      const id = Math.trunc(entry.twId);
      if (id <= 0) continue;
      const raw = {
        twId: id,
        manufacturer: (entry.manufacturer as TeethManufacturer | null) ?? null,
        productLine: (entry.productLine as TeethProductLine | null) ?? null,
        kind: (entry.kind as TeethKind | null) ?? null,
        symbol: entry.symbol ?? null,
        name: entry.name ?? null,
        plu: entry.plu ?? null,
      };
      const enriched = enrichTeethRegistryEntry(raw);
      twIds.add(id);
      manufacturerByTwId.set(id, enriched?.manufacturer ?? raw.manufacturer);
      productLineByTwId.set(id, enriched?.productLine ?? raw.productLine);
      kindByTwId.set(id, enriched?.kind ?? raw.kind);
      registryEntries.push(raw);
    }
    return {
      twIds,
      manufacturerByTwId,
      productLineByTwId,
      kindByTwId,
      registryIndex: buildTeethRegistryIndex(registryEntries),
    };
  }, [teethProductInfo]);

  return <TeethExemptContext.Provider value={info}>{children}</TeethExemptContext.Provider>;
}

export function useTeethExemptTwIds(): ReadonlySet<number> {
  return useContext(TeethExemptContext).twIds;
}

export function useTeethProductInfo(): TeethProductInfo {
  return useContext(TeethExemptContext);
}

export function useSupportsDualKindBuilder(productLine: TeethProductLine | null | undefined): boolean {
  const { registryIndex } = useTeethProductInfo();
  if (!productLine) return false;
  return supportsDualKindBuilder(registryIndex, productLine);
}
