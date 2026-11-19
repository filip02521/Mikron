import { hasDatabaseConfig, query } from "@/lib/db/pool";
import type { ServicePartSupplierCandidate } from "@/lib/orders/service-part-report";
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
} from "@/lib/orders/service-parts";

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
 * Lista „tylko na prośbę” do liczenia ZD: wpisy ręczne + towary z cechą „Części serwisowe”.
 * Błąd odczytu cechy przerywa wczytanie listy — lepiej nie policzyć ZD niż po cichu zamówić części serwisowe.
 */
export async function fetchZdEstimateOnRequestsWithServiceParts(): Promise<ZdEstimateOnRequestRow[]> {
  const [manual, cecha] = await Promise.all([
    fetchZdEstimateOnRequests(),
    resolveServicePartsCecha(),
  ]);
  if (!cecha) return manual;
  const twIds = await fetchServicePartTwIds(cecha.cechaId);
  return mergeServicePartsIntoOnRequests(manual, twIds, serviceOnRequestRow);
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
