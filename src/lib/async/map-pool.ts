/**
 * Ograniczona współbieżność z zachowaniem kolejności wyników (= kolejność `items`).
 * Bezpieczne do paginacji Subiekta: merge stron / SKU w stałej kolejności.
 *
 * Po pierwszym błędzie workery nie biorą kolejnych indeksów (mniej zbędnego I/O).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const concurrency = Math.max(1, Math.min(Math.trunc(limit) || 1, items.length));
  const out: R[] = new Array(items.length);
  let next = 0;
  let aborted: unknown = null;

  async function worker(): Promise<void> {
    while (true) {
      if (aborted != null) return;
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        out[index] = await fn(items[index]!, index);
      } catch (e) {
        aborted = e;
        throw e;
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } catch (e) {
    throw aborted ?? e;
  }
  if (aborted != null) throw aborted;
  return out;
}
