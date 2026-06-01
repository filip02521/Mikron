import { describe, expect, it } from "vitest";
import { groupSalesPeopleForTeamView } from "./team-grouping";
import type { SalesGroupRow } from "@/lib/data/sales-groups";
import { testSalesPersonAdminRow } from "@/test-utils/fixtures";

const person = testSalesPersonAdminRow;

describe("groupSalesPeopleForTeamView", () => {
  const groups: SalesGroupRow[] = [
    { id: "g1", name: "Sklep", sortOrder: 1, memberCount: 1 },
    { id: "g2", name: "Biuro", sortOrder: 2, memberCount: 0 },
  ];

  it("dzieli handlowców na grupy i sekcję bez grupy", () => {
    const rows = [
      person({ id: "1", name: "Anna", groupId: "g1", groupName: "Sklep" }),
      person({ id: "2", name: "Bogdan" }),
      person({ id: "3", name: "Celina", groupId: "g2", groupName: "Biuro" }),
    ];
    const sections = groupSalesPeopleForTeamView(rows, groups);
    expect(sections).toHaveLength(3);
    expect(sections[0].group?.name).toBe("Sklep");
    expect(sections[0].rows.map((r) => r.name)).toEqual(["Anna"]);
    expect(sections[1].group?.name).toBe("Biuro");
    expect(sections[1].rows.map((r) => r.name)).toEqual(["Celina"]);
    expect(sections[2].group).toBeNull();
    expect(sections[2].rows.map((r) => r.name)).toEqual(["Bogdan"]);
  });
});
