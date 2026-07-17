import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveUserAssignmentLabel } from "./user-assignment-label";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/lib/auth/sales-person", () => ({
  resolveSalesPersonForUser: vi.fn(),
}));

vi.mock("@/lib/data/sales-group-access", () => ({
  getManagedGroupIdsForUser: vi.fn(),
}));

vi.mock("@/lib/data/sales-groups", () => ({
  fetchSalesGroups: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: vi.fn(() => true),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { sales_groups: { name: "Sklep" } },
          })),
        })),
      })),
    })),
  })),
}));

import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";
import { fetchSalesGroups } from "@/lib/data/sales-groups";

const session: SessionUser = {
  id: "user-1",
  email: "jan@firma.pl",
  role: "sales",
  salesPersonId: "sp-1",
  mustChangePassword: false,
  salesOnboardingCompletedAt: "2026-01-01T00:00:00Z",
  assignedWorkspaces: [],
  uniformBackground: false,
};

describe("resolveUserAssignmentLabel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("zwraca grupę handlowca", async () => {
    vi.mocked(resolveSalesPersonForUser).mockResolvedValue({ id: "sp-1", name: "Jan" });

    await expect(
      resolveUserAssignmentLabel({ role: "sales", session, salesPersonId: "sp-1" })
    ).resolves.toBe("Sklep");
  });

  it("zwraca dział zakupów", async () => {
    await expect(
      resolveUserAssignmentLabel({ role: "zakupy", session: { ...session, role: "zakupy" } })
    ).resolves.toBe("Zakupy");
  });

  it("zwraca dział magazynu", async () => {
    await expect(
      resolveUserAssignmentLabel({ role: "magazyn", session: { ...session, role: "magazyn" } })
    ).resolves.toBe("Magazyn");
  });

  it("dla kierownika zwraca przypisane grupy", async () => {
    vi.mocked(getManagedGroupIdsForUser).mockResolvedValue(["g1", "g2"]);
    vi.mocked(fetchSalesGroups).mockResolvedValue([
      { id: "g1", name: "Sklep", sortOrder: 1, memberCount: 2 },
      { id: "g2", name: "Biuro", sortOrder: 2, memberCount: 1 },
    ]);

    await expect(
      resolveUserAssignmentLabel({
        role: "sales_manager",
        session: { ...session, role: "sales_manager", salesPersonId: null },
      })
    ).resolves.toBe("Sklep, Biuro");
  });
});
