import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";
import {
  filterRowsByGroupScope,
  getManagedGroupIdsForUser,
} from "@/lib/data/sales-group-access";

export type SalesPersonAdminRow = {
  id: string;
  name: string;
  email: string;
  groupId: string | null;
  groupName: string | null;
  orderCount: number;
  linkedUserId: string | null;
  linkedUserEmail: string | null;
};

export async function fetchSalesPeopleAdmin(): Promise<SalesPersonAdminRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  const [{ data: people, error: peopleError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from("sales_people").select("id, name, email, group_id").order("name"),
      supabase
        .from("profiles")
        .select("id, email, sales_person_id")
        .not("sales_person_id", "is", null),
    ]);

  if (peopleError) throw new Error(peopleError.message);
  if (profilesError) throw new Error(profilesError.message);

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
