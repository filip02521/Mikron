import { query } from "@/lib/db/pool";
import { fetchSubiektZdEstimatePage } from "@/lib/subiekt/api";
import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { lineTowId } from "@/lib/subiekt/zd-document-line";
import {
  isActiveZdFulfillmentDocument,
  parseZdFulfillmentDeadline,
} from "@/lib/subiekt/zd-fulfillment-date";
import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
import { expandTwIdsWithPairTwins, loadZdPairMatchIndex } from "@/lib/orders/zd-product-pair-stock";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import type { ZdPairMatchIndex } from "@/lib/subiekt/match-order-to-zd";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import {
  PROSBA_ALREADY_ORDERED_MAX_TW_IDS,
  computeFreeIncoming,
  sortProsbaOwnRequests,
  type ProsbaAlreadyOrderedMap,
  type ProsbaIncoming,
  type ProsbaIncomingZdDoc,
  type ProsbaOwnRequestRef,
} from "@/lib/orders/prosba-already-ordered";
import type { IndividualOrderStatus } from "@/types/database";
import type { ZdPackagingDocumentUnitMode } from "@/lib/orders/zd-estimate-units";

/** Równoległe zapytania do Subiekta (kreator ZD dla jednego towaru, ~0,2 s każde). */
const SUBIEKT_CONCURRENCY = 4;
/** Cały odczyt Subiekta — po tym czasie podpowiedź bez danych „w drodze”, formularz nie czeka. */
const SUBIEKT_BUDGET_MS = 4_000;
/** Ile najnowszych ZD dostawcy sprawdzić, szukając numeru i terminu. */
const ZD_DOCS_PER_SUPPLIER = 4;
const ZD_DOCS_MAX_AGE_DAYS = 240;

type OwnRow = {
  id: string;
  subiekt_tw_id: number;
  status: IndividualOrderStatus;
  created_at: Date | string;
  ordered_at: Date | string | null;
  action_at: Date | string;
  quantity: string | null;
  delivered_quantity: string | null;
  supplier_name: string | null;
};

function iso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function positiveInt(v: string | null): number | null {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Promise z limitem czasu — po przekroczeniu zwraca `fallback`, zapytanie dobiega w tle. */
function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((r) => {
      timer = setTimeout(() => r(fallback), Math.max(0, ms));
    }),
  ]).finally(() => clearTimeout(timer));
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    })
  );
  return out;
}

/**
 * Własne otwarte prośby (dubel) + towar w drodze z Subiekta na żywo.
 * `ownSalesPersonId` = handlowiec, którego dotyczy formularz (już sprawdzony przez akcję);
 * null = nie sprawdzamy dubla (np. magazyn).
 */
export async function loadProsbaAlreadyOrdered(
  twIdsIn: readonly number[],
  ownSalesPersonId: string | null
): Promise<ProsbaAlreadyOrderedMap> {
  const twIds = [...new Set(twIdsIn.map((n) => Math.trunc(n)).filter((n) => n > 0))].slice(
    0,
    PROSBA_ALREADY_ORDERED_MAX_TW_IDS
  );
  if (twIds.length === 0) return {};

  const [own, incoming] = await Promise.all([
    loadOwnOpenRequests(twIds, ownSalesPersonId),
    loadIncoming(twIds).catch(() => new Map<number, ProsbaIncoming>()),
  ]);

  const out: ProsbaAlreadyOrderedMap = {};
  for (const twId of twIds) {
    const mine = own.get(twId) ?? [];
    const inc = incoming.get(twId) ?? null;
    // Także „0 w drodze” — karta pokaże wtedy pewne 0 zamiast „brak danych”.
    if (mine.length === 0 && !inc) continue;
    out[twId] = { own: sortProsbaOwnRequests(mine), incoming: inc };
  }
  return out;
}

/** Otwarte prośby TEGO handlowca na te towary — zamówienie, bez zębów, nie wycofane. */
async function loadOwnOpenRequests(
  twIds: readonly number[],
  salesPersonId: string | null
): Promise<Map<number, ProsbaOwnRequestRef[]>> {
  const out = new Map<number, ProsbaOwnRequestRef[]>();
  if (!salesPersonId) return out;
  const res = await query<OwnRow>(
    `SELECT o.id, o.subiekt_tw_id, o.status, o.created_at, o.ordered_at, o.action_at,
            o.quantity, o.delivered_quantity, s.name AS supplier_name
       FROM individual_orders o
       LEFT JOIN suppliers s ON s.id = o.supplier_id
      WHERE o.subiekt_tw_id = ANY($1::int[])
        AND o.sales_person_id = $2::uuid
        AND o.status IN ('Nowe', 'Weryfikacja', 'Zamowione', 'Czesciowo_zrealizowane')
        AND o.request_kind = 'zamowienie'
        AND o.sales_cancelled_at IS NULL
        AND COALESCE(o.is_teeth, false) = false
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [twIds, salesPersonId]
  );
  for (const row of res.rows) {
    const phase =
      row.status === "Czesciowo_zrealizowane" ? "partial" : row.status === "Zamowione" ? "ordered" : "pending";
    const list = out.get(row.subiekt_tw_id) ?? [];
    list.push({
      id: row.id,
      phase,
      createdAt: iso(row.created_at) ?? "",
      orderedAt: phase === "pending" ? null : iso(row.ordered_at) ?? iso(row.action_at),
      quantity: positiveInt(row.quantity),
      deliveredQuantity: positiveInt(row.delivered_quantity) ?? 0,
      supplierName: row.supplier_name,
    });
    out.set(row.subiekt_tw_id, list);
  }
  return out;
}

type Packaging = { unitsPerPackage: number; mode: ZdPackagingDocumentUnitMode };

/** Opakowania z kreatora ZD — Subiekt podaje otwarte ZD w jednostkach dokumentu. */
async function loadPackaging(twIds: readonly number[]): Promise<Map<number, Packaging>> {
  const res = await query<{ subiekt_tw_id: number; units_per_package: number; document_unit_mode: string | null }>(
    `SELECT subiekt_tw_id, units_per_package, document_unit_mode
       FROM zd_estimate_packaging WHERE subiekt_tw_id = ANY($1::int[])`,
    [twIds]
  ).catch(() => ({ rows: [] }));
  return new Map(
    res.rows.map((r) => [
      Number(r.subiekt_tw_id),
      {
        unitsPerPackage: num(r.units_per_package),
        mode: (r.document_unit_mode === "pieces_multiple" ? "pieces_multiple" : "packages") as ZdPackagingDocumentUnitMode,
      },
    ])
  );
}

/**
 * Subiekt na żywo: otwarte ZD, stan dostępny i ZK bez rezerwacji dla każdego towaru,
 * a dla towarów w drodze — numer i termin ZD z najnowszych dokumentów dostawcy.
 */
async function loadIncoming(twIds: readonly number[]): Promise<Map<number, ProsbaIncoming>> {
  const deadline = Date.now() + SUBIEKT_BUDGET_MS;
  const empty = new Map<number, ProsbaIncoming>();
  // Subiekt poza siecią — nie odpalaj zapytań, które i tak nie zdążą.
  if (!(await withBudget(isSubiektReachable(), SUBIEKT_BUDGET_MS, false))) return empty;

  const today = warsawTodayDateKey();
  // Pary opakowanie↔sztuka: ZD bywa na drugiej karcie — jak przy stanie magazynu.
  const pairs: ZdPairMatchIndex = await loadZdPairMatchIndex().catch(() => new Map());
  const fetchIds = expandTwIdsWithPairTwins(twIds, pairs);
  const packagingRows = await loadPackaging(fetchIds);
  // Opakowanie z pary: karta paczki zostaje w paczkach — mergePairIncoming mnoży przez N pary raz
  // (przeliczenie przez opakowanie N = ratio dawało ratio² sztuk „w drodze”).
  const packaging = new Map(
    [...packagingRows].filter(([twId]) => pairs.get(twId)?.role !== "pack")
  );

  const rows = await withBudget(
    mapLimit(fetchIds, SUBIEKT_CONCURRENCY, async (twId) => {
      try {
        const page = await fetchSubiektZdEstimatePage({
          towarId: twId,
          dataOd: today,
          dataDo: today,
          dniZapasu: 0,
          page: 1,
          pageSize: 5,
        });
        return page.data.pozycje.find((p) => Number(p.tw_Id) === twId) ?? null;
      } catch {
        return null;
      }
    }),
    deadline - Date.now(),
    null
  );
  if (!rows) return empty;

  const raw = new Map<number, ProsbaIncoming>();
  rows.forEach((line, i) => {
    if (!line) return;
    const twId = fetchIds[i]!;
    const pack = packaging.get(twId);
    const incoming = zdDocumentUnitsToPieces(num(line.otwarteZd), pack?.unitsPerPackage, pack?.mode);
    const available = num(line.dostepne);
    const zkWaiting = Math.max(0, num(line.otwarteZkBezRez));
    raw.set(twId, {
      incoming,
      available,
      zkWaiting,
      freeIncoming: computeFreeIncoming({ incoming, available, zkWaiting }),
      docs: [],
    });
  });

  // Numery i terminy ZD osobno — wolne dokumenty nie kasują już pobranych ilości.
  const withIncoming = [...raw.entries()].filter(([, v]) => v.incoming > 0).map(([id]) => id);
  if (withIncoming.length > 0) {
    const docs = await withBudget(
      loadIncomingDocs(withIncoming, packaging).catch(() => new Map<number, ProsbaIncomingZdDoc[]>()),
      deadline - Date.now(),
      new Map<number, ProsbaIncomingZdDoc[]>()
    );
    for (const [twId, list] of docs) {
      const entry = raw.get(twId);
      if (entry) entry.docs = list;
    }
  }

  const out = new Map<number, ProsbaIncoming>();
  for (const twId of twIds) {
    const merged = pairs.has(twId) ? mergePairIncoming(twId, raw, pairs) : raw.get(twId);
    if (!merged) continue;
    out.set(twId, { ...merged, docs: sortIncomingDocs(merged.docs, today) });
  }
  return out;
}

/** Obie karty pary w jednostkach karty z prośby (sztuki lub całe opakowania). */
function mergePairIncoming(
  twId: number,
  raw: Map<number, ProsbaIncoming>,
  pairs: ZdPairMatchIndex
): ProsbaIncoming | undefined {
  const hit = pairs.get(twId)!;
  const piece = raw.get(hit.pair.pieceTwId);
  const pack = raw.get(hit.pair.packTwId);
  if (!piece && !pack) return raw.get(twId);
  const ratio = hit.pair.unitsPerPack;
  const toRole = (pieces: number) => (hit.role === "piece" ? pieces : Math.floor(pieces / ratio));
  const sum = (k: "incoming" | "available" | "zkWaiting") =>
    toRole(num(piece?.[k]) + num(pack?.[k]) * ratio);
  const incoming = sum("incoming");
  const available = sum("available");
  const zkWaiting = sum("zkWaiting");
  const byDoc = new Map<string, ProsbaIncomingZdDoc>();
  const addDocs = (list: ProsbaIncomingZdDoc[] | undefined, factor: number) => {
    for (const d of list ?? []) {
      const prev = byDoc.get(d.dokNr);
      const qty = d.qty == null ? null : d.qty * factor;
      const total = prev && prev.qty != null && qty != null ? prev.qty + qty : (prev?.qty ?? qty);
      byDoc.set(d.dokNr, prev ? { ...prev, qty: total } : { ...d, qty });
    }
  };
  addDocs(piece?.docs, 1);
  addDocs(pack?.docs, ratio);
  const docs = [...byDoc.values()].map((d) => ({ ...d, qty: d.qty == null ? null : toRole(d.qty) }));
  return { incoming, available, zkWaiting, freeIncoming: computeFreeIncoming({ incoming, available, zkWaiting }), docs };
}

/** Najbliższy przyszły termin najpierw; spóźnione (termin minął) za nimi. Maks. 2. */
function sortIncomingDocs(list: ProsbaIncomingZdDoc[], today: string): ProsbaIncomingZdDoc[] {
  return [...list]
    .sort((a, b) => {
      const ka = a.deadline ?? "9999";
      const kb = b.deadline ?? "9999";
      const fa = ka >= today ? 0 : 1;
      const fb = kb >= today ? 0 : 1;
      return fa - fb || ka.localeCompare(kb);
    })
    .slice(0, 2);
}

/**
 * Numer i termin ZD: najnowsze ZD dostawców tego towaru (indeks ZD + powiązania z katalogu),
 * tylko otwarte i zawierające towar.
 */
async function loadIncomingDocs(
  twIds: readonly number[],
  packaging: Map<number, Packaging>
): Promise<Map<number, ProsbaIncomingZdDoc[]>> {
  const res = await query<{ subiekt_tw_id: number; dok_id: number }>(
    `SELECT l.subiekt_tw_id, z.dok_id
       FROM product_supplier_links l
       JOIN LATERAL (
         (SELECT zi.dok_id
            FROM subiekt_zd_index zi
           WHERE zi.supplier_id = l.supplier_id
             AND zi.dok_data_wyst >= to_char(now() - ($3::int * interval '1 day'), 'YYYY-MM-DD')
           ORDER BY zi.dok_data_wyst DESC
           LIMIT $2)
         UNION
         -- ZD z Kreatora (zapis od razu) — indeks wyżej odświeża się dopiero w nocy.
         (SELECT sn.dok_id
            FROM zd_estimate_order_snapshots sn
            JOIN suppliers sup ON sup.subiekt_kh_id = sn.supplier_kh_id
           WHERE sup.id = l.supplier_id
             AND sn.linked_at > now() - ($3::int * interval '1 day')
           ORDER BY sn.linked_at DESC
           LIMIT $2)
       ) z ON true
      WHERE l.subiekt_tw_id = ANY($1::int[])`,
    [twIds, ZD_DOCS_PER_SUPPLIER, ZD_DOCS_MAX_AGE_DAYS]
  );
  const docIds = [...new Set(res.rows.map((r) => Number(r.dok_id)))];
  const docs = await mapLimit(docIds, SUBIEKT_CONCURRENCY, (id) =>
    getSubiektZdDocumentCached(id).catch(() => null)
  );
  const byTw = new Map<number, ProsbaIncomingZdDoc[]>();
  const wanted = new Set(twIds);
  for (const doc of docs) {
    if (!doc || !isActiveZdFulfillmentDocument(doc)) continue;
    const qtyByTw = new Map<number, number>();
    for (const line of doc.dok_Pozycja ?? []) {
      const id = lineTowId(line);
      if (id == null || !wanted.has(id)) continue;
      qtyByTw.set(id, (qtyByTw.get(id) ?? 0) + num(line.ob_Ilosc));
    }
    for (const [twId, docUnits] of qtyByTw) {
      const pack = packaging.get(twId);
      const list = byTw.get(twId) ?? [];
      list.push({
        dokNr: doc.dok_NrPelny?.trim() || `#${doc.dok_Id}`,
        issued: doc.dok_DataWyst ? String(doc.dok_DataWyst).slice(0, 10) : null,
        deadline: parseZdFulfillmentDeadline(doc),
        qty: zdDocumentUnitsToPieces(docUnits, pack?.unitsPerPackage, pack?.mode),
      });
      byTw.set(twId, list);
    }
  }
  return byTw;
}
