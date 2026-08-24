import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

const mockMiddlewareNeedsBootstrap = vi.hoisted(() => vi.fn());
const mockRefreshSupabaseSession = vi.hoisted(() => vi.fn());
const mockFetchProfileByUserId = vi.hoisted(() => vi.fn());
const mockHasMailCenterModuleForUserId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/setup/middleware-bootstrap", () => ({
  middlewareNeedsBootstrap: mockMiddlewareNeedsBootstrap,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  refreshSupabaseSession: mockRefreshSupabaseSession,
  redirectWithSession: (
    request: NextRequest,
    _response: NextResponse,
    path: string,
    params?: Record<string, string>
  ) => {
    const url = new URL(path, request.url);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return NextResponse.redirect(url);
  },
}));

vi.mock("@/lib/auth/profile", () => ({
  fetchProfileByUserId: mockFetchProfileByUserId,
}));

vi.mock("@/lib/admin-modules", () => ({
  hasMailCenterModuleForUserId: mockHasMailCenterModuleForUserId,
}));

function stubSessionResponse() {
  const response = NextResponse.next();
  response.cookies.set("sb", "1");
  return response;
}

describe("proxy mail center module access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMiddlewareNeedsBootstrap.mockResolvedValue(false);
    mockRefreshSupabaseSession.mockResolvedValue({
      response: stubSessionResponse(),
      user: { id: "u1" },
    });
  });

  it("wpuszcza non-admin z modułem na /admin/mail", async () => {
    mockFetchProfileByUserId.mockResolvedValue({
      id: "u1",
      role: "sales",
      assigned_workspaces: [],
      must_change_password: false,
    });
    mockHasMailCenterModuleForUserId.mockResolvedValue(true);

    const response = await proxy(new NextRequest("https://example.com/admin/mail"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mockHasMailCenterModuleForUserId).toHaveBeenCalledWith("u1");
  });

  it("przekazuje x-pathname na request do refreshSupabaseSession", async () => {
    mockFetchProfileByUserId.mockResolvedValue({
      id: "u1",
      role: "admin",
      assigned_workspaces: [],
      must_change_password: false,
    });

    await proxy(new NextRequest("https://example.com/admin/mail/ivoclar_weekly"));

    expect(mockRefreshSupabaseSession).toHaveBeenCalled();
    const reqArg = mockRefreshSupabaseSession.mock.calls[0]?.[0] as NextRequest;
    expect(reqArg.headers.get("x-pathname")).toBe("/admin/mail/ivoclar_weekly");
  });

  it("redirectuje non-admin bez modułu z /admin/mail", async () => {
    mockFetchProfileByUserId.mockResolvedValue({
      id: "u1",
      role: "sales",
      assigned_workspaces: [],
      must_change_password: false,
    });
    mockHasMailCenterModuleForUserId.mockResolvedValue(false);

    const response = await proxy(new NextRequest("https://example.com/admin/mail"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/podsumowanie");
  });

  it("legacy /zakupy/raporty-ivoclar z modułem → /admin/mail", async () => {
    mockFetchProfileByUserId.mockResolvedValue({
      id: "u1",
      role: "sales",
      assigned_workspaces: [],
      must_change_password: false,
    });
    mockHasMailCenterModuleForUserId.mockResolvedValue(true);

    const response = await proxy(
      new NextRequest("https://example.com/zakupy/raporty-ivoclar")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/admin/mail");
  });

  it("legacy /zakupy/raporty-ivoclar bez modułu wpuszcza (komunikat na stronie)", async () => {
    mockFetchProfileByUserId.mockResolvedValue({
      id: "u1",
      role: "sales",
      assigned_workspaces: [],
      must_change_password: false,
    });
    mockHasMailCenterModuleForUserId.mockResolvedValue(false);

    const response = await proxy(
      new NextRequest("https://example.com/zakupy/raporty-ivoclar")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

