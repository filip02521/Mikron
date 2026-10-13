import {
  PROSBA_ALREADY_ORDERED_MAX_TW_IDS,
  type ProsbaAlreadyOrderedInfo,
  type ProsbaAlreadyOrderedMap,
} from "@/lib/orders/prosba-already-ordered";

/** Krótko — prośby innych handlowców zmieniają się w ciągu dnia. */
const TTL_MS = 60_000;

type Entry = { at: number; info: ProsbaAlreadyOrderedInfo | null };

/** Per towar (nie per zestaw) — wysyłka czyta dowolny podzbiór bez nowego zapytania. */
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
/** Rośnie przy unieważnieniu — odpowiedź sprzed wysyłki nie wraca do cache. */
let epoch = 0;

/** „Moja prośba” zależy od tego, dla kogo jest formularz — klucz obejmuje handlowca. */
function k(forSalesPersonId: string | null, twId: number): string {
  return `${forSalesPersonId ?? "-"}:${twId}`;
}

function fresh(entry: Entry | undefined): entry is Entry {
  return entry != null && Date.now() - entry.at <= TTL_MS;
}

/**
 * Znane wyniki dla podanych towarów. `includeStale` — wysyłka: to samo, co pokazuje karta,
 * nawet po TTL (karta nie wygasa, potwierdzenie nie może jej przeczyć).
 */
export function readProsbaAlreadyOrderedCache(
  twIds: readonly number[],
  forSalesPersonId: string | null = null,
  includeStale = false
): ProsbaAlreadyOrderedMap {
  const out: ProsbaAlreadyOrderedMap = {};
  for (const id of twIds) {
    const entry = cache.get(k(forSalesPersonId, id));
    if (entry?.info && (includeStale || fresh(entry))) out[id] = entry.info;
  }
  return out;
}

/** Czy wynik dla towaru jest znany (także „nic nie znaleziono”). */
export function isProsbaAlreadyOrderedKnown(twId: number, forSalesPersonId: string | null = null): boolean {
  return fresh(cache.get(k(forSalesPersonId, twId)));
}

/** Towary bez świeżego wyniku i bez zapytania w toku. */
export function missingProsbaAlreadyOrderedTwIds(
  twIds: readonly number[],
  forSalesPersonId: string | null = null
): number[] {
  return twIds.filter(
    (id) => !fresh(cache.get(k(forSalesPersonId, id))) && !inflight.has(k(forSalesPersonId, id))
  );
}

/**
 * Pobiera brakujące towary (po maks. 30 w zapytaniu); równoległe wywołania dla tych samych
 * towarów czekają na to samo zapytanie. Błąd = brak podpowiedzi (best effort).
 */
export async function fetchProsbaAlreadyOrdered(
  twIds: readonly number[],
  fetcher: (twIds: number[], forSalesPersonId: string | null) => Promise<ProsbaAlreadyOrderedMap>,
  forSalesPersonId: string | null = null
): Promise<ProsbaAlreadyOrderedMap> {
  const allMissing = missingProsbaAlreadyOrderedTwIds(twIds, forSalesPersonId);
  // Serwer przyjmuje maks. N towarów — dłuższa lista (duży ZK) idzie w kilku zapytaniach.
  for (let i = 0; i < allMissing.length; i += PROSBA_ALREADY_ORDERED_MAX_TW_IDS) {
    const missing = allMissing.slice(i, i + PROSBA_ALREADY_ORDERED_MAX_TW_IDS);
    const started = epoch;
    const promise = fetcher(missing, forSalesPersonId)
      .then((map) => {
        if (epoch !== started) return;
        const at = Date.now();
        for (const id of missing) cache.set(k(forSalesPersonId, id), { at, info: map[id] ?? null });
      })
      .catch(() => {
        /* bez podpowiedzi — formularz działa dalej */
      })
      .finally(() => {
        for (const id of missing) {
          if (inflight.get(k(forSalesPersonId, id)) === promise) inflight.delete(k(forSalesPersonId, id));
        }
      });
    for (const id of missing) inflight.set(k(forSalesPersonId, id), promise);
  }
  await Promise.all(twIds.map((id) => inflight.get(k(forSalesPersonId, id))).filter(Boolean));
  return readProsbaAlreadyOrderedCache(twIds, forSalesPersonId);
}

/** Po wysłaniu prośby — kolejna prośba na ten sam towar musi zobaczyć tę właśnie wysłaną. */
export function invalidateProsbaAlreadyOrdered(twIds?: readonly number[]): void {
  epoch += 1;
  if (!twIds) {
    cache.clear();
    inflight.clear();
    return;
  }
  const ids = new Set(twIds);
  for (const map of [cache, inflight]) {
    for (const key of [...map.keys()]) {
      if (ids.has(Number(key.slice(key.lastIndexOf(":") + 1)))) map.delete(key);
    }
  }
}

/** Reset (testy). */
export function resetProsbaAlreadyOrderedCache(): void {
  cache.clear();
  inflight.clear();
}
