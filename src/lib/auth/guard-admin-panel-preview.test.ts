import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertAdminNotInReadOnlyPanelPreview,
  assertAdminPanelAllowsProcurementBoardMutations,
  assertAdminPanelAllowsOperationsMutations,
  assertAdminPanelAllowsWarehouseMutations,
} from "@/lib/auth/guard-admin-panel-preview";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";

const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => cookiesMock(),
}));

describe("guard admin panel preview", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
  });

  it("blokuje mutacje poza kontekstem admin", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "zakupy" }),
    });

    await expect(
      assertAdminNotInReadOnlyPanelPreview({ role: "admin" })
    ).rejects.toThrow(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  });

  it("zezwalają na mutacje tablicy w podglądzie zakupów", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "zakupy" }),
    });

    await expect(
      assertAdminPanelAllowsProcurementBoardMutations({ role: "admin" })
    ).resolves.toBeUndefined();
  });

  it("blokują mutacje tablicy w podglądzie handlowca", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "sales" }),
    });

    await expect(
      assertAdminPanelAllowsProcurementBoardMutations({ role: "admin" })
    ).rejects.toThrow(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  });

  it("zezwalają na mutacje operacji w podglądzie zakupów", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "zakupy" }),
    });

    await expect(
      assertAdminPanelAllowsOperationsMutations({ role: "admin" })
    ).resolves.toBeUndefined();
  });

  it("blokują mutacje operacji w podglądzie magazynu", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "magazyn" }),
    });

    await expect(
      assertAdminPanelAllowsOperationsMutations({ role: "admin" })
    ).rejects.toThrow(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  });

  it("zezwalają na mutacje magazynu w podglądzie zakupów", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "zakupy" }),
    });

    await expect(
      assertAdminPanelAllowsWarehouseMutations({ role: "admin" })
    ).resolves.toBeUndefined();
  });

  it("blokują mutacje magazynu w podglądzie magazynu", async () => {
    cookiesMock.mockReturnValue({
      get: () => ({ value: "magazyn" }),
    });

    await expect(
      assertAdminPanelAllowsWarehouseMutations({ role: "admin" })
    ).rejects.toThrow(ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED);
  });
});
