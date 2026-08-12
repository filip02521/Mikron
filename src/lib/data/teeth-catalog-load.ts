import {
  fetchTeethProductInfo,
  fetchTeethProductTwIdSet,
  type TeethProductInfoEntry,
} from "@/lib/data/teeth-products";

export const TEETH_CATALOG_UNAVAILABLE_MESSAGE =
  "Katalog zębów jest chwilowo niedostępny — spróbuj ponownie.";

/** Fail-closed load katalogu zębów do walidacji zamówień. */
export async function loadTeethCatalogForValidation(): Promise<{
  twIdSet: Set<number>;
  infoByTwId: Map<number, TeethProductInfoEntry>;
  rows: TeethProductInfoEntry[];
}> {
  try {
    const [twIdSet, rows] = await Promise.all([
      fetchTeethProductTwIdSet(),
      fetchTeethProductInfo(),
    ]);
    return {
      twIdSet,
      rows,
      infoByTwId: new Map(rows.map((row) => [row.twId, row])),
    };
  } catch {
    throw new Error(TEETH_CATALOG_UNAVAILABLE_MESSAGE);
  }
}
