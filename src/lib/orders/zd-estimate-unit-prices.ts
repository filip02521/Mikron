import { unitPricePerPiece, type StockWatchPackaging } from "@/lib/stock-watch/analysis";

/**
 * Ceny za sztukę do kolumny „Wartość” liczone z bieżących opakowań i par.
 * Serwer przelicza cenę ZD przy Policz, ale para/opakowanie zmienione potem w sesji
 * przeliczają ilości od razu — bez tego cena paczki (np. ×150) mnożyła się przez sztuki.
 * Brak surowej ceny (sesja sprzed zmiany) = cena z serwera.
 */
export function resolveZdEstimateUnitPrices(
  purchasePriceNetByTwId: Readonly<Record<number, number>> | null | undefined,
  serverUnitPriceByTwId: Readonly<Record<number, number>>,
  packagingLookup: ReadonlyMap<number, StockWatchPackaging>
): Record<number, number> {
  const raw = purchasePriceNetByTwId ?? {};
  const out: Record<number, number> = { ...serverUnitPriceByTwId };
  for (const [key, priceNet] of Object.entries(raw)) {
    const twId = Number(key);
    const perPiece = unitPricePerPiece(priceNet, packagingLookup.get(twId) ?? null);
    if (perPiece != null) out[twId] = perPiece;
    else delete out[twId];
  }
  return out;
}
