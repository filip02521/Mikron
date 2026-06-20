import { searchSubiektZdCached } from "@/lib/subiekt/subiekt-runtime-cache";
import {
  sortZdCandidatesForPlacementMatch,
  type ZdDateCandidate,
} from "@/lib/subiekt/zd-placement-sort";
import type { SubiektDocument } from "@/lib/subiekt/types";

export type BrowseZdDocumentsOptions = {
  khIds: readonly number[];
  dataOd: string;
  /** Górna granica daty wystawienia (YYYY-MM-DD) — wyklucza nowsze wpisy. */
  dataDo?: string;
  /** Okna miesięczne — przeglądanie po kolei (stare zgłoszenia); ma pierwszeństwo przed szerokim dataDo. */
  monthChunks?: readonly { dataOd: string; dataDo: string }[];
  pageSize?: number;
  maxPagesPerKh?: number;
  maxDocsToFetch: number;
  skipDocIds?: ReadonlySet<number>;
  loadDoc: (dokId: number) => Promise<SubiektDocument | null>;
  shouldStop?: () => boolean;
  /** Zatrzymaj po pierwszym dokumencie spełniającym warunek (np. dopasowanie do prośby). */
  matchDoc?: (doc: SubiektDocument) => boolean;
  /** Preferuj ZD wystawione blisko tej daty (np. data zamówienia). */
  preferIssueDateNear?: string;
};

export type BrowseZdDocumentsResult = {
  docs: SubiektDocument[];
  listedCount: number;
  fetched: number;
  stoppedEarly: boolean;
  matched?: SubiektDocument | null;
};

type ListedZd = ZdDateCandidate;

function docIssueDateKey(doc: { dok_DataWyst?: string | null }): string {
  return (doc.dok_DataWyst ?? "").slice(0, 10);
}

function isWithinDateWindow(
  issueDate: string,
  dataOd: string,
  dataDo?: string
): boolean {
  if (!issueDate) return true;
  if (issueDate < dataOd) return false;
  if (dataDo && issueDate >= dataDo) return false;
  return true;
}

function sortListingsByPlacementProximity(
  listings: ListedZd[],
  placementDate?: string
): ListedZd[] {
  return sortZdCandidatesForPlacementMatch(listings, placementDate);
}

function resolveBrowseDateChunks(
  options: BrowseZdDocumentsOptions
): { dataOd: string; dataDo?: string }[] {
  if (options.monthChunks?.length) {
    return options.monthChunks.map((chunk) => ({
      dataOd: chunk.dataOd,
      dataDo: chunk.dataDo,
    }));
  }
  return [{ dataOd: options.dataOd, dataDo: options.dataDo }];
}

async function collectZdListings(
  options: BrowseZdDocumentsOptions,
  scopedKhIds: number[],
  pageSize: number,
  maxPagesPerKh: number,
  skip: ReadonlySet<number>,
  seen: Set<number>
): Promise<{ listings: ListedZd[]; listedCount: number; stoppedEarly: boolean }> {
  const listings: ListedZd[] = [];
  let listedCount = 0;
  let stoppedEarly = false;

  outer: for (const khId of scopedKhIds) {
    for (let page = 1; page <= maxPagesPerKh; page++) {
      if (options.shouldStop?.()) {
        stoppedEarly = true;
        break outer;
      }

      const list = await searchSubiektZdCached({
        khId,
        dataOd: options.dataOd,
        dataDo: options.dataDo,
        page,
        pageSize,
      });

      const rows = list.data ?? [];
      listedCount += rows.length;
      if (!rows.length) break;

      for (const item of rows) {
        const id = Math.trunc(Number(item.dok_Id));
        if (!Number.isFinite(id) || id <= 0 || seen.has(id) || skip.has(id)) continue;

        const issueDate = (item.dok_DataWyst ?? "").slice(0, 10);
        if (!isWithinDateWindow(issueDate, options.dataOd, options.dataDo)) continue;

        seen.add(id);
        listings.push({ id, issueDate });
      }

      if (rows.length < pageSize) break;
    }
  }

  return { listings, listedCount, stoppedEarly };
}

function findMatchedDocFromLoaded(
  matchDoc: (doc: SubiektDocument) => boolean,
  docs: SubiektDocument[]
): SubiektDocument | null {
  for (const doc of docs) {
    if (matchDoc(doc)) return doc;
  }
  return null;
}

async function loadListedZdDocuments(
  options: BrowseZdDocumentsOptions,
  listings: ListedZd[]
): Promise<BrowseZdDocumentsResult> {
  const docs: SubiektDocument[] = [];
  let fetched = 0;
  let stoppedEarly = false;
  let matched: SubiektDocument | null = null;

  for (const item of listings) {
    if (options.shouldStop?.()) {
      stoppedEarly = true;
      break;
    }
    if (fetched >= options.maxDocsToFetch) {
      stoppedEarly = true;
      break;
    }

    const full = await options.loadDoc(item.id);
    if (!full) continue;
    fetched++;

    const fullDate = docIssueDateKey(full);
    if (!isWithinDateWindow(fullDate, options.dataOd, options.dataDo)) continue;

    docs.push(full);
    if (options.matchDoc?.(full)) {
      matched = full;
      break;
    }
  }

  return {
    docs,
    listedCount: listings.length,
    fetched,
    stoppedEarly,
    matched,
  };
}

/** Listuje ZD po kh_Id (bez wyszukiwania tekstowego) — działa gdy API search zwraca 0. */
export async function browseZdDocumentsForKhIds(
  options: BrowseZdDocumentsOptions
): Promise<BrowseZdDocumentsResult> {
  const scoped = [...new Set(options.khIds.map((id) => Math.trunc(id)).filter((id) => id > 0))];
  const pageSize = options.pageSize ?? 25;
  const maxPagesPerKh = options.maxPagesPerKh ?? 3;
  const skip = options.skipDocIds ?? new Set<number>();
  const seen = new Set<number>();

  if (!scoped.length || options.maxDocsToFetch <= 0) {
    return {
      docs: [],
      listedCount: 0,
      fetched: 0,
      stoppedEarly: true,
      matched: null,
    };
  }

  let listedCount = 0;
  let stoppedEarly = false;
  const docs: SubiektDocument[] = [];
  let fetched = 0;
  let matched: SubiektDocument | null = null;

  for (const chunk of resolveBrowseDateChunks(options)) {
    if (options.shouldStop?.()) {
      stoppedEarly = true;
      break;
    }
    if (fetched >= options.maxDocsToFetch) {
      stoppedEarly = true;
      break;
    }

    const remainingBudget = options.maxDocsToFetch - fetched;
    const collected = await collectZdListings(
      { ...options, dataOd: chunk.dataOd, dataDo: chunk.dataDo, maxDocsToFetch: remainingBudget },
      scoped,
      pageSize,
      maxPagesPerKh,
      skip,
      seen
    );
    listedCount += collected.listedCount;
    stoppedEarly = stoppedEarly || collected.stoppedEarly;

    const ordered = sortListingsByPlacementProximity(
      collected.listings,
      options.preferIssueDateNear
    );
    const loaded = await loadListedZdDocuments(
      {
        ...options,
        dataOd: chunk.dataOd,
        dataDo: chunk.dataDo,
        maxDocsToFetch: remainingBudget,
      },
      ordered
    );
    fetched += loaded.fetched;
    docs.push(...loaded.docs);
    stoppedEarly = stoppedEarly || loaded.stoppedEarly;

    if (options.matchDoc) {
      matched = findMatchedDocFromLoaded(options.matchDoc, docs);
      if (matched) break;
    } else if (loaded.matched) {
      matched = loaded.matched;
      break;
    }

    if (fetched >= options.maxDocsToFetch) {
      stoppedEarly = true;
      break;
    }
  }

  return {
    docs,
    listedCount,
    fetched,
    stoppedEarly,
    matched,
  };
}
