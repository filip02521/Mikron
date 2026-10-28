import { fetchSubiektZdEstimateZkPage } from "@/lib/subiekt/api";
import { fetchAllReservedZkRowsForTwId } from "@/lib/orders/zd-estimate-reservations";
import {
  reservedRowsToOverlapSlices,
  type ZdEstimateReservedOverlapSlice,
} from "@/lib/orders/zd-estimate-prosba-reservation-overlap";

const ZD_ESTIMATE_PROSBA_OVERLAP_CONCURRENCY = 6;
const ZD_ESTIMATE_PROSBA_OVERLAP_CACHE_MAX = 2000;

/**
 * Rezerwacje ZK per tw z ostatniego Policz. Create na dużym dostawcy (setki tw, popularne
 * towary z wieloma stronami ZK) pobierałby wszystko od nowa i przekraczał limit proxy.
 */
const reservedOverlapCache = new Map<number, { at: number; slices: ZdEstimateReservedOverlapSlice[] }>();

function cacheReservedOverlap(twId: number, slices: ZdEstimateReservedOverlapSlice[]) {
  reservedOverlapCache.delete(twId);
  reservedOverlapCache.set(twId, { at: Date.now(), slices });
  if (reservedOverlapCache.size > ZD_ESTIMATE_PROSBA_OVERLAP_CACHE_MAX) {
    const oldest = reservedOverlapCache.keys().next().value;
    if (oldest != null) reservedOverlapCache.delete(oldest);
  }
}

export async function fetchReservedOverlapSlicesByTwIds(
  twIds: readonly number[],
  opts?: {
    /** Użyj wpisów z cache młodszych niż tyle ms (brak = zawsze pobieraj). */
    cacheMaxAgeMs?: number;
    /** Po tym czasie (epoch ms) nie startujemy nowych pobrań — reszta = hadFetchErrors. */
    deadlineAt?: number;
  }
): Promise<{
  reservedByTwId: Map<number, ZdEstimateReservedOverlapSlice[]>;
  /** true gdy którykolwiek tw rzucił — nie cache'uj skip w UI. */
  hadFetchErrors: boolean;
}> {
  const unique = [
    ...new Set(
      twIds
        .map((id) => Math.trunc(Number(id)) || 0)
        .filter((id) => id > 0)
    ),
  ];

  const out = new Map<number, ZdEstimateReservedOverlapSlice[]>();
  if (!unique.length) {
    return { reservedByTwId: out, hadFetchErrors: false };
  }

  const maxAge = opts?.cacheMaxAgeMs ?? 0;
  const now = Date.now();
  const toFetch: number[] = [];
  for (const twId of unique) {
    const hit = maxAge > 0 ? reservedOverlapCache.get(twId) : undefined;
    if (hit && now - hit.at <= maxAge) {
      if (hit.slices.length) out.set(twId, hit.slices);
    } else {
      toFetch.push(twId);
    }
  }

  let hadFetchErrors = false;
  let next = 0;
  const worker = async () => {
    while (next < toFetch.length) {
      if (opts?.deadlineAt != null && Date.now() > opts.deadlineAt) {
        hadFetchErrors = true;
        return;
      }
      const twId = toFetch[next];
      next += 1;
      try {
        const deadlineAt = opts?.deadlineAt;
        const fetched = await fetchAllReservedZkRowsForTwId({
          twId,
          // Towar z wieloma stronami ZK nie może przeciągnąć budżetu — przerwany = błąd, bez cache.
          fetchPage:
            deadlineAt == null
              ? fetchSubiektZdEstimateZkPage
              : (args) => {
                  if (Date.now() > deadlineAt) throw new Error("zk_overlap_deadline");
                  return fetchSubiektZdEstimateZkPage(args);
                },
        });
        const slices = reservedRowsToOverlapSlices(fetched.rows);
        cacheReservedOverlap(twId, slices);
        if (slices.length) out.set(twId, slices);
      } catch {
        hadFetchErrors = true;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(ZD_ESTIMATE_PROSBA_OVERLAP_CONCURRENCY, toFetch.length) }, worker)
  );
  return { reservedByTwId: out, hadFetchErrors };
}

/** Testy: czysty cache między przypadkami. */
export function clearReservedOverlapCache() {
  reservedOverlapCache.clear();
}
