import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import {
  isPackagingPackagesMode,
  packagingDocumentMode,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";

export type ZdPackagingPairConflict = {
  twId: number;
  symbol: string;
  nazwa: string;
  packagingUnits: number;
  pairUnitsPerPack: number;
  /** Mode B na pack SKU — konflikt jednostek nawet gdy N == pair.N */
  reason: "units_mismatch" | "pieces_multiple_mode";
};

/**
 * Paczka w parze z opakowaniem innym niż unitsPerPack pary,
 * albo Mode B (pieces_multiple) na pack SKU —
 * Create ZD mógłby wysłać złe jednostki dokumentu.
 */
export function collectZdPackagingPairConflicts(
  lines: readonly ManualZdEstimateLine[],
  packagingByTwId: ReadonlyMap<
    number,
    | Pick<ZdEstimatePackagingRow, "unitsPerPackage" | "documentUnitMode">
    | PackagingLookup
  >,
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
    const mode = packagingDocumentMode(pack);
    if (!isPackagingPackagesMode(mode)) {
      out.push({
        twId: line.tw_Id,
        symbol: line.tw_Symbol,
        nazwa: line.tw_Nazwa,
        packagingUnits: units,
        pairUnitsPerPack: pair.unitsPerPack,
        reason: "pieces_multiple_mode",
      });
      continue;
    }
    if (units === pair.unitsPerPack) continue;
    out.push({
      twId: line.tw_Id,
      symbol: line.tw_Symbol,
      nazwa: line.tw_Nazwa,
      packagingUnits: units,
      pairUnitsPerPack: pair.unitsPerPack,
      reason: "units_mismatch",
    });
  }
  return out;
}

export function formatZdPackagingPairConflictHint(
  conflict: ZdPackagingPairConflict
): string {
  if (conflict.reason === "pieces_multiple_mode") {
    return `${conflict.symbol}: tryb „dobicie w sztukach” koliduje z parą (paczka)`;
  }
  return `${conflict.symbol}: opakowanie ${conflict.packagingUnits} ≠ para ${conflict.pairUnitsPerPack}`;
}
