import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireMailCenterAccess, requireMailCenterForMutation } from "./admin-modules";
import { SESSION_REQUIRED_ERROR, type SessionUser } from "@/lib/auth";

const mockGetSessionUser = vi.hoisted(() => vi.fn());
const mockHasMailCenterModuleForUserId = vi.hoisted(() => vi.fn());
const mockAssertAdminNotInReadOnlyPanelPreview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getSessionUser: mockGetSessionUser,
  };
});

vi.mock("@/lib/admin-modules", () => ({
  hasMailCenterModuleForUserId: mockHasMailCenterModuleForUserId,
}));

vi.mock("@/lib/auth/guard-admin-panel-preview", () => ({
  assertAdminNotInReadOnlyPanelPreview: mockAssertAdminNotInReadOnlyPanelPreview,
}));

function sessionUser(
  patch: Partial<SessionUser> = {}
): SessionUser {
  return {
    id: "u1",
    email: "user@example.com",
    role: "sales",
    salesPersonId: null,
    mustChangePassword: false,
    salesOnboardingCompletedAt: null,
    assignedWorkspaces: [],
    uniformBackground: false,
    fontScale: "default",
    ...patch,
  };
}

describe("requireMailCenterAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rzuca brak sesji gdy user nie jest zalogowany", async () => {
    mockGetSessionUser.mockResolvedValue(null);

    await expect(requireMailCenterAccess()).rejects.toThrow(SESSION_REQUIRED_ERROR);
  });

  it("wpuszcza admina bez sprawdzania modułu", async () => {
    const user = sessionUser({ role: "admin" });
    mockGetSessionUser.mockResolvedValue(user);

    await expect(requireMailCenterAccess()).resolves.toEqual(user);
    expect(mockHasMailCenterModuleForUserId).not.toHaveBeenCalled();
  });

  it("blokuje non-admin bez modułu", async () => {
    mockGetSessionUser.mockResolvedValue(sessionUser({ role: "sales" }));
    mockHasMailCenterModuleForUserId.mockResolvedValue(false);

    await expect(requireMailCenterAccess()).rejects.toThrow(
      "Brak uprawnień do Centrum maili"
    );
  });

  it("wpuszcza non-admin z modułem", async () => {
    const user = sessionUser({ role: "sales" });
    mockGetSessionUser.mockResolvedValue(user);
    mockHasMailCenterModuleForUserId.mockResolvedValue(true);

    await expect(requireMailCenterAccess()).resolves.toEqual(user);
    expect(mockHasMailCenterModuleForUserId).toHaveBeenCalledWith("u1");
  });
});

describe("requireMailCenterForMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pozwala adminowi i uruchamia preview guard", async () => {
    const user = sessionUser({ role: "admin" });
    mockGetSessionUser.mockResolvedValue(user);

    await expect(requireMailCenterForMutation()).resolves.toEqual(user);
    expect(mockAssertAdminNotInReadOnlyPanelPreview).toHaveBeenCalledWith(user);
  });

  it("pozwala non-admin z modułem", async () => {
    const user = sessionUser({ role: "sales" });
    mockGetSessionUser.mockResolvedValue(user);
    mockHasMailCenterModuleForUserId.mockResolvedValue(true);

    await expect(requireMailCenterForMutation()).resolves.toEqual(user);
    expect(mockAssertAdminNotInReadOnlyPanelPreview).toHaveBeenCalledWith(user);
  });
});

