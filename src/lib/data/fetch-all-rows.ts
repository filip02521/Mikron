/** Rozmiar strony = domyślny limit warstwy DB; bez .range() wynik jest ucinany po cichu. */
export const FETCH_ALL_PAGE_SIZE = 1000;

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/**
 * Wszystkie wiersze tabeli, strona po stronie. `build` zwraca świeży builder
 * z tym samym filtrem i stabilnym sortowaniem (z unikalnym kluczem na końcu),
 * inaczej strony mogą się nakładać albo gubić wiersze.
 */
export async function fetchAllRows<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<PageResult> },
  pageSize: number = FETCH_ALL_PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await build().range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) return out;
  }
}
