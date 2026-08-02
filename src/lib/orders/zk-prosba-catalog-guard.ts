import { hasAnyProductHint } from "@/lib/orders/request-completeness";

export const ZK_PROSBA_OFF_CATALOG_MESSAGE =
  "W prośbie powiązanej z ZK możesz wybrać tylko produkty z tego zamówienia klienta.";

export type ZkProsbaCatalogLine = {
  symbol?: string;
  mikranCode?: string;
  product?: string;
  subiektTwId?: number | null;
};

/** True gdy linia ma produkt, ale nie należy do allowlisty ZK. */
export function prosbaLineViolatesZkCatalog(
  line: ZkProsbaCatalogLine,
  allowedTwIds: ReadonlySet<number>
): boolean {
  if (allowedTwIds.size === 0) return false;
  if (
    !hasAnyProductHint({
      symbol: line.symbol,
      mikranCode: line.mikranCode,
      product: line.product,
    })
  ) {
    return false;
  }
  const twId =
    line.subiektTwId != null && Number.isFinite(Number(line.subiektTwId))
      ? Math.trunc(Number(line.subiektTwId))
      : null;
  return twId == null || twId <= 0 || !allowedTwIds.has(twId);
}

export function prosbaLinesViolateZkCatalog(
  lines: ZkProsbaCatalogLine[],
  allowedTwIds: ReadonlySet<number> | null | undefined
): boolean {
  if (!allowedTwIds || allowedTwIds.size === 0) return false;
  return lines.some((line) => prosbaLineViolatesZkCatalog(line, allowedTwIds));
}

/**
 * Pure assert — rzuca gdy któraś linia z produktem jest spoza ZK.
 * Pusta allowlista = brak twardej blokady.
 */
export function assertProsbaLinesBelongToZk(
  lines: ZkProsbaCatalogLine[],
  allowedTwIds: ReadonlySet<number> | null | undefined
): void {
  if (!allowedTwIds || allowedTwIds.size === 0) return;
  if (prosbaLinesViolateZkCatalog(lines, allowedTwIds)) {
    throw new Error(ZK_PROSBA_OFF_CATALOG_MESSAGE);
  }
}
