/**
 * Rozmiar strony = domyślny limit warstwy DB. Select bez .limit()/.range()
 * zwraca błąd OT_ROW_CAP, gdy wierszy jest więcej — całość czytaj tym helperem.
 */
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

/** {@link fetchAllRows} w kształcie odpowiedzi buildera — dla kodu, który rozgałęzia się po `error.message`. */
export async function fetchAllRowsResult<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<PageResult> }
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  try {
    return { data: await fetchAllRows<T>(build), error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
