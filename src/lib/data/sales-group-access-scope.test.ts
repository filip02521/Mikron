import { describe, expect, it, vi, beforeEach } from "vitest";

const { groupManagersRows } = vi.hoisted(() => ({
  groupManagersRows: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: vi.fn(() => true),
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== "sales_group_managers") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => groupManagersRows()),
        })),
      };
    }),
  })),
}));

import {
  assertManagerHasTeamScope,
  assertManagerRequiresGroupInScope,
} from "./sales-group-access";

const manager = {
  id: "mgr-1",
  role: "sales_manager" as const,
};

describe("assertManagerHasTeamScope", () => {
  beforeEach(() => {
    groupManagersRows.mockReset();
  });

  it("rzuca gdy kierownik nie ma przypisanych grup", async () => {
    groupManagersRows.mockResolvedValue({ data: [], error: null });
    await expect(assertManagerHasTeamScope(manager)).rejects.toThrow(/Brak przypisanych grup/);
  });

  it("przechodzi gdy kierownik ma grupy", async () => {
    groupManagersRows.mockResolvedValue({
      data: [{ group_id: "g1" }],
      error: null,
    });
    await expect(assertManagerHasTeamScope(manager)).resolves.toBeUndefined();
  });
});

describe("assertManagerRequiresGroupInScope", () => {
  beforeEach(() => {
    groupManagersRows.mockReset();
  });

  it("wymaga groupId w zakresie kierownika", async () => {
    groupManagersRows.mockResolvedValue({
      data: [{ group_id: "g1" }],
      error: null,
    });
    await expect(assertManagerRequiresGroupInScope(manager, "g1")).resolves.toBeUndefined();
    await expect(assertManagerRequiresGroupInScope(manager, null)).rejects.toThrow(
      /Wybierz grupę/
    );
    await expect(assertManagerRequiresGroupInScope(manager, "g-other")).rejects.toThrow(
      /Nie masz uprawnień/
    );
  });
});
