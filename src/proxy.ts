import { NextResponse, type NextRequest } from "next/server";
import type { UserRole, Workspace } from "@/types/database";
import { fetchProfileByUserId } from "@/lib/auth/profile";
import { middlewareNeedsBootstrap } from "@/lib/setup/middleware-bootstrap";
import {
  ADMIN_PANEL_COOKIE,
  homePathForAdminPanelContext,
  parsePreviewSalesPersonCookie,
  PREVIEW_SALES_PERSON_COOKIE,
  previewSalesPersonCookieOptions,
  resolveAdminPanelContext,
  shouldApplyAdminSalesPreviewHeader,
} from "@/lib/auth/admin-panel-context";
import {
  canAccessOperations,
  canAccessPath,
  canAccessTeethPanel,
  canAccessWarehouse,
  canManageSalesTeam,
  canManageSuppliers,
  homePathForRole,
  isAdmin,
  isSalesAccount,
  redirectPathAfterLogin,
} from "@/lib/auth-roles";
import {
  homePathForUser,
  PROCUREMENT_WORKSPACE_COOKIE,
  buildProcurementWorkspaceCookie,
  grantedProcurementFunctions,
  parseProcurementWorkspace,
  resolveProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import {
  postLoginEnteringUrl,
  splitInternalRedirectPath,
} from "@/lib/auth/post-login-entering";
import {
  redirectWithSession,
  refreshSupabaseSession,
} from "@/lib/supabase/middleware";
import {
  isPasswordChangeExemptApiPath,
  MUST_CHANGE_PASSWORD_MESSAGE,
} from "@/lib/auth/must-change-password-guard";

const OPERATIONS_PREFIXES = [
  "/podsumowanie",
  "/weryfikacja",
  "/lokalizacje",
  "/kolejka",
  "/dostawy",
  "/historia",
  "/zamowienia",
  "/notatki",
];

const TEETH_PREFIXES = ["/zeby"];

const ADMIN_PREFIXES = ["/admin"];

const PROCUREMENT_PREFIXES = ["/zakupy"];

const SALES_PREFIXES = ["/moje", "/plan", "/prosba", "/notatnik", "/zk", "/tablica"];

const SALES_TEAM_PREFIXES = ["/zespol"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicAuthPaths = ["/setup", "/login", "/ustaw-haslo", "/auth/confirm"];

  const needsSetup = await middlewareNeedsBootstrap();
  if (needsSetup) {
    if (pathname !== "/setup") {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/setup") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { response: sessionResponse, user } = await refreshSupabaseSession(request);
  sessionResponse.headers.set("x-pathname", pathname);

  if (
    pathname.startsWith("/api/") &&
    user &&
    !isPasswordChangeExemptApiPath(pathname)
  ) {
    const profile = await fetchProfileByUserId(user.id);
    if (profile?.must_change_password) {
      const blocked = NextResponse.json(
        { error: MUST_CHANGE_PASSWORD_MESSAGE },
        { status: 403 }
      );
      for (const cookie of sessionResponse.cookies.getAll()) {
        blocked.cookies.set(cookie.name, cookie.value);
      }
      return blocked;
    }
  }

  if (pathname === "/auth/entering") {
    if (!user) {
      const next = request.nextUrl.searchParams.get("next");
      return redirectWithSession(request, sessionResponse, "/login", {
        ...(next ? { next } : {}),
      });
    }
    return sessionResponse;
  }

  if (publicAuthPaths.includes(pathname)) {
    if (pathname === "/login" && user) {
      const profile = await fetchProfileByUserId(user.id);
      if (profile?.must_change_password) {
        return redirectWithSession(request, sessionResponse, "/ustaw-haslo", {
          wymagane: "1",
        });
      }
      if (profile && !profile.must_change_password) {
        const loginRole = profile.role as UserRole;
        const loginPanelContext = isAdmin(loginRole)
          ? resolveAdminPanelContext(
              request.cookies.get(ADMIN_PANEL_COOKIE)?.value
            )
          : null;
        const loginWorkspaces = (profile.assigned_workspaces ?? []) as Workspace[];
        const loginHome = redirectPathAfterLogin(
          loginRole,
          request.nextUrl.searchParams.get("next"),
          {
            adminPanelContext: loginPanelContext,
            procurementWorkspace: resolveProcurementWorkspace(
              loginRole,
              request.cookies.get(PROCUREMENT_WORKSPACE_COOKIE)?.value,
              loginWorkspaces
            ),
            workspaces: loginWorkspaces,
          }
        );
        const entering = splitInternalRedirectPath(postLoginEnteringUrl(loginHome));
        return redirectWithSession(
          request,
          sessionResponse,
          entering.pathname,
          entering.searchParams
        );
      }
    }
    return sessionResponse;
  }

  const isProtected =
    matchesPrefix(pathname, OPERATIONS_PREFIXES) ||
    matchesPrefix(pathname, PROCUREMENT_PREFIXES) ||
    matchesPrefix(pathname, TEETH_PREFIXES) ||
    matchesPrefix(pathname, ADMIN_PREFIXES) ||
    matchesPrefix(pathname, SALES_PREFIXES) ||
    matchesPrefix(pathname, SALES_TEAM_PREFIXES);

  if (!isProtected) {
    return sessionResponse;
  }

  if (!user) {
    return redirectWithSession(request, sessionResponse, "/login", {
      next: pathname,
      reason: "session",
    });
  }

  const profile = await fetchProfileByUserId(user.id);

  if (!profile) {
    return redirectWithSession(request, sessionResponse, "/login", {
      reason: "session",
    });
  }

  const role = profile.role as UserRole;
  const workspaces = (profile.assigned_workspaces ?? []) as Workspace[];

  if (
    profile.must_change_password &&
    pathname !== "/ustaw-haslo" &&
    !pathname.startsWith("/api/")
  ) {
    return redirectWithSession(request, sessionResponse, "/ustaw-haslo", {
      wymagane: "1",
    });
  }

  const previewSalesPersonIdFromUrl = request.nextUrl.searchParams.get("dla");
  const adminPanelContext = isAdmin(role)
    ? resolveAdminPanelContext(request.cookies.get(ADMIN_PANEL_COOKIE)?.value)
    : null;
  const previewSalesPersonIdFromCookie =
    isAdmin(role) && adminPanelContext === "sales"
      ? parsePreviewSalesPersonCookie(
          request.cookies.get(PREVIEW_SALES_PERSON_COOKIE)?.value
        )
      : null;
  const previewSalesPersonId =
    previewSalesPersonIdFromUrl?.trim() || previewSalesPersonIdFromCookie;

  if (
    isAdmin(role) &&
    adminPanelContext === "sales" &&
    matchesPrefix(pathname, SALES_PREFIXES) &&
    !previewSalesPersonIdFromUrl?.trim() &&
    pathname !== "/admin/wybor-handlowca"
  ) {
    if (previewSalesPersonIdFromCookie) {
      const url = request.nextUrl.clone();
      url.searchParams.set("dla", previewSalesPersonIdFromCookie);
      return redirectWithSession(
        request,
        sessionResponse,
        `${url.pathname}${url.search}`
      );
    }
    return redirectWithSession(
      request,
      sessionResponse,
      "/admin/wybor-handlowca"
    );
  }

  const procurementWorkspace = isAdmin(role)
    ? null
    : resolveProcurementWorkspace(
        role,
        request.cookies.get(PROCUREMENT_WORKSPACE_COOKIE)?.value,
        workspaces
      );

  if (
    !canAccessPath(role, pathname, {
      previewSalesPersonId,
      adminPanelContext,
      procurementWorkspace,
      workspaces,
    })
  ) {
    const home =
      isAdmin(role) && adminPanelContext && adminPanelContext !== "admin"
        ? homePathForAdminPanelContext(adminPanelContext)
        : homePathForUser(role, procurementWorkspace);
    return redirectWithSession(request, sessionResponse, home);
  }

  if (
    !isAdmin(role) &&
    grantedProcurementFunctions(role, workspaces).length > 0 &&
    procurementWorkspace &&
    !parseProcurementWorkspace(request.cookies.get(PROCUREMENT_WORKSPACE_COOKIE)?.value)
  ) {
    sessionResponse.cookies.set(buildProcurementWorkspaceCookie(procurementWorkspace));
  }

  if (matchesPrefix(pathname, ADMIN_PREFIXES) && role !== "admin") {
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role, workspaces)
    );
  }

  if (
    matchesPrefix(pathname, SALES_TEAM_PREFIXES) &&
    pathname !== "/zespol/urlopy" &&
    !canManageSalesTeam(role)
  ) {
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role, workspaces)
    );
  }

  const warehouseExtraPaths =
    canAccessWarehouse(role, workspaces) &&
    (pathname === "/notatki" ||
      pathname.startsWith("/notatki/") ||
      pathname === "/kolejka" ||
      pathname.startsWith("/kolejka/") ||
      pathname === "/dostawy" ||
      pathname.startsWith("/dostawy/"));

  if (
    matchesPrefix(pathname, TEETH_PREFIXES) &&
    !canAccessTeethPanel(role, workspaces)
  ) {
    return redirectWithSession(request, sessionResponse, homePathForRole(role, workspaces));
  }

  if (matchesPrefix(pathname, PROCUREMENT_PREFIXES) && !canAccessOperations(role, workspaces)) {
    if (
      pathname.startsWith("/zakupy/dostawcy") ||
      pathname.startsWith("/zakupy/urlopy")
    ) {
      if (!canManageSuppliers(role, workspaces)) {
        return redirectWithSession(request, sessionResponse, homePathForRole(role, workspaces));
      }
    } else {
      return redirectWithSession(request, sessionResponse, homePathForRole(role, workspaces));
    }
  }

  if (
    matchesPrefix(pathname, OPERATIONS_PREFIXES) &&
    !canAccessOperations(role, workspaces) &&
    !warehouseExtraPaths &&
    !(pathname === "/notatki" && canAccessTeethPanel(role, workspaces))
  ) {
    if (pathname.startsWith("/zamowienia")) {
      return redirectWithSession(request, sessionResponse, "/prosba");
    }
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role, workspaces)
    );
  }

  if (isSalesAccount(role) && pathname.startsWith("/zamowienia/nowe")) {
    return redirectWithSession(request, sessionResponse, "/prosba");
  }

  if (
    shouldApplyAdminSalesPreviewHeader(adminPanelContext, previewSalesPersonId) &&
    isAdmin(role)
  ) {
    sessionResponse.headers.set(
      "x-preview-sales-person-id",
      previewSalesPersonId!
    );
  }

  const urlPreviewId = previewSalesPersonIdFromUrl?.trim();
  if (
    isAdmin(role) &&
    adminPanelContext === "sales" &&
    urlPreviewId &&
    urlPreviewId !== previewSalesPersonIdFromCookie
  ) {
    sessionResponse.cookies.set(previewSalesPersonCookieOptions(urlPreviewId));
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
