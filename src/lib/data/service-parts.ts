import { hasDatabaseConfig, query } from "@/lib/db/pool";
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
