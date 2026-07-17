import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertCanSubmitIndividualOrders } from "./assert-order-submit-access";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";
import type { SessionUser } from "@/lib/auth";

const cookiesMock = vi.fn();
const canAccessSalesPersonMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => cookiesMock(),
}));

vi.mock("@/lib/data/sales-group-access", () => ({
  canAccessSalesPerson: (...args: unknown[]) => canAccessSalesPersonMock(...args),
}));

const adminUser: SessionUser = {
  id: "admin-1",
  email: "admin@firma.pl",
  role: "admin",
  salesPersonId: null,
  mustChangePassword: false,
  salesOnboardingCompletedAt: null,
  assignedWorkspaces: [],
  uniformBackground: false,
  fontScale: "default",
};

describe("assertCanSubmitIndividualOrders", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    canAccessSalesPersonMock.mockReset();
    canAccessSalesPersonMock.mockResolvedValue(true);
  });

  it("blokuje admina w podglądzie handlowca", async () => {
    cookiesMock.mockReturnValue({ get: () => ({ value: "sales" }) });

    await expect(
      assertCanSubmitIndividualOrders(adminUser, [{ salesPersonId: "sp-1" }])
    ).rejects.toThrow(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  });

  it("zezwalają adminowi w kontekście zakupów", async () => {
    cookiesMock.mockReturnValue({ get: () => ({ value: "zakupy" }) });

    await expect(
      assertCanSubmitIndividualOrders(adminUser, [{ salesPersonId: "sp-1" }])
    ).resolves.toBeUndefined();
  });
});
