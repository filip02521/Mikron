import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";
import {
  filterRowsByGroupScope,
  getManagedGroupIdsForUser,
} from "@/lib/data/sales-group-access";
import { isManagedSalesPersonEmail } from "@/lib/sales/sales-person-catalog";
import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";

export type SalesPersonAdminRow = {
  id: string;
  name: string;
  email: string;
  groupId: string | null;
  groupName: string | null;
  orderCount: number;
  /** Aktywne ZK oczekujące na towar (notatnik). */
  pendingZkCount: number;
  /** Aktywne ZK z przypomnieniem na dziś lub wcześniej. */
  followUpDueZkCount: number;
  linkedUserId: string | null;
  linkedUserEmail: string | null;
};

export async function fetchSalesPeopleAdmin(): Promise<SalesPersonAdminRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  const [{ data: people, error: peopleError }, { data: profiles, error: profilesError }, { data: watchRows, error: watchesError }] =
    await Promise.all([
      supabase.from("sales_people").select("id, name, email, group_id").order("name"),
      supabase
        .from("profiles")
        .select("id, email, sales_person_id")
        .not("sales_person_id", "is", null),
      supabase
        .from("sales_zk_watches")
        .select("sales_person_id, follow_up_at, closed_at, archived_at")
        .is("closed_at", null)
        .is("archived_at", null),
    ]);

  if (peopleError) throw new Error(peopleError.message);
  if (profilesError) throw new Error(profilesError.message);
  if (watchesError) throw new Error(watchesError.message);

  const { data: groups, error: groupsError } = await supabase
    .from("sales_groups")
    .select("id, name");
  if (groupsError) throw new Error(groupsError.message);
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const linkedBySalesId = new Map(
    (profiles ?? []).map((p) => [
      p.sales_person_id as string,
      { id: p.id, email: p.email ?? "—" },
    ])
  );

  const { data: orderRows, error: ordersError } = await supabase
    .from("individual_orders")
    .select("sales_person_id");
  if (ordersError) throw new Error(ordersError.message);

  const orderCountBySalesId = new Map<string, number>();
  for (const row of orderRows ?? []) {
    const id = row.sales_person_id;
    if (!id) continue;
    orderCountBySalesId.set(id, (orderCountBySalesId.get(id) ?? 0) + 1);
  }

  const pendingZkBySalesId = new Map<string, number>();
  const followUpDueZkBySalesId = new Map<string, number>();
  for (const row of watchRows ?? []) {
    const id = row.sales_person_id;
    if (!id) continue;
    pendingZkBySalesId.set(id, (pendingZkBySalesId.get(id) ?? 0) + 1);
    if (isFollowUpDue(row.follow_up_at)) {
      followUpDueZkBySalesId.set(id, (followUpDueZkBySalesId.get(id) ?? 0) + 1);
    }
  }

  return (people ?? []).map((p) => {
    const linked = linkedBySalesId.get(p.id);
    const groupId = (p.group_id as string | null) ?? null;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      groupId,
      groupName: groupId ? (groupNameById.get(groupId) ?? null) : null,
      orderCount: orderCountBySalesId.get(p.id) ?? 0,
      pendingZkCount: pendingZkBySalesId.get(p.id) ?? 0,
      followUpDueZkCount: followUpDueZkBySalesId.get(p.id) ?? 0,
      linkedUserId: linked?.id ?? null,
      linkedUserEmail: linked?.email ?? null,
    };
  });
}

export async function fetchSalesPeopleAdminForUser(
  user: Pick<SessionUser, "id" | "role">
): Promise<SalesPersonAdminRow[]> {
  const rows = await fetchSalesPeopleAdmin();
  const scope = await getManagedGroupIdsForUser(user);
  return filterRowsByGroupScope(rows, scope);
}

/**
 * Handlowcy z Admin → Handlowcy — bez wpisów z importu historii
 * (np. „Kamil / Nazwa kliniki”, e-mail @import.historia.mikran).
 */
export async function fetchSalesPeopleForPicker(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  const rows = await fetchSalesPeopleAdmin();
  return rows
    .filter((p) => isManagedSalesPersonEmail(p.email))
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
    }));
}
