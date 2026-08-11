/**
 * Filtrowanie wierszy GET /products/komplety do syncu zd_product_pairs.
 * v1: tylko komplety z dokładnie 1 składnikiem i całkowitą liczbą ≥ 2.
 */

export type KompletSyncRow = {
  kpl_Id: number;
  kompletTwId: number;
  skladnikTwId: number;
  liczba: number;
  kompletSymbol?: string | null;
  skladnikSymbol?: string | null;
};

export type FilterKompletyForPairSyncResult = {
  accepted: KompletSyncRow[];
  skipped: number;
  /** komplety z >1 składnikiem (świadomie pominięte). */
  skippedMultiComponent: number;
};

/**
 * Grupuje po kompletTwId — akceptuje tylko grupy z 1 składnikiem
 * i całkowitą `liczba` ≥ 2.
 */
export function filterKompletyForZdProductPairSync(
  rows: readonly KompletSyncRow[]
): FilterKompletyForPairSyncResult {
  const byPack = new Map<number, KompletSyncRow[]>();
  let skippedInvalid = 0;

  for (const row of rows) {
    const pack = Math.trunc(Number(row.kompletTwId));
    const piece = Math.trunc(Number(row.skladnikTwId));
    const liczba = Number(row.liczba);
    if (!(pack > 0) || !(piece > 0) || pack === piece) {
      skippedInvalid += 1;
      continue;
    }
    if (!(liczba >= 2) || Math.round(liczba) !== liczba) {
      skippedInvalid += 1;
      continue;
    }
    const list = byPack.get(pack) ?? [];
    list.push({
      ...row,
      kompletTwId: pack,
      skladnikTwId: piece,
      liczba: Math.trunc(liczba),
      kpl_Id: Math.trunc(Number(row.kpl_Id)) || 0,
    });
    byPack.set(pack, list);
  }

  const accepted: KompletSyncRow[] = [];
  let skippedMultiComponent = 0;
  for (const list of byPack.values()) {
    if (list.length !== 1) {
      skippedMultiComponent += list.length;
      continue;
    }
    accepted.push(list[0]!);
  }

  return {
    accepted,
    skipped: skippedInvalid + skippedMultiComponent,
    skippedMultiComponent,
  };
}
