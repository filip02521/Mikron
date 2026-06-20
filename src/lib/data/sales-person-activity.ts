import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

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
  supabase: AdminClient,
  profileIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!profileIds.length) return result;

  const bump = (profileId: string, iso: string | null | undefined) => {
    if (!iso) return;
    const current = result.get(profileId);
    if (!current || iso > current) result.set(profileId, iso);
  };

  const [{ data: posts }, { data: threads }] = await Promise.all([
    supabase
      .from("department_board_posts")
      .select("created_by, created_at")
      .in("created_by", profileIds),
    supabase
      .from("department_board_threads")
      .select("created_by, created_at, updated_at")
      .in("created_by", profileIds),
  ]);

  for (const row of posts ?? []) {
    bump(row.created_by as string, row.created_at as string);
  }
  for (const row of threads ?? []) {
    bump(row.created_by as string, row.created_at as string);
    bump(row.created_by as string, row.updated_at as string);
  }

  return result;
}

export async function fetchLastActivityAtBySalesPersonId(
  supabase: AdminClient,
  salesPersonIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!salesPersonIds.length) return result;

  const { data: orders, error } = await supabase
    .from("individual_orders")
    .select("sales_person_id, created_at")
    .in("sales_person_id", salesPersonIds);

  if (error) throw new Error(error.message);

  for (const row of orders ?? []) {
    const id = row.sales_person_id as string | null;
    if (!id) continue;
    const iso = row.created_at as string;
    const current = result.get(id);
    if (!current || iso > current) result.set(id, iso);
  }

  return result;
}
