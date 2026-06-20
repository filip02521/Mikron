import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { isTeamSalesPerson } from "@/lib/sales/sales-person-catalog";

export type SalesGroupRow = {
  id: string;
  name: string;
  sortOrder: number;
  memberCount: number;
};

export async function fetchSalesGroups(options?: {
  /** team — tylko handlowcy widoczni w /zespol (grupa + firmowy e-mail). */
  countMode?: "all" | "team";
}): Promise<SalesGroupRow[]> {
  if (!hasSupabaseConfig()) return [];

  const countMode = options?.countMode ?? "all";
  const supabase = createAdminClient();

  const [{ data: groups, error: groupsError }, { data: people, error: peopleError }] =
    await Promise.all([
      supabase.from("sales_groups").select("id, name, sort_order").order("sort_order").order("name"),
      supabase.from("sales_people").select("group_id, email"),
    ]);

  if (groupsError) throw new Error(groupsError.message);
  if (peopleError) throw new Error(peopleError.message);

  const countByGroup = new Map<string, number>();
  for (const row of people ?? []) {
    const gid = row.group_id as string | null;
    if (!gid) continue;
    if (
      countMode === "team" &&
      !isTeamSalesPerson({
        groupId: gid,
        email: (row.email as string | null) ?? "",
        name: "",
      })
    ) {
      continue;
    }
    countByGroup.set(gid, (countByGroup.get(gid) ?? 0) + 1);
  }

  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sort_order ?? 0,
    memberCount: countByGroup.get(g.id) ?? 0,
  }));
}
