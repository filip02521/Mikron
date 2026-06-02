import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import type { SalesGroupRow } from "@/lib/data/sales-groups";

export type SalesTeamGroupSection = {
  group: SalesGroupRow | null;
  rows: SalesPersonAdminRow[];
};

/** Sekcje podglądu zespołu: tylko osoby z przypisaną grupą. */
export function groupSalesPeopleForTeamView(
  rows: SalesPersonAdminRow[],
  groups: SalesGroupRow[]
): SalesTeamGroupSection[] {
  const byGroupId = new Map<string, SalesPersonAdminRow[]>();

  for (const row of rows) {
    if (!row.groupId) continue;
    const list = byGroupId.get(row.groupId) ?? [];
    list.push(row);
    byGroupId.set(row.groupId, list);
  }

  return groups.map((group) => ({
    group,
    rows: (byGroupId.get(group.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    ),
  }));
}
