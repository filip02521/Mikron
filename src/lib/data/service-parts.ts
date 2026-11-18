import { hasDatabaseConfig, query } from "@/lib/db/pool";
import { pickServicePartSuppliers, type ServicePartSupplierCandidate, type ServicePartSupplierPick } from "@/lib/orders/service-part-report";
import {
  fetchZdEstimateOnRequests,
  type ZdEstimateOnRequestRow,
} from "@/lib/data/zd-estimate-on-request";
import {
  mergeServicePartsIntoOnRequests,
  parseServicePartsCechaSetting,
  pickServicePartsCechaId,
  SERVICE_PARTS_CECHA_NAME,
  SERVICE_PARTS_CECHA_SETTING_KEY,
  SERVICE_PARTS_ON_REQUEST_NOTE,
  serviceTwIdsOnRequestOnly,
} from "@/lib/orders/service-parts";
import { fetchZdEstimateMinStock, minStockRowsToMap } from "@/lib/data/zd-estimate-min-stock";

export type ServicePartsCecha = { cechaId: number; name: string };

/**
 * Cecha „Części serwisowe”: id z app_settings (gdy ktoś ją przemianował w Subiekcie),
 * inaczej po nazwie z indeksu cech (`subiekt_scope_names`, synchronizuje go stock-watch).
 * null = cechy nie ma w indeksie; wtedy nic nie jest oznaczone jako serwisowe.
 */
export async function resolveServicePartsCecha(): Promise<ServicePartsCecha | null> {
  if (!hasDatabaseConfig()) return null;
  const [setting, names] = await Promise.all([
    query<{ value: unknown }>(`SELECT value FROM app_settings WHERE key = $1`, [
      SERVICE_PARTS_CECHA_SETTING_KEY,
    ]),
    query<{ scope_id: number; name: string }>(
      `SELECT scope_id, name FROM subiekt_scope_names WHERE kind = 'cecha'`
    ),
  ]);
  const cechy = names.rows.map((r) => ({ scopeId: Number(r.scope_id), name: r.name }));
  const overrideId = parseServicePartsCechaSetting(setting.rows[0]?.value ?? null);
  if (overrideId) {
    const name = cechy.find((c) => c.scopeId === overrideId)?.name ?? SERVICE_PARTS_CECHA_NAME;
    return { cechaId: overrideId, name };
  }
  const cechaId = pickServicePartsCechaId(cechy);
  return cechaId ? { cechaId, name: SERVICE_PARTS_CECHA_NAME } : null;
}

export async function fetchServicePartTwIds(cechaId: number): Promise<number[]> {
  const res = await query<{ subiekt_tw_id: number }>(
    `SELECT subiekt_tw_id FROM subiekt_product_scope_index
      WHERE $1 = ANY(cecha_ids)
      ORDER BY subiekt_tw_id`,
    [Math.trunc(cechaId)]
  );
  return res.rows.map((r) => Number(r.subiekt_tw_id));
}

function serviceOnRequestRow(twId: number): ZdEstimateOnRequestRow {
  return {
    subiektTwId: twId,
    twSymbol: null,
    twNazwa: "-",
    grtId: null,
    grtNazwa: null,
    note: SERVICE_PARTS_ON_REQUEST_NOTE,
    createdAt: "",
    updatedAt: "",
    createdBy: null,
    origin: "service_cecha",
  };
}

/**
 * Lista „tylko na prośbę” do liczenia ZD: wpisy ręczne + towary z cechą „Części serwisowe” bez minimum.
 * Błąd odczytu cechy przerywa wczytanie listy — lepiej nie policzyć ZD niż po cichu zamówić części serwisowe.
 */
export async function fetchZdEstimateOnRequestsWithServiceParts(): Promise<ZdEstimateOnRequestRow[]> {
  const [manual, cecha] = await Promise.all([fetchZdEstimateOnRequests(), resolveServicePartsCecha()]);
  if (!cecha) return manual;
  // Minimum dopiero przy znanej cesze — bez bazy / bez cechy zachowanie jak przed minimum serwisu.
  const [twIds, minStock] = await Promise.all([fetchServicePartTwIds(cecha.cechaId), fetchZdEstimateMinStock()]);
  // Część z minimum zamawia silnik do minimum — nie jest już „tylko na prośbę”.
  const onRequestOnly = serviceTwIdsOnRequestOnly(twIds, minStockRowsToMap(minStock));
  return mergeServicePartsIntoOnRequests(manual, onRequestOnly, serviceOnRequestRow);
}

type SupplierCandidateRow = { supplier_id: string; name: string; is_active: boolean | null };

/**
 * Kandydaci na dostawcę prośby serwisu (wybór: `pickServicePartSupplier`): przypięty w Kreatorze ZD
 * i ostatni z historii ZD (`product_supplier_links`, jak `loadLastZdSupplierByTwIds`).
 */
export async function loadServicePartSupplierCandidates(twId: number): Promise<{
  pinned: ServicePartSupplierCandidate | null;
  lastZd: ServicePartSupplierCandidate | null;
}> {
  const toCandidate = (r: SupplierCandidateRow | undefined): ServicePartSupplierCandidate | null =>
    r ? { supplierId: String(r.supplier_id), supplierName: r.name, isActive: r.is_active !== false } : null;
  const [pinned, last] = await Promise.all([
    query<SupplierCandidateRow>(
      `SELECT a.supplier_id, s.name, s.is_active
         FROM zd_product_supplier_assignments a
         JOIN suppliers s ON s.id = a.supplier_id
        WHERE a.subiekt_tw_id = $1`,
      [twId]
    ),
    query<SupplierCandidateRow>(
      `SELECT l.supplier_id, s.name, s.is_active
         FROM product_supplier_links l
         JOIN suppliers s ON s.id = l.supplier_id
        WHERE l.subiekt_tw_id = $1 AND s.is_active IS DISTINCT FROM false
        ORDER BY l.last_action_at DESC NULLS LAST, l.order_count DESC
        LIMIT 1`,
      [twId]
    ),
  ]);
  return { pinned: toCandidate(pinned.rows[0]), lastZd: toCandidate(last.rows[0]) };
}

/** Dostawca każdej z części (przypięty w Kreatorze, inaczej ostatni z historii ZD) — jak prośba serwisu, zbiorczo. */
export async function fetchServicePartSuppliers(twIds: readonly number[]): Promise<Map<number, ServicePartSupplierPick>> {
  const ids = [...new Set(twIds.map((t) => Math.trunc(Number(t))).filter((t) => t > 0))];
  if (!ids.length) return new Map();
  type Row = SupplierCandidateRow & { subiekt_tw_id: number };
  const [pinned, last] = await Promise.all([
    query<Row>(
      `SELECT a.subiekt_tw_id, a.supplier_id, s.name, s.is_active
         FROM zd_product_supplier_assignments a
         JOIN suppliers s ON s.id = a.supplier_id
        WHERE a.subiekt_tw_id = ANY($1::int[])`,
      [ids]
    ),
    query<Row>(
      `SELECT DISTINCT ON (l.subiekt_tw_id) l.subiekt_tw_id, l.supplier_id, s.name, s.is_active
         FROM product_supplier_links l
         JOIN suppliers s ON s.id = l.supplier_id
        WHERE l.subiekt_tw_id = ANY($1::int[]) AND s.is_active IS DISTINCT FROM false
        ORDER BY l.subiekt_tw_id, l.last_action_at DESC NULLS LAST, l.order_count DESC`,
      [ids]
    ),
  ]);
  const toMap = (rows: Row[]) =>
    new Map(rows.map((r) => [Number(r.subiekt_tw_id), { supplierId: String(r.supplier_id), supplierName: r.name, isActive: r.is_active !== false }]));
  return pickServicePartSuppliers(toMap(pinned.rows), toMap(last.rows), ids);
}

/**
 * Części serwisowe z minimum kupowane u tego dostawcy — silnik ZD dociąga je do listy dostawcy jak prośby
 * (części zwykle nie leżą w żadnym przypisanym zakresie: grupa „SERWIS” nie jest zakresem dostawcy).
 */
export async function fetchServiceMinStockTwIdsForSupplier(
  supplierId: string,
  minStockByTwId: ReadonlyMap<number, number>
): Promise<number[]> {
  const cecha = await resolveServicePartsCecha();
  if (!cecha) return [];
  const withMin = (await fetchServicePartTwIds(cecha.cechaId)).filter((id) => (minStockByTwId.get(id) ?? 0) > 0);
  if (!withMin.length) return [];
  const suppliers = await fetchServicePartSuppliers(withMin);
  return withMin.filter((id) => suppliers.get(id)?.supplierId === supplierId);
}

/** Dostawcy z co najmniej jednym zakresem w Kreatorze ZD — tylko ich liczy Kreator i Automat. */
export async function fetchSuppliersWithScope(supplierIds: readonly string[]): Promise<Set<string>> {
  if (!supplierIds.length) return new Set();
  const res = await query<{ supplier_id: string }>(
    `SELECT DISTINCT supplier_id FROM zd_estimate_supplier_scopes WHERE supplier_id = ANY($1::uuid[])`,
    [supplierIds]
  );
  return new Set(res.rows.map((r) => String(r.supplier_id)));
}
