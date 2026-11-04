import { mapPool } from "@/lib/async/map-pool";
import { getSubiektFs, getSubiektProduct } from "@/lib/subiekt/api";
import { subiektJson } from "@/lib/subiekt/client";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import { warsawDateKeyDaysAgo, warsawNowParts } from "@/lib/time/warsaw";
import {
  dropServiceProducts,
  equipmentFromInvoice,
  hasSerialNotes,
  mergeClientEquipment,
  type ClientEquipmentItem,
} from "@/lib/subiekt/client-equipment-parse";

/** Sprzęt serwisuje się latami po zakupie — 10 lat wstecz. */
const LOOKBACK_DAYS = 3650;
/** /documents/fs oddaje najwyżej 200 wierszy na stronę, niezależnie od pageSize. */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;
/** Szczegóły pobieramy tylko dla faktur z numerami w uwagach — limit chroni przed klientem-hurtownią. */
const MAX_DETAILS = 60;

type FsListRow = { dok_Id: number; dok_Uwagi?: string | null; dok_DataWyst?: string | null };

export type ClientEquipmentResult = {
  items: ClientEquipmentItem[];
  /** Ile faktur klienta przejrzano i czy lista może być niepełna (limit stron albo szczegółów). */
  invoicesScanned: number;
  truncated: boolean;
};

/**
 * Sprzęt kupiony przez klienta: pozycje jego faktur sprzedaży z numerami seryjnymi w uwagach.
 * `kh_id` filtruje listę FS po kontrahencie (sprawdzone na żywym API; `khId` nie filtruje). Tylko serwer.
 */
export async function fetchClientEquipment(khId: number): Promise<ClientEquipmentResult> {
  const dataOd = warsawDateKeyDaysAgo(LOOKBACK_DAYS);
  const dataDo = warsawNowParts().dateKey;
  const withSerials: FsListRow[] = [];
  let scanned = 0;
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = subiektQueryString({ kh_id: khId, dataOd, dataDo, page, pageSize: PAGE_SIZE });
    const res = await subiektJson<{ data?: FsListRow[] }>(`${SUBIEKT_PATHS.documentsFs}${qs}`);
    const rows = res.data ?? [];
    scanned += rows.length;
    for (const r of rows) if (hasSerialNotes(r.dok_Uwagi)) withSerials.push(r);
    // Koniec po stronie krótszej niż limit — nie ufamy totalPages (liczone z żądanego pageSize).
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) truncated = true;
  }
  const newest = [...withSerials].sort((a, b) => String(b.dok_DataWyst ?? "").localeCompare(String(a.dok_DataWyst ?? "")));
  if (newest.length > MAX_DETAILS) truncated = true;
  const docs = await mapPool(newest.slice(0, MAX_DETAILS), 4, (r) => getSubiektFs(r.dok_Id));
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
