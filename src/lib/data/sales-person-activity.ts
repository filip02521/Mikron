import { query } from "@/lib/db/pool";

/** Najpóźniejszy znany timestamp ISO z listy (lexicographic OK dla ISO). */
export function maxIsoTimestamp(...values: (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!max || value > max) max = value;
  }
  return max;
}

/**
 * Ostatnia aktywność w aplikacji (tablica, prośby) — sesja JWT nie aktualizuje last_sign_in_at.
 */
export async function fetchLastActivityAtByProfileId(
  profileIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!profileIds.length) return result;

  const bump = (profileId: string, iso: string | null | undefined) => {
    if (!iso) return;
    const current = result.get(profileId);
    if (!current || iso > current) result.set(profileId, iso);
  };

  // MAX w bazie — wszystkie wpisy na tablicy rosną bez granicy. to_json: ten sam
  // format ISO co wiersze z query-buildera (porównujemy leksykograficznie).
  const { rows } = await query<{ created_by: string; last_at: string | null }>(
    `SELECT created_by, to_json(max(created_at)) #>> '{}' AS last_at
       FROM department_board_posts WHERE created_by = ANY($1::uuid[]) GROUP BY created_by
     UNION ALL
     SELECT created_by, to_json(max(greatest(created_at, updated_at))) #>> '{}'
       FROM department_board_threads WHERE created_by = ANY($1::uuid[]) GROUP BY created_by`,
    [profileIds]
  );
  for (const row of rows) bump(row.created_by, row.last_at);

  return result;
}

export async function fetchLastActivityAtBySalesPersonId(
  salesPersonIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!salesPersonIds.length) return result;

  // MAX w bazie zamiast wszystkich prośb handlowców (historia rośnie bez granicy).
  const { rows } = await query<{ sales_person_id: string; last_at: string }>(
    `SELECT sales_person_id, to_json(max(created_at)) #>> '{}' AS last_at
       FROM individual_orders
      WHERE sales_person_id = ANY($1::uuid[])
      GROUP BY sales_person_id`,
    [salesPersonIds]
  );
  for (const row of rows) result.set(row.sales_person_id, row.last_at);

  return result;
}
