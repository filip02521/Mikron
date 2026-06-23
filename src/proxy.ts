import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/database";
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
  canAccessWarehouse,
  canManageSalesTeam,
  homePathForRole,
  isAdmin,
  isSalesAccount,
  redirectPathAfterLogin,
} from "@/lib/auth-roles";
import {
  postLoginEnteringUrl,
  splitInternalRedirectPath,
} from "@/lib/auth/post-login-entering";
import {
  redirectWithSession,
  refreshSupabaseSession,
} from "@/lib/supabase/middleware";

const OPERATIONS_PREFIXES = [
  "/podsumowanie",
  "/weryfikacja",
  "/lokalizacje",
  "/kolejka",
  "/historia",
  "/zamowienia",
  "/notatki",
];

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
      if (profile && !profile.must_change_password) {
        const loginRole = profile.role as UserRole;
        const loginPanelContext = isAdmin(loginRole)
          ? resolveAdminPanelContext(
              request.cookies.get(ADMIN_PANEL_COOKIE)?.value
            )
          : null;
        const loginHome = redirectPathAfterLogin(
          loginRole,
          request.nextUrl.searchParams.get("next"),
          { adminPanelContext: loginPanelContext }
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

  if (
    !canAccessPath(role, pathname, {
      previewSalesPersonId,
      adminPanelContext,
    })
  ) {
    const home =
      isAdmin(role) && adminPanelContext && adminPanelContext !== "admin"
        ? homePathForAdminPanelContext(adminPanelContext)
        : homePathForRole(role);
    return redirectWithSession(request, sessionResponse, home);
  }

  if (matchesPrefix(pathname, ADMIN_PREFIXES) && role !== "admin") {
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role)
    );
  }

  if (
    matchesPrefix(pathname, SALES_TEAM_PREFIXES) &&
    !canManageSalesTeam(role)
  ) {
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role)
    );
  }

  const warehouseExtraPaths =
    canAccessWarehouse(role) &&
    (pathname === "/notatki" ||
      pathname.startsWith("/notatki/") ||
      pathname === "/kolejka" ||
      pathname.startsWith("/kolejka/"));

  if (matchesPrefix(pathname, PROCUREMENT_PREFIXES) && !canAccessOperations(role)) {
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role)
    );
  }

  if (
    matchesPrefix(pathname, OPERATIONS_PREFIXES) &&
    !canAccessOperations(role) &&
    !warehouseExtraPaths
  ) {
    if (pathname.startsWith("/zamowienia")) {
      return redirectWithSession(request, sessionResponse, "/prosba");
    }
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role)
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
