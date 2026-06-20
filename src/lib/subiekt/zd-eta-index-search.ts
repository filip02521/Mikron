import { createAdminClient } from "@/lib/supabase/admin";
import {
  zdPlacementBrowseMonthChunks,
  zdPlacementIssueDateInBrowseWindow,
  type ZdMonthBrowseChunk,
} from "@/lib/subiekt/zd-search-scope";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  sortZdCandidatesForPlacementMatch,
  type ZdDateCandidate,
} from "@/lib/subiekt/zd-placement-sort";

export type ZdIndexRow = {
  dok_id: number;
  dok_nr_pelny: string | null;
  dok_data_wyst: string | null;
};

export type FetchZdByDokIdsOptions = {
  candidates: readonly ZdDateCandidate[];
  preferIssueDateNear?: string;
  maxDocsToFetch: number;
  skipDocIds?: ReadonlySet<number>;
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>;
  shouldStop?: () => boolean;
  /** Pierwszy dokument spełniający warunek (legacy). */
  matchDoc?: (doc: SubiektDocument) => boolean;
  /** Najlepszy dokument spośród już pobranych (np. findBestMatchingZdDocument). */
  selectBestFromDocs?: (docs: SubiektDocument[]) => SubiektDocument | null;
  /** Przerwij wcześniej gdy selectBestFromDocs zwrócił trafienie. */
  shouldStopAfterBest?: (
    best: SubiektDocument,
    ctx: { docs: SubiektDocument[]; fetched: number; listedCount: number }
  ) => boolean;
};

export type FetchZdByDokIdsResult = {
  docs: SubiektDocument[];
  fetched: number;
  listedCount: number;
  stoppedEarly: boolean;
  matched: SubiektDocument | null;
};

/** Wiersze indeksu ZD dla kontrahentów — tylko metadane (dok_id), bez pełnych dokumentów. */
export async function loadZdIndexRowsForKhIds(
  khIds: readonly number[],
  limit: number,
  dataOd: string
): Promise<ZdIndexRow[]> {
  const scoped = [...new Set(khIds.map((id) => Math.trunc(id)).filter((id) => id > 0))];
  if (!scoped.length) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id, dok_nr_pelny, dok_data_wyst")
    .in("subiekt_kh_id", scoped)
    .gte("dok_data_wyst", dataOd)
    .order("dok_data_wyst", { ascending: false })
    .order("dok_id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Indeks ZD w oknach miesięcznych wokół zgłoszeń — bez biasu „top N najnowszych”. */
export async function loadZdIndexRowsForBrowseChunks(
  khIds: readonly number[],
  chunks: readonly ZdMonthBrowseChunk[],
  maxRows: number
): Promise<ZdIndexRow[]> {
  const scoped = [...new Set(khIds.map((id) => Math.trunc(id)).filter((id) => id > 0))];
  if (!scoped.length || !chunks.length || maxRows <= 0) return [];

  const supabase = createAdminClient();
  const seen = new Set<number>();
  const out: ZdIndexRow[] = [];
  const perChunkLimit = Math.max(40, Math.ceil(maxRows / chunks.length));

  for (const chunk of chunks) {
    if (out.length >= maxRows) break;
    const { data, error } = await supabase
      .from("subiekt_zd_index")
      .select("dok_id, dok_nr_pelny, dok_data_wyst")
      .in("subiekt_kh_id", scoped)
      .gte("dok_data_wyst", chunk.dataOd)
      .order("dok_data_wyst", { ascending: false })
      .order("dok_id", { ascending: false })
      .limit(Math.min(perChunkLimit * 2, maxRows - out.length + perChunkLimit));

    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const issueKey = (row.dok_data_wyst ?? "").slice(0, 10);
      if (issueKey && issueKey >= chunk.dataDo) continue;
      const id = Math.trunc(Number(row.dok_id));
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
      if (out.length >= maxRows) break;
    }
  }

  return out;
}

/** Łączy okna miesięczne wielu zgłoszeń dostawcy w jedną listę wierszy indeksu. */
export async function loadZdIndexRowsForPlacements(
  khIds: readonly number[],
  placements: readonly (string | null | undefined)[],
  at: Date,
  maxRows: number
): Promise<ZdIndexRow[]> {
  const chunkMap = new Map<string, ZdMonthBrowseChunk>();
  for (const placement of placements) {
    for (const chunk of zdPlacementBrowseMonthChunks(placement, at)) {
      chunkMap.set(`${chunk.dataOd}|${chunk.dataDo}`, chunk);
    }
  }
  const chunks = [...chunkMap.values()].sort((a, b) => a.dataOd.localeCompare(b.dataOd));
  if (!chunks.length) return [];
  return loadZdIndexRowsForBrowseChunks(khIds, chunks, maxRows);
}

/** Łączy okna miesięczne zgłoszeń z najnowszymi wierszami indeksu (initial pool). */
export async function loadZdIndexRowsForSupplierSync(
  khIds: readonly number[],
  placements: readonly (string | null | undefined)[],
  recentDataOd: string,
  at: Date,
  maxRows: number
): Promise<ZdIndexRow[]> {
  const placementCap = Math.ceil(maxRows * 0.7);
  const recentCap = Math.max(24, maxRows - placementCap);
  const [placementRows, recentRows] = await Promise.all([
    loadZdIndexRowsForPlacements(khIds, placements, at, placementCap),
    loadZdIndexRowsForKhIds(khIds, recentCap, recentDataOd),
  ]);

  const seen = new Set<number>();
  const out: ZdIndexRow[] = [];
  for (const row of [...placementRows, ...recentRows]) {
    const id = Math.trunc(Number(row.dok_id));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
    if (out.length >= maxRows) break;
  }
  return out;
}

export function zdIndexRowsToCandidates(rows: readonly ZdIndexRow[]): ZdDateCandidate[] {
  const seen = new Set<number>();
  const out: ZdDateCandidate[] = [];
  for (const row of rows) {
    const id = Math.trunc(Number(row.dok_id));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      issueDate: (row.dok_data_wyst ?? "").slice(0, 10),
    });
  }
  return out;
}

/** Wiersze indeksu w oknach miesięcznych wokół zgłoszenia. */
export function filterZdIndexRowsForPlacement(
  rows: readonly ZdIndexRow[],
  placementIso: string | null | undefined,
  at: Date = new Date()
): ZdIndexRow[] {
  if (!placementIso?.trim()) return [...rows];
  return rows.filter((row) =>
    zdPlacementIssueDateInBrowseWindow(row.dok_data_wyst, placementIso, at)
  );
}

/**
 * Pobiera pełne ZD po znanych dok_Id (z indeksu lub listy API) — bez stronicowania wszystkich ZD.
 */
export async function fetchZdDocsByDokIds(
  options: FetchZdByDokIdsOptions
): Promise<FetchZdByDokIdsResult> {
  const skip = options.skipDocIds ?? new Set<number>();
  const ordered = sortZdCandidatesForPlacementMatch(
    options.candidates.filter((c) => !skip.has(c.id)),
    options.preferIssueDateNear
  );

  const docs: SubiektDocument[] = [];
  let fetched = 0;
  let stoppedEarly = false;
  let matched: SubiektDocument | null = null;

  if (options.maxDocsToFetch <= 0) {
    return {
      docs,
      fetched: 0,
      listedCount: ordered.length,
      stoppedEarly: true,
      matched: null,
    };
  }

  for (const candidate of ordered) {
    if (options.shouldStop?.()) {
      stoppedEarly = true;
      break;
    }
    if (fetched >= options.maxDocsToFetch) {
      stoppedEarly = true;
      break;
    }

    const full = await options.loadDoc(candidate.id);
    if (!full) continue;
    fetched++;
    docs.push(full);

    if (options.selectBestFromDocs) {
      const best = options.selectBestFromDocs(docs);
      if (
        best &&
        options.shouldStopAfterBest?.(best, {
          docs,
          fetched,
          listedCount: ordered.length,
        })
      ) {
        matched = best;
        break;
      }
    } else if (options.matchDoc?.(full)) {
      matched = full;
      break;
    }
  }

  if (!matched && options.selectBestFromDocs && docs.length > 0) {
    matched = options.selectBestFromDocs(docs);
  }

  return {
    docs,
    fetched,
    listedCount: ordered.length,
    stoppedEarly,
    matched,
  };
}

export async function searchZdFromIndexForOrder(
  indexRows: readonly ZdIndexRow[],
  options: Omit<FetchZdByDokIdsOptions, "candidates">
): Promise<FetchZdByDokIdsResult> {
  return fetchZdDocsByDokIds({
    ...options,
    candidates: zdIndexRowsToCandidates(indexRows),
  });
}
