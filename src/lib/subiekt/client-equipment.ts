import { mapPool } from "@/lib/async/map-pool";
import { getSubiektDocument, getSubiektProduct } from "@/lib/subiekt/api";
import { subiektJson } from "@/lib/subiekt/client";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import { warsawDateKeyDaysAgo, warsawNowParts } from "@/lib/time/warsaw";
import {
  dropServiceProducts,
  equipmentFromInvoice,
  hasSerialNotes,
  mergeClientEquipment,
  parseSalesDocNumber,
  type ClientEquipmentItem,
} from "@/lib/subiekt/client-equipment-parse";

/** Sprzęt serwisuje się latami po zakupie — 10 lat wstecz. */
const LOOKBACK_DAYS = 3650;
/** /documents/fs oddaje najwyżej 200 wierszy na stronę, niezależnie od pageSize. */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;
/** Szczegóły pobieramy tylko dla faktur z numerami w uwagach — limit chroni przed klientem-hurtownią. */
const MAX_DETAILS = 60;

type DocListRow = { dok_Id: number; dok_Uwagi?: string | null; dok_DataWyst?: string | null };

export type ClientEquipmentResult = {
  items: ClientEquipmentItem[];
  /** Ile dokumentów klienta (faktur i paragonów) przejrzano i czy lista może być niepełna (limit stron albo szczegółów). */
  invoicesScanned: number;
  truncated: boolean;
};

/**
 * Dokumenty klienta z numerami w uwagach. Filtr po kontrahencie ma inną nazwę na każdej liście
 * (sprawdzone na żywym API): FS — `kh_id` (`khId` nie filtruje), PA — `odbiorcaId`.
 */
async function scanClientDocs(
  path: string,
  filter: Record<string, number>,
  range: { dataOd: string; dataDo: string }
): Promise<{ rows: DocListRow[]; scanned: number; truncated: boolean }> {
  const rows: DocListRow[] = [];
  let scanned = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = subiektQueryString({ ...filter, ...range, page, pageSize: PAGE_SIZE });
    const res = await subiektJson<{ data?: DocListRow[] }>(`${path}${qs}`);
    const data = res.data ?? [];
    scanned += data.length;
    for (const r of data) if (hasSerialNotes(r.dok_Uwagi)) rows.push(r);
    // Koniec po stronie krótszej niż limit — nie ufamy totalPages (liczone z żądanego pageSize).
    if (data.length < PAGE_SIZE) return { rows, scanned, truncated: false };
  }
  return { rows, scanned, truncated: true };
}

/**
 * Sprzęt kupiony przez klienta: pozycje jego faktur sprzedaży (FS) i paragonów (PA) z numerami seryjnymi
 * w uwagach. Paragony detaliczne idą zwykle na jednego zbiorczego kontrahenta — klient z własną kartoteką
 * ma ich niewiele, ale bywają. Tylko serwer.
 */
export async function fetchClientEquipment(khId: number): Promise<ClientEquipmentResult> {
  const range = { dataOd: warsawDateKeyDaysAgo(LOOKBACK_DAYS), dataDo: warsawNowParts().dateKey };
  const [fs, pa] = await Promise.all([
    scanClientDocs(SUBIEKT_PATHS.documentsFs, { kh_id: khId }, range),
    scanClientDocs(SUBIEKT_PATHS.documentsPa, { odbiorcaId: khId }, range),
  ]);
  const withSerials = [...fs.rows, ...pa.rows];
  let truncated = fs.truncated || pa.truncated;
  const newest = [...withSerials].sort((a, b) => String(b.dok_DataWyst ?? "").localeCompare(String(a.dok_DataWyst ?? "")));
  if (newest.length > MAX_DETAILS) truncated = true;
  // /documents/{id} oddaje pozycje dla każdego typu dokumentu (FS i PA).
  const docs = await mapPool(newest.slice(0, MAX_DETAILS), 4, (r) => getSubiektDocument(r.dok_Id));
  const scanned = fs.scanned + pa.scanned;
  const all = mergeClientEquipment(docs.flatMap((d) => equipmentFromInvoice({ ...d, dok_Uwagi: (d.dok_Uwagi as string | null | undefined) ?? null })));
  // Rodzaj towaru z kartoteki — raz na model; błąd odczytu = rodzaj nieznany (pozycja zostaje).
  const twIds = [...new Set(all.map((i) => i.twId))];
  const kinds = await mapPool(twIds, 4, async (id) => {
    try {
      const p = await getSubiektProduct(id);
      return [id, p.tw_Rodzaj ?? null] as const;
    } catch {
      return [id, null] as const;
    }
  });
  const items = dropServiceProducts(all, new Map(kinds));
  return { items, invoicesScanned: scanned, truncated };
}

export type ClientRecentInvoice = { id: number; number: string; date: string | null; gross: number | null };

/** Ostatnie faktury klienta (90 dni, najnowsze najpierw) — do wskazania faktury za naprawę. Tylko serwer. */
export async function fetchClientRecentInvoices(khId: number): Promise<ClientRecentInvoice[]> {
  const qs = subiektQueryString({ kh_id: khId, dataOd: warsawDateKeyDaysAgo(90), dataDo: warsawNowParts().dateKey, page: 1, pageSize: PAGE_SIZE });
  const res = await subiektJson<{ data?: { dok_Id: number; dok_NrPelny?: string | null; dok_DataWyst?: string | null; dok_WartBrutto?: number | null }[] }>(
    `${SUBIEKT_PATHS.documentsFs}${qs}`
  );
  return (res.data ?? [])
    .map((d) => ({
      id: d.dok_Id,
      number: d.dok_NrPelny?.trim() || `FS ${d.dok_Id}`,
      date: d.dok_DataWyst ? String(d.dok_DataWyst).slice(0, 10) : null,
      gross: typeof d.dok_WartBrutto === "number" ? d.dok_WartBrutto : null,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id)
    .slice(0, 30);
}

type DocNumberRow = { dok_Id: number; dok_NrPelny?: string | null; dok_OdbiorcaId?: number | null; dok_PlatnikId?: number | null };

/**
 * Faktura sprzedaży po numerze wpisanym przez klienta („FS 978/M/11/2026”, „978/M/11/2026”) i jej odbiorca.
 * `numer` na liście FS filtruje po samym numerze kolejnym (wszystkie miesiące, sprawdzone na :5080), więc pełny
 * numer porównujemy tutaj. Paragonów nie szukamy: idą zwykle na zbiorczego kontrahenta detalicznego, więc
 * „klient z paragonu” byłby cudzym sprzętem. Tylko serwer.
 */
export async function findInvoiceBuyer(raw: string): Promise<{ number: string; khId: number } | null> {
  const want = parseSalesDocNumber(raw);
  if (!want || want.kind === "pa") return null;
  const qs = subiektQueryString({ numer: want.nr, page: 1, pageSize: PAGE_SIZE });
  const res = await subiektJson<{ data?: DocNumberRow[] }>(`${SUBIEKT_PATHS.documentsFs}${qs}`);
  for (const d of res.data ?? []) {
    if (parseSalesDocNumber(d.dok_NrPelny ?? "")?.key !== want.key) continue;
    const khId = Math.trunc(Number(d.dok_OdbiorcaId || d.dok_PlatnikId));
    if (Number.isSafeInteger(khId) && khId > 0) return { number: d.dok_NrPelny!.trim(), khId };
  }
  return null;
}
