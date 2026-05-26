import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import type { SalesGroupRow } from "@/lib/data/sales-groups";

export type SalesTeamGroupSection = {
  group: SalesGroupRow | null;
  rows: SalesPersonAdminRow[];
};

/** Sekcje podglądu zespołu: grupy wg sort_order, na końcu osoby bez grupy. */
export function groupSalesPeopleForTeamView(
  rows: SalesPersonAdminRow[],
  groups: SalesGroupRow[]
): SalesTeamGroupSection[] {
  const byGroupId = new Map<string, SalesPersonAdminRow[]>();
  const unassigned: SalesPersonAdminRow[] = [];

  for (const row of rows) {
    if (row.groupId) {
      const list = byGroupId.get(row.groupId) ?? [];
      list.push(row);
      byGroupId.set(row.groupId, list);
    } else {
      unassigned.push(row);
    }
  }

  const sections: SalesTeamGroupSection[] = groups.map((group) => ({
    group,
    rows: (byGroupId.get(group.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    ),
  }));

  if (unassigned.length) {
    sections.push({
      group: null,
      rows: unassigned.sort((a, b) => a.name.localeCompare(b.name, "pl")),
    });
  }

  return sections;
}
