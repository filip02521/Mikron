import { describe, expect, it } from "vitest";
import { resolveLoginDirectoryAssignmentLabel } from "./login-directory-assignment-label";

describe("resolveLoginDirectoryAssignmentLabel", () => {
  it("zwraca grupę handlowca", () => {
    expect(
      resolveLoginDirectoryAssignmentLabel(
        {
          id: "user-1",
          role: "sales",
          sales_people: { sales_groups: { name: "Sklep" } },
        },
        new Map(),
        new Map()
      )
    ).toBe("Sklep");
  });

  it("preferuje grupy kierowane przez kierownika", () => {
    expect(
      resolveLoginDirectoryAssignmentLabel(
        {
          id: "mgr-1",
          role: "sales_manager",
          sales_people: { sales_groups: { name: "Sklep" } },
        },
        new Map([["mgr-1", ["g-1", "g-2"]]]),
        new Map([
          ["g-1", "Biuro"],
          ["g-2", "DOK"],
        ])
      )
    ).toBe("Biuro, DOK");
  });

  it("zwraca etykietę działu operacyjnego", () => {
    expect(
      resolveLoginDirectoryAssignmentLabel(
        { id: "ops-1", role: "zakupy" },
        new Map(),
        new Map()
      )
    ).toBe("Zakupy");
  });
});
