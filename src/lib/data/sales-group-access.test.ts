import { describe, expect, it, vi, beforeEach } from "vitest";

const { profileRow, resolveSalesPersonForUser } = vi.hoisted(() => ({
  profileRow: vi.fn(),
  resolveSalesPersonForUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: vi.fn(() => true),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: profileRow,
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/auth/sales-person", () => ({
  resolveSalesPersonForUser,
}));

import { canAccessSalesPerson, isManagersOwnSalesPerson } from "./sales-group-access";

const manager = {
  id: "mgr-1",
  role: "sales_manager" as const,
};

describe("isManagersOwnSalesPerson", () => {
  beforeEach(() => {
    profileRow.mockReset();
    resolveSalesPersonForUser.mockReset();
  });

  it("true gdy sales_person_id na profilu", async () => {
    profileRow.mockResolvedValue({
      data: { sales_person_id: "sp-own", email: "mgr@example.com" },
    });
    expect(await isManagersOwnSalesPerson(manager, "sp-own")).toBe(true);
    expect(resolveSalesPersonForUser).not.toHaveBeenCalled();
  });

  it("true gdy dopasowanie po e-mailu", async () => {
    profileRow.mockResolvedValue({
      data: { sales_person_id: null, email: "mgr@example.com" },
    });
    resolveSalesPersonForUser.mockResolvedValue({ id: "sp-email", name: "Jan" });
    expect(await isManagersOwnSalesPerson(manager, "sp-email")).toBe(true);
  });

  it("false dla obcej karty", async () => {
    profileRow.mockResolvedValue({
      data: { sales_person_id: "sp-own", email: "mgr@example.com" },
    });
    resolveSalesPersonForUser.mockResolvedValue({ id: "sp-own", name: "Jan" });
    expect(await isManagersOwnSalesPerson(manager, "sp-other")).toBe(false);
  });
});

describe("canAccessSalesPerson", () => {
  beforeEach(() => {
    profileRow.mockReset();
    resolveSalesPersonForUser.mockReset();
  });

  it("kierownik może na własną kartę bez sprawdzania grup", async () => {
    profileRow.mockResolvedValue({
      data: { sales_person_id: "sp-own", email: "mgr@example.com" },
    });
    expect(await canAccessSalesPerson(manager, "sp-own")).toBe(true);
  });
});
