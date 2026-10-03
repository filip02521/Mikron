import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { SubiektRequestError } from "@/lib/subiekt/errors";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  listZdIndexPendingPriceHarvest,
  markZdIndexPriceHarvested,
  upsertProductPurchasePrices,
} from "@/lib/stock-watch/data";

export type ZdPriceLine = {
  subiektTwId: number;
  priceNet: number;
  dokId: number;
  dokNr: string | null;
  dokDate: string | null;
  khId: number | null;
};

/** Ceny netto z linii ZD (jednostka dokumentu). Pomija pozycje bez towaru / ceny. */
export function extractZdPriceLines(
  doc: SubiektDocument,
  fallback: { dokDate: string | null; khId: number | null }
): ZdPriceLine[] {
  const dokId = Math.trunc(Number(doc.dok_Id));
  if (!(dokId > 0)) return [];
  const dokDateRaw = String(doc.dok_DataWyst ?? "").slice(0, 10);
  const dokDate = /^\d{4}-\d{2}-\d{2}$/.test(dokDateRaw) ? dokDateRaw : fallback.dokDate;
  const byTw = new Map<number, ZdPriceLine>();
  for (const line of doc.dok_Pozycja ?? []) {
    const tw = Math.trunc(Number(line.ob_TowId));
    const price = Number(line.ob_CenaNetto);
    if (!(tw > 0) || !Number.isFinite(price) || price <= 0) continue;
    // Ten sam towar dwa razy na ZD — bierzemy wyższą cenę (bez rabatowych duplikatów w dół).
    const prev = byTw.get(tw);
    if (prev && prev.priceNet >= price) continue;
    byTw.set(tw, {
      subiektTwId: tw,
      priceNet: Math.round(price * 10000) / 10000,
      dokId,
      dokNr: doc.dok_NrPelny ?? null,
      dokDate,
      khId: fallback.khId,
    });
  }
  return [...byTw.values()];
}

/**
 * Jeden wiersz na towar — najnowszy dokument (data, potem dok_id).
 * Upsert z dwoma wierszami tego samego klucza w jednym INSERT rzuca błąd w Postgresie.
 */
export function newestPricePerProduct(lines: readonly ZdPriceLine[]): ZdPriceLine[] {
  const byTw = new Map<number, ZdPriceLine>();
  for (const line of lines) {
    const prev = byTw.get(line.subiektTwId);
    if (!prev) {
      byTw.set(line.subiektTwId, line);
      continue;
    }
    const a = `${line.dokDate ?? ""}|${String(line.dokId).padStart(12, "0")}`;
    const b = `${prev.dokDate ?? ""}|${String(prev.dokId).padStart(12, "0")}`;
    if (a > b) byTw.set(line.subiektTwId, line);
  }
  return [...byTw.values()];
}

/**
 * Dociąga ceny z ZD z lokalnego indeksu (sync katalogu), od najnowszych.
 * Ograniczone czasem — reszta w kolejnych nocach.
 */
export async function harvestZdPurchasePrices(input: {
  deadlineMs: number;
  batchSize?: number;
  concurrency?: number;
}): Promise<{ docsProcessed: number; pricesUpdated: number; docErrors: number }> {
  const batchSize = input.batchSize ?? 40;
  const concurrency = Math.max(1, input.concurrency ?? 3);
  let docsProcessed = 0;
  let pricesUpdated = 0;
  let docErrors = 0;

  while (Date.now() < input.deadlineMs) {
    const batch = await listZdIndexPendingPriceHarvest(batchSize);
    if (!batch.length) break;

    const done: number[] = [];
    const lines: ZdPriceLine[] = [];
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
      while (next < batch.length && Date.now() < input.deadlineMs) {
        const item = batch[next]!;
        next += 1;
        try {
          const doc = await getSubiektZdDocumentCached(item.dokId);
          lines.push(...extractZdPriceLines(doc, item));
          done.push(item.dokId);
        } catch (e) {
          // ZD usunięte w Subiekcie — nie wracaj do niego co noc.
          if (e instanceof SubiektRequestError && e.status === 404) {
            done.push(item.dokId);
          } else {
            docErrors += 1;
          }
        }
      }
    });
    await Promise.all(workers);

    pricesUpdated += await upsertProductPurchasePrices(newestPricePerProduct(lines));
    await markZdIndexPriceHarvested(done);
    docsProcessed += done.length;

    // Same błędy w porcji (Subiekt offline) — nie kręć się do końca budżetu.
    if (done.length === 0) break;
  }

  return { docsProcessed, pricesUpdated, docErrors };
}
