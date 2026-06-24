import { searchSubiektZdCachedForEta } from "@/lib/subiekt/subiekt-runtime-cache";
import { zdListItemMatchesSupplierKhIds } from "@/lib/subiekt/zd-document-kh";
import {
  shouldSkipZdListItemForEta,
  ZD_ETA_OPEN_DOCUMENT_STATUSES,
} from "@/lib/subiekt/zd-fulfillment-date";
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

type BrowseChunkScope = Pick<BrowseZdDocumentsOptions, "dataOd" | "dataDo" | "shouldStop">;

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

async function collectZdListingsForChunk(
  chunk: BrowseChunkScope,
  supplierKhIds: readonly number[],
  pageSize: number,
  maxPagesPerKh: number,
  skip: ReadonlySet<number>,
  seen: Set<number>,
  statusFilter?: number
): Promise<{ listings: ListedZd[]; listedCount: number; stoppedEarly: boolean }> {
  const listings: ListedZd[] = [];
  let listedCount = 0;
  let stoppedEarly = false;

  for (let page = 1; page <= maxPagesPerKh; page++) {
    if (chunk.shouldStop?.()) {
      stoppedEarly = true;
      break;
    }

    const list = await searchSubiektZdCachedForEta({
      dataOd: chunk.dataOd,
      dataDo: chunk.dataDo,
      page,
      pageSize,
      ...(statusFilter != null ? { status: statusFilter } : {}),
    });

    const rows = list.data ?? [];
    listedCount += rows.length;
    if (!rows.length) break;

    for (const item of rows) {
      if (shouldSkipZdListItemForEta(item)) continue;
      if (!zdListItemMatchesSupplierKhIds(item, supplierKhIds)) continue;
      const id = Math.trunc(Number(item.dok_Id));
      if (!Number.isFinite(id) || id <= 0 || seen.has(id) || skip.has(id)) continue;

      const issueDate = (item.dok_DataWyst ?? "").slice(0, 10);
      if (!isWithinDateWindow(issueDate, chunk.dataOd, chunk.dataDo)) continue;

      seen.add(id);
      listings.push({ id, issueDate });
    }

    if (rows.length < pageSize) break;
  }

  return { listings, listedCount, stoppedEarly };
}

/** Najpierw ZD z dok_Status 5/6/7 (filtr API), potem szerszy browse bez filtra statusu. */
async function collectZdListingsOpenThenBroad(
  chunk: BrowseChunkScope,
  supplierKhIds: readonly number[],
  pageSize: number,
  maxPagesPerKh: number,
  skip: ReadonlySet<number>,
  seen: Set<number>
): Promise<{ listings: ListedZd[]; listedCount: number; stoppedEarly: boolean }> {
  const listings: ListedZd[] = [];
  let listedCount = 0;
  let stoppedEarly = false;

  for (const status of ZD_ETA_OPEN_DOCUMENT_STATUSES) {
    if (chunk.shouldStop?.()) {
      stoppedEarly = true;
      break;
    }
    const phase = await collectZdListingsForChunk(
      chunk,
      supplierKhIds,
      pageSize,
      maxPagesPerKh,
      skip,
      seen,
      status
    );
    listings.push(...phase.listings);
    listedCount += phase.listedCount;
    stoppedEarly = stoppedEarly || phase.stoppedEarly;
  }

  if (!chunk.shouldStop?.()) {
    const broad = await collectZdListingsForChunk(
      chunk,
      supplierKhIds,
      pageSize,
      maxPagesPerKh,
      skip,
      seen
    );
    listings.push(...broad.listings);
    listedCount += broad.listedCount;
    stoppedEarly = stoppedEarly || broad.stoppedEarly;
  } else {
    stoppedEarly = true;
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
    if (shouldSkipZdListItemForEta(full)) continue;
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

async function browseChunkOpenThenBroad(
  options: BrowseZdDocumentsOptions,
  chunk: { dataOd: string; dataDo?: string },
  scopedKhIds: number[],
  pageSize: number,
  maxPagesPerKh: number,
  skip: ReadonlySet<number>,
  seen: Set<number>,
  remainingBudget: number
): Promise<{
  docs: SubiektDocument[];
  listedCount: number;
  fetched: number;
  stoppedEarly: boolean;
  matched: SubiektDocument | null;
}> {
  const chunkScope: BrowseChunkScope = {
    dataOd: chunk.dataOd,
    dataDo: chunk.dataDo,
    shouldStop: options.shouldStop,
  };
  const chunkOptions = {
    ...options,
    dataOd: chunk.dataOd,
    dataDo: chunk.dataDo,
  };

  const docs: SubiektDocument[] = [];
  let listedCount = 0;
  let fetched = 0;
  let stoppedEarly = false;
  let matched: SubiektDocument | null = null;

  const runPhase = async (statusFilter?: number) => {
    if (remainingBudget - fetched <= 0 || options.shouldStop?.()) {
      stoppedEarly = true;
      return;
    }

    const collected = await collectZdListingsForChunk(
      chunkScope,
      scopedKhIds,
      pageSize,
      maxPagesPerKh,
      skip,
      seen,
      statusFilter
    );
    listedCount += collected.listedCount;
    stoppedEarly = stoppedEarly || collected.stoppedEarly;

    const ordered = sortListingsByPlacementProximity(
      collected.listings,
      options.preferIssueDateNear
    );
    const loaded = await loadListedZdDocuments(
      { ...chunkOptions, maxDocsToFetch: remainingBudget - fetched },
      ordered
    );
    fetched += loaded.fetched;
    docs.push(...loaded.docs);
    stoppedEarly = stoppedEarly || loaded.stoppedEarly;

    if (options.matchDoc) {
      matched = findMatchedDocFromLoaded(options.matchDoc, docs);
    } else if (loaded.matched) {
      matched = loaded.matched;
    }
  };

  for (const status of ZD_ETA_OPEN_DOCUMENT_STATUSES) {
    if (matched || options.shouldStop?.() || fetched >= remainingBudget) break;
    await runPhase(status);
  }

  if (!matched && !options.shouldStop?.() && fetched < remainingBudget) {
    await runPhase();
  }

  return { docs, listedCount, fetched, stoppedEarly, matched };
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
    const chunkResult = await browseChunkOpenThenBroad(
      options,
      chunk,
      scoped,
      pageSize,
      maxPagesPerKh,
      skip,
      seen,
      remainingBudget
    );
    listedCount += chunkResult.listedCount;
    fetched += chunkResult.fetched;
    docs.push(...chunkResult.docs);
    stoppedEarly = stoppedEarly || chunkResult.stoppedEarly;
    matched = chunkResult.matched;

    if (matched) break;
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

/** Eksport testowy — kolejność listowania open → broad. */
export async function collectZdListingsForTests(
  options: BrowseZdDocumentsOptions,
  supplierKhIds: readonly number[],
  pageSize: number,
  maxPagesPerKh: number,
  skip: ReadonlySet<number>,
  seen: Set<number>
): Promise<{ listings: ListedZd[]; listedCount: number; stoppedEarly: boolean }> {
  return collectZdListingsOpenThenBroad(
    { dataOd: options.dataOd, dataDo: options.dataDo, shouldStop: options.shouldStop },
    supplierKhIds,
    pageSize,
    maxPagesPerKh,
    skip,
    seen
  );
}
