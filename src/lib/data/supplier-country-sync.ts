/**
 * Kraj dostawcy z Subiekta → `suppliers.subiekt_country_*` (mig. 194). Noc: po czasach dostaw
 * (`/api/cron/subiekt-lead-times`); od razu po zmianie głównego kh_Id na karcie dostawcy.
 * Pusty lub nieudany odczyt nie kasuje zapisanej wartości — wyjątek: zmiana kh_Id (stary kraj
 * należał do innego kontrahenta).
 */
import { query } from "@/lib/db/pool";
import { lookupSubiektKontrahentByKhId } from "@/lib/subiekt/lookup-kontrahent";
import { isPolandCountryId, subiektCountryFromKontrahent, type SubiektCountry } from "@/lib/suppliers/subiekt-country";

const CLEAR_SQL = `UPDATE suppliers
   SET subiekt_country_id = NULL, subiekt_country_name = NULL, subiekt_country_synced_at = NULL
 WHERE id = $1`;

/** Lookup łapie błędy Subiekta (null); błąd bazy leci wyjątkiem. */
export async function syncSupplierCountry(
  supplierId: string,
  khId: number | null,
  opts: { clearOnMiss?: boolean } = {}
): Promise<SubiektCountry | null> {
  if (khId == null) {
    await query(CLEAR_SQL, [supplierId]);
    return null;
  }
  const country = subiektCountryFromKontrahent(await lookupSubiektKontrahentByKhId(khId));
  if (!country) {
    if (opts.clearOnMiss) await query(`${CLEAR_SQL} AND subiekt_kh_id = $2`, [supplierId, khId]);
    return null;
  }
  // kh_Id w WHERE: równoległa zmiana powiązania nie dostanie kraju poprzedniego kontrahenta.
  await query(
    `UPDATE suppliers
        SET subiekt_country_id = $3, subiekt_country_name = $4, subiekt_country_synced_at = now()
      WHERE id = $1 AND subiekt_kh_id = $2`,
    [supplierId, khId, country.id, country.name]
  );
  return country;
}

export type SupplierCountrySyncResult = {
  suppliers: number;
  updated: number;
  /** Subiekt nie zwrócił kraju (błąd / brak) — poprzednia wartość została. */
  unread: number;
  poland: number;
};

export async function runSupplierCountrySync(): Promise<SupplierCountrySyncResult> {
  const { rows } = await query<{ id: string; subiekt_kh_id: number }>(
    `SELECT id, subiekt_kh_id FROM suppliers WHERE subiekt_kh_id IS NOT NULL ORDER BY name`
  );
  const result: SupplierCountrySyncResult = { suppliers: rows.length, updated: 0, unread: 0, poland: 0 };
  // shortcut: sekwencyjnie (~1 GET na dostawcę); równolegle, gdy dostawców będą tysiące.
  for (const r of rows) {
    const country = await syncSupplierCountry(r.id, Math.trunc(Number(r.subiekt_kh_id)));
    if (!country) result.unread++;
    else {
      result.updated++;
      if (isPolandCountryId(country.id)) result.poland++;
    }
  }
  return result;
}
