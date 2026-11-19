/**
 * Zgłoszenia „brak na stanie”: odczyt aktywnych i zamknięcie po zamówieniu towaru.
 * Zamknięcie = to samo co ręczne „Już zamówione” w panelu dziennym (status Zamówione, bez próbki czasu dostawy).
 */

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/pool";
import type { ProsbaIncomingZdDoc } from "@/lib/orders/prosba-already-ordered";
import {
  stockOutSignalsCoveredByZd,
  type ActiveStockOutSignal,
  type StockOutCoveredByZd,
} from "@/lib/orders/stock-out-signals";
import { loadZdPairMatchIndex } from "@/lib/orders/zd-product-pair-stock";
import { processIndividualFromSummary } from "@/lib/services/orders";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { searchSubiektZd } from "@/lib/subiekt/api";
import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { lineTowId } from "@/lib/subiekt/zd-document-line";
import { isActiveZdFulfillmentDocument } from "@/lib/subiekt/zd-fulfillment-date";
import { todayDateKeyInWarsaw, warsawDateKeyFromIso } from "@/lib/time/warsaw";

/** Starsze zgłoszenia nie szukają już ZD — zostają dla zakupów. */
const SWEEP_MAX_AGE_DAYS = 45;
const SWEEP_MAX_ZD_PAGES = 5;
const SUBIEKT_CONCURRENCY = 4;

type SignalRow = {
  id: string;
  subiekt_tw_id: number;
  created_at: Date | string;
  supplier_id: string | null;
  sales_person_name: string | null;
};

/**
 * Aktywne zgłoszenia z towarem z Subiekta. `statuses`: Kreator pokazuje też „Weryfikacja”,
 * automat zamyka tylko „Nowe” (tak jak ręczne „Już zamówione”).
 */
export async function loadActiveStockOutSignals(opts: {
  twIds?: readonly number[];
  statuses?: readonly ("Nowe" | "Weryfikacja")[];
  maxAgeDays?: number;
}): Promise<ActiveStockOutSignal[]> {
  const twIds = opts.twIds ? [...new Set(opts.twIds.map((n) => Math.trunc(n)).filter((n) => n > 0))] : null;
  if (twIds && !twIds.length) return [];
  const { rows } = await query<SignalRow>(
    `SELECT o.id, o.subiekt_tw_id, o.created_at, o.supplier_id, sp.name AS sales_person_name
       FROM public.individual_orders o
       LEFT JOIN public.sales_people sp ON sp.id = o.sales_person_id
      WHERE o.request_kind = 'informacja'
        AND o.informacja_stock_out_reorder = true
        AND o.status::text = ANY($1::text[])
        AND o.sales_cancelled_at IS NULL
        AND COALESCE(o.is_teeth, false) = false
        AND o.subiekt_tw_id > 0
        AND ($2::int[] IS NULL OR o.subiekt_tw_id = ANY($2::int[]))
        AND ($3::int IS NULL OR o.created_at > now() - ($3::int * interval '1 day'))
      ORDER BY o.created_at
      LIMIT 500`,
    [opts.statuses ?? ["Nowe", "Weryfikacja"], twIds, opts.maxAgeDays ?? null]
  );
  return rows.map((r) => ({
    orderId: r.id,
    twId: Number(r.subiekt_tw_id),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    salesPersonName: r.sales_person_name?.trim() || "Handlowiec",
    supplierId: r.supplier_id,
  }));
}

/** Dokument ZD widziany po obu kartach pary (opakowanie ↔ sztuka) — jak przy stanie i „w drodze”. */
async function withPairTwins(
  docsByTwId: Map<number, ProsbaIncomingZdDoc[]>
): Promise<Map<number, ProsbaIncomingZdDoc[]>> {
  const pairs = await loadZdPairMatchIndex().catch(() => new Map());
  if (!pairs.size) return docsByTwId;
  const out = new Map(docsByTwId);
  for (const [tw, docs] of docsByTwId) {
    const hit = pairs.get(tw);
    if (!hit) continue;
    for (const twin of [hit.pair.packTwId, hit.pair.pieceTwId]) {
      if (twin === tw) continue;
      out.set(twin, [...(out.get(twin) ?? []), ...docs]);
    }
  }
  return out;
}

async function closeCovered(
  signals: readonly ActiveStockOutSignal[],
  covered: readonly StockOutCoveredByZd[],
  actorEmail: string
): Promise<StockOutCoveredByZd[]> {
  const byId = new Map(signals.map((s) => [s.orderId, s]));
  const closed: StockOutCoveredByZd[] = [];
  for (const hit of covered) {
    const signal = byId.get(hit.orderId);
    if (!signal) continue;
    try {
      // Zgłoszenie bez dostawcy byłoby „niekompletne” — dostawca z ZD, które je pokryło.
      if (!signal.supplierId) {
        if (!hit.supplierId) continue;
        await query(
          `UPDATE public.individual_orders SET supplier_id = $2 WHERE id = $1 AND supplier_id IS NULL`,
          [hit.orderId, hit.supplierId]
        );
      }
      const res = await processIndividualFromSummary([hit.orderId], "JUZ_ZAMOWIONE", actorEmail, null, {
        skipSupplierSchedule: true,
      });
      if (res.processedIds.includes(hit.orderId)) closed.push(hit);
    } catch (e) {
      // Błąd po zapisie (np. kolejka synchronizacji terminu ZD) — status już zmieniony, liczymy jako zamknięte.
      const { rows } = await query<{ status: string }>(
        `SELECT status::text AS status FROM public.individual_orders WHERE id = $1`,
        [hit.orderId]
      ).catch(() => ({ rows: [] as { status: string }[] }));
      if (rows[0]?.status === "Zamowione") {
        closed.push(hit);
        continue;
      }
      // Jedno zgłoszenie (np. niekompletne dane) nie zatrzymuje pozostałych — zostaje do ręcznej decyzji.
      console.warn("[stock-out] auto-close skipped", hit.orderId, e instanceof Error ? e.message : e);
    }
  }
  if (closed.length) {
    try {
      revalidatePath("/podsumowanie");
    } catch {
      /* poza kontekstem żądania (skrypt) — panel odświeży się sam */
    }
  }
  return closed;
}

/** Kreator ZD: właśnie założony ZD zamyka zgłoszenia na swoje towary. */
export async function closeStockOutSignalsForCreatedZd(input: {
  twIds: readonly number[];
  dokNr: string;
  supplierId: string | null;
  actorEmail: string;
}): Promise<StockOutCoveredByZd[]> {
  const today = todayDateKeyInWarsaw();
  const doc: ProsbaIncomingZdDoc = {
    dokNr: input.dokNr,
    issued: today,
    deadline: null,
    qty: null,
    supplierId: input.supplierId,
  };
  const docs = await withPairTwins(new Map(input.twIds.map((tw) => [Math.trunc(tw), [doc]])));
  const signals = await loadActiveStockOutSignals({ twIds: [...docs.keys()], statuses: ["Nowe"] });
  if (!signals.length) return [];
  return closeCovered(signals, stockOutSignalsCoveredByZd(signals, docs), input.actorEmail);
}

/**
 * Cron: ZD założone w Subiekcie (także poza Kreatorem) od dnia najstarszego zgłoszenia.
 * Subiekt poza siecią albo błąd listy = nic nie zamykamy, kolejny przebieg spróbuje znowu.
 */
export async function sweepStockOutSignalsAgainstSubiektZd(actorEmail: string): Promise<{
  checkedSignals: number;
  checkedZd: number;
  closed: StockOutCoveredByZd[];
  skipped?: "no_signals" | "subiekt_offline";
}> {
  const signals = await loadActiveStockOutSignals({ statuses: ["Nowe"], maxAgeDays: SWEEP_MAX_AGE_DAYS });
  if (!signals.length) return { checkedSignals: 0, checkedZd: 0, closed: [], skipped: "no_signals" };
  if (!(await isSubiektReachable())) {
    return { checkedSignals: signals.length, checkedZd: 0, closed: [], skipped: "subiekt_offline" };
  }

  const dataOd = signals.map((s) => warsawDateKeyFromIso(s.createdAt)).sort()[0]!;
  const dokIds: number[] = [];
  for (let page = 1; page <= SWEEP_MAX_ZD_PAGES; page++) {
    const res = await searchSubiektZd({ dataOd, dataDo: todayDateKeyInWarsaw(), page, pageSize: 200 });
    for (const item of res.data) {
      const issued = item.dok_DataWyst ? String(item.dok_DataWyst).slice(0, 10) : "";
      if (issued >= dataOd && item.dok_Id) dokIds.push(Number(item.dok_Id));
    }
    if (!res.pagination || page >= res.pagination.totalPages) break;
  }

  const wanted = new Set(signals.map((s) => s.twId));
  const pairs = await loadZdPairMatchIndex().catch(() => new Map());
  for (const tw of [...wanted]) {
    const hit = pairs.get(tw);
    if (hit) {
      wanted.add(hit.pair.packTwId);
      wanted.add(hit.pair.pieceTwId);
    }
  }

  const docsByTwId = new Map<number, ProsbaIncomingZdDoc[]>();
  let next = 0;
  const worker = async () => {
    while (next < dokIds.length) {
      const id = dokIds[next++]!;
      const doc = await getSubiektZdDocumentCached(id).catch(() => null);
      if (!doc || !isActiveZdFulfillmentDocument(doc)) continue;
      const entry: ProsbaIncomingZdDoc = {
        dokNr: doc.dok_NrPelny?.trim() || `#${doc.dok_Id}`,
        issued: doc.dok_DataWyst ? String(doc.dok_DataWyst).slice(0, 10) : null,
        deadline: null,
        qty: null,
        supplierId: null,
      };
      for (const line of doc.dok_Pozycja ?? []) {
        const tw = lineTowId(line);
        if (tw == null || !wanted.has(tw)) continue;
        const list = docsByTwId.get(tw) ?? [];
        if (!list.includes(entry)) list.push(entry);
        docsByTwId.set(tw, list);
      }
    }
  };
  await Promise.all(Array.from({ length: SUBIEKT_CONCURRENCY }, worker));

  const covered = stockOutSignalsCoveredByZd(signals, await withPairTwins(docsByTwId));
  const closed = await closeCovered(signals, covered, actorEmail);
  return { checkedSignals: signals.length, checkedZd: dokIds.length, closed };
}
