/**
 * Ilość składnika na 1 zestaw (sztuki) — wspólne dla UI i walidacji zapisu.
 */

export const ZD_BOM_COMPONENT_QTY_MIN = 1;
export const ZD_BOM_COMPONENT_QTY_MAX = 100_000;

/** UI / seed: puste lub złe → 1, powyżej limitu → max. */
export function normalizeZdBomComponentQty(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < ZD_BOM_COMPONENT_QTY_MIN) {
    return ZD_BOM_COMPONENT_QTY_MIN;
  }
  return Math.min(n, ZD_BOM_COMPONENT_QTY_MAX);
}

/** Serwer: tylko poprawna liczba całkowita w limicie. */
export function parseZdBomComponentQtyOrNull(raw: unknown): number | null {
  const n = Math.trunc(Number(raw));
  if (
    !Number.isFinite(n) ||
    n < ZD_BOM_COMPONENT_QTY_MIN ||
    n > ZD_BOM_COMPONENT_QTY_MAX
  ) {
    return null;
  }
  return n;
}

export function formatZdBomComponentQtyLabel(qty: number): string {
  const n = normalizeZdBomComponentQty(qty);
  return n === 1 ? "1 szt." : `${n} szt.`;
}

/**
 * Startowe ilości w trybie seed (zaznaczenie z listy).
 * `previous` zachowuje wartości przy zmianie roli zestaw/składnik (ten sam twId).
 */
export function buildZdBomSeedQtyMap(
  productTwIds: readonly number[],
  previous?: Readonly<Record<number, string>>
): Record<number, string> {
  const next: Record<number, string> = {};
  for (const twId of productTwIds) {
    const keep = previous?.[twId];
    next[twId] =
      keep != null && String(keep).trim() !== ""
        ? String(normalizeZdBomComponentQty(keep))
        : "1";
  }
  return next;
}
