import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { PackagingLookup } from "@/lib/orders/zd-estimate-packaging";

export type ZdPackagingPairConflict = {
  twId: number;
  symbol: string;
  nazwa: string;
  packagingUnits: number;
  pairUnitsPerPack: number;
};

/**
 * Paczka w parze z opakowaniem innym niż unitsPerPack pary —
 * Create ZD mógłby wysłać złe jednostki dokumentu.
 */
export function collectZdPackagingPairConflicts(
  lines: readonly ManualZdEstimateLine[],
  packagingByTwId: ReadonlyMap<number, Pick<ZdEstimatePackagingRow, "unitsPerPackage"> | PackagingLookup>,
  /** Gdy podane — pomija wykluczone (nie blokuj Create przez pozycje poza ZD). */
  excludedTwIds?: ReadonlySet<number> | null
): ZdPackagingPairConflict[] {
  const out: ZdPackagingPairConflict[] = [];
  for (const line of lines) {
    if (excludedTwIds?.has(line.tw_Id)) continue;
    const pair = line.pair;
    if (!pair || pair.role !== "pack") continue;
    const pack = packagingByTwId.get(line.tw_Id);
    if (!pack) continue;
    const units = pack.unitsPerPackage;
    if (!(units >= 1)) continue;
    if (units === pair.unitsPerPack) continue;
    out.push({
      twId: line.tw_Id,
      symbol: line.tw_Symbol,
      nazwa: line.tw_Nazwa,
      packagingUnits: units,
      pairUnitsPerPack: pair.unitsPerPack,
    });
  }
  return out;
}

export function formatZdPackagingPairConflictHint(
  conflict: ZdPackagingPairConflict
): string {
  return `${conflict.symbol}: opakowanie ${conflict.packagingUnits} ≠ para ${conflict.pairUnitsPerPack}`;
}
