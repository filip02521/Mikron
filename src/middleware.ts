import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/database";
import { fetchProfileByUserId } from "@/lib/auth/profile";
import { middlewareNeedsBootstrap } from "@/lib/setup/middleware-bootstrap";
import {
  canAccessOperations,
  canAccessPath,
  canAccessWarehouse,
  canManageSalesTeam,
  homePathForRole,
  isSalesAccount,
} from "@/lib/auth-roles";
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

const SALES_PREFIXES = ["/moje", "/plan", "/prosba", "/notatnik"];

const SALES_TEAM_PREFIXES = ["/zespol"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicAuthPaths = ["/setup", "/login", "/ustaw-haslo"];

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

  if (publicAuthPaths.includes(pathname)) {
    if (pathname === "/login" && user) {
      const profile = await fetchProfileByUserId(user.id);
      if (profile && !profile.must_change_password) {
        return redirectWithSession(
          request,
          sessionResponse,
          homePathForRole(profile.role as UserRole)
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

  const previewSalesPersonId = request.nextUrl.searchParams.get("dla");
  if (!canAccessPath(role, pathname, { previewSalesPersonId })) {
    return redirectWithSession(
      request,
      sessionResponse,
      homePathForRole(role)
    );
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

  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
