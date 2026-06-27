/** Towary z listy zębów — bez kontroli stanu magazynowego przy prośbie o zamówienie. */

export function toStockExemptTwIdSet(
  ids: readonly number[] | ReadonlySet<number> | undefined
): ReadonlySet<number> | undefined {
  if (!ids) return undefined;
  if (ids instanceof Set) return ids.size ? ids : undefined;
  if (Array.isArray(ids)) {
    if (!ids.length) return undefined;
    return new Set(ids.map((id) => Math.trunc(id)));
  }
  return undefined;
}

export function isStockExemptTwId(
  subiektTwId: number | null | undefined,
  exemptTwIds?: ReadonlySet<number>
): boolean {
  if (!exemptTwIds?.size || subiektTwId == null || subiektTwId <= 0) return false;
  return exemptTwIds.has(Math.trunc(subiektTwId));
}
