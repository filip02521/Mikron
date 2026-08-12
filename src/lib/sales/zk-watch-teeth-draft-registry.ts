import type { TeethProductInfoEntry } from "@/lib/data/teeth-products";
import type { TeethDraftRegistryLookup } from "@/lib/sales/zk-watch-teeth-draft";
import {
  enrichTeethRegistryEntry,
  type TeethRegistryEntry,
} from "@/lib/teeth/teeth-dual-kind";
import type { TeethKind, TeethManufacturer, TeethProductLine } from "@/lib/teeth/teeth-catalog";

/** Registry lookup z wierszy `prosba_teeth_products` (server). */
export function buildTeethDraftRegistryFromProductInfo(
  rows: TeethProductInfoEntry[]
): TeethDraftRegistryLookup {
  const twIds = new Set<number>();
  const manufacturerByTwId = new Map<number, TeethManufacturer | null>();
  const productLineByTwId = new Map<number, TeethProductLine | null>();
  const kindByTwId = new Map<number, TeethKind | null>();
  const nameByTwId = new Map<number, string | null>();

  for (const row of rows) {
    const twId = Math.trunc(row.twId);
    if (twId <= 0) continue;
    const raw: TeethRegistryEntry = {
      twId,
      manufacturer: row.manufacturer,
      productLine: row.productLine,
      kind: row.kind,
      symbol: row.symbol ?? null,
      name: row.name ?? null,
      plu: row.plu ?? null,
    };
    const enriched = enrichTeethRegistryEntry(raw);
    twIds.add(twId);
    manufacturerByTwId.set(twId, enriched?.manufacturer ?? raw.manufacturer);
    productLineByTwId.set(twId, enriched?.productLine ?? raw.productLine);
    kindByTwId.set(twId, enriched?.kind ?? raw.kind);
    nameByTwId.set(twId, row.name ?? null);
  }

  return {
    twIds,
    manufacturerByTwId,
    productLineByTwId,
    kindByTwId,
    nameByTwId,
  };
}
