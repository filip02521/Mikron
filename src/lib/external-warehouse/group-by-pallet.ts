import type { ExternalWarehouseLineDto } from "@/lib/external-warehouse/lines";
import { comparePalletLabels } from "@/lib/external-warehouse/pallet-label-sort";

export type PalletGroup = {
  palletLabel: string | null;
  /** Wyświetlana etykieta grupy. */
  title: string;
  lines: ExternalWarehouseLineDto[];
};

const NO_PALLET_TITLE = "Bez palety";

export { comparePalletLabels };

/**
 * Grupuje linie wg etykiety palety.
 * Palety numerycznie / A–Z (locale pl), na końcu „Bez palety”.
 */
export function groupByPallet(lines: ExternalWarehouseLineDto[]): PalletGroup[] {
  const map = new Map<string | null, ExternalWarehouseLineDto[]>();

  for (const line of lines) {
    const key = line.palletLabel?.trim() || null;
    const bucket = map.get(key);
    if (bucket) bucket.push(line);
    else map.set(key, [line]);
  }

  const labeled = [...map.entries()]
    .filter(([k]) => k != null)
    .sort(([a], [b]) => comparePalletLabels(a as string, b as string))
    .map(([palletLabel, groupLines]) => ({
      palletLabel,
      title: palletLabel as string,
      lines: groupLines,
    }));

  const noPallet = map.get(null);
  if (noPallet?.length) {
    labeled.push({
      palletLabel: null,
      title: NO_PALLET_TITLE,
      lines: noPallet,
    });
  }

  return labeled;
}

/** Unikalne etykiety palet (posortowane) — do selecta. */
export function collectPalletLabels(
  lines: ExternalWarehouseLineDto[]
): string[] {
  const set = new Set<string>();
  for (const line of lines) {
    const label = line.palletLabel?.trim();
    if (label) set.add(label);
  }
  return [...set].sort(comparePalletLabels);
}
