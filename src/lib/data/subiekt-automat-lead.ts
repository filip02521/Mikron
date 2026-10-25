/**
 * Czas dostawy dla automatu ZD: wszystkie ZD → FZ z kopii dokumentów Subiekta (`subiekt_purchase_docs`), tą samą
 * analizą co nocna synchronizacja (`analyzeSubiektLeadTimes`, bez FZ z końca miesiąca). Potrzebne dla dostawców
 * „OSOBNO”: synchronizacja ich pomija (Subiekt nie rozróżnia zamówień głównych i uzupełniających), a automat
 * zamawia jak każde ZD. Tylko serwer.
 */
import { query } from "@/lib/db/pool";
import type { DeliveryStatsSampleRow } from "@/lib/orders/delivery-stats-samples";
import { analyzeSubiektLeadTimes } from "@/lib/orders/subiekt-lead-times";

/** supplier_id → próbki w kształcie `delivery_stats_samples` (źródło subiekt, „Główne”). */
export async function loadSubiektLeadRowsBySupplier(supplierIds: readonly string[]): Promise<Map<string, DeliveryStatsSampleRow[]>> {
  const out = new Map<string, DeliveryStatsSampleRow[]>();
  if (!supplierIds.length) return out;
  const kh = await query<{ supplier_id: string; kh: number }>(
    `SELECT id AS supplier_id, subiekt_kh_id AS kh FROM suppliers WHERE id = ANY($1::uuid[]) AND subiekt_kh_id IS NOT NULL
     UNION
     SELECT supplier_id, subiekt_kh_id AS kh FROM supplier_subiekt_kh_aliases WHERE supplier_id = ANY($1::uuid[])`,
    [supplierIds]
  );
  if (!kh.rows.length) return out;
  const supplierByKh = new Map(kh.rows.map((r) => [Number(r.kh), r.supplier_id]));
  const docs = await query<{
    dok_id: number;
    typ: number;
    kh_id: number | null;
    data_wyst: string | null;
    data_mag: string | null;
    status: number | null;
    do_dok_id: number | null;
  }>(
    `SELECT dok_id, typ, kh_id, to_char(data_wyst, 'YYYY-MM-DD') AS data_wyst,
            to_char(data_mag, 'YYYY-MM-DD') AS data_mag, status, do_dok_id
       FROM subiekt_purchase_docs WHERE kh_id = ANY($1::int[])`,
    [[...supplierByKh.keys()]]
  );
  const { samples } = analyzeSubiektLeadTimes(
    docs.rows.map((r) => ({
      dokId: r.dok_id,
      typ: r.typ,
      khId: r.kh_id,
      dataWyst: r.data_wyst,
      dataMag: r.data_mag,
      status: r.status,
      doDokId: r.do_dok_id,
    }))
  );
  for (const s of samples) {
    const supplierId = supplierByKh.get(s.khId);
    if (!supplierId) continue;
    const list = out.get(supplierId) ?? [];
    list.push({
      supplier_id: supplierId,
      order_id: null,
      placement_date: s.placementDate,
      delivery_date: s.deliveryDate,
      first_delivery_date: s.firstDeliveryDate,
      business_days_full: s.businessDaysFull,
      business_days_first: s.businessDaysFirst,
      order_type: "Glowne",
      is_teeth: false,
      source: "subiekt",
    });
    out.set(supplierId, list);
  }
  return out;
}
