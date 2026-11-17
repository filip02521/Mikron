/**
 * Dostawcy, u których dziś (Warszawa) powstało albo zostało powiązane ZD w Kreatorze — panel dzienny przenosi ich
 * z „Do zamówienia” / „Zamów wcześniej” do „Zrobione dziś”, bo nocna analiza Braki o tym ZD jeszcze nie wie. Tylko serwer.
 */
import { isUndefinedTableError, query } from "@/lib/db/pool";

export async function listSuppliersWithZdLinkedToday(todayKey: string): Promise<string[]> {
  try {
    const res = await query<{ id: string }>(
      // Po zakresie Kreatora (grupa / cecha), nie po kontrahencie: jeden kontrahent Subiekta bywa kilkoma dostawcami OnTime.
      `SELECT DISTINCT z.supplier_id AS id
         FROM zd_estimate_order_snapshots h
         JOIN zd_estimate_supplier_scopes z
           ON (h.scope_mode = 'grupa' AND z.mode = 'grupa' AND z.grupa_id = h.grt_id)
           OR (h.scope_mode = 'cecha' AND z.mode = 'cecha' AND z.cecha_id = h.cecha_id)
        WHERE (h.linked_at AT TIME ZONE 'Europe/Warsaw')::date = $1::date`,
      [todayKey]
    );
    return res.rows.map((r) => r.id);
  } catch (e) {
    if (isUndefinedTableError(e)) return [];
    throw e;
  }
}
