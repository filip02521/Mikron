import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type SalesGroupRow = {
  id: string;
  name: string;
  sortOrder: number;
  memberCount: number;
};

export async function fetchSalesGroups(): Promise<SalesGroupRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  const [{ data: groups, error: groupsError }, { data: people, error: peopleError }] =
    await Promise.all([
      supabase.from("sales_groups").select("id, name, sort_order").order("sort_order").order("name"),
      supabase.from("sales_people").select("group_id"),
    ]);

  if (groupsError) throw new Error(groupsError.message);
  if (peopleError) throw new Error(peopleError.message);

  const countByGroup = new Map<string, number>();
  for (const row of people ?? []) {
    const gid = row.group_id as string | null;
    if (!gid) continue;
    countByGroup.set(gid, (countByGroup.get(gid) ?? 0) + 1);
  }

  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sort_order ?? 0,
    memberCount: countByGroup.get(g.id) ?? 0,
  }));
}
