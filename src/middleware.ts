import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/database";
import { fetchProfileByUserId } from "@/lib/auth/profile";
import { middlewareNeedsBootstrap } from "@/lib/setup/middleware-bootstrap";

const OPERATIONS_PREFIXES = [
  "/podsumowanie",
  "/weryfikacja",
  "/lokalizacje",
  "/kolejka",
  "/historia",
  "/zamowienia",
];

const ADMIN_PREFIXES = ["/admin"];

const PROCUREMENT_PREFIXES = ["/zakupy"];

const SALES_PREFIXES = ["/moje", "/plan", "/prosba"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function canAccessOperations(role: UserRole): boolean {
  return role === "admin" || role === "zakupy";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pierwsza konfiguracja — dopóki nie ma admina w bazie, tylko /setup
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

  if (publicAuthPaths.includes(pathname)) {
    return NextResponse.next();
  }

  const isProtected =
    matchesPrefix(pathname, OPERATIONS_PREFIXES) ||
    matchesPrefix(pathname, PROCUREMENT_PREFIXES) ||
    matchesPrefix(pathname, ADMIN_PREFIXES) ||
    matchesPrefix(pathname, SALES_PREFIXES);

  if (!isProtected) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const profile = await fetchProfileByUserId(user.id);

  if (!profile) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  const role = profile.role;

  if (matchesPrefix(pathname, ADMIN_PREFIXES) && role !== "admin") {
    return NextResponse.redirect(
      new URL(canAccessOperations(role) ? "/podsumowanie" : "/moje", request.url)
    );
  }

  if (
    (matchesPrefix(pathname, OPERATIONS_PREFIXES) ||
      matchesPrefix(pathname, PROCUREMENT_PREFIXES)) &&
    !canAccessOperations(role)
  ) {
    if (pathname.startsWith("/zamowienia")) {
      return NextResponse.redirect(new URL("/prosba", request.url));
    }
    return NextResponse.redirect(new URL("/moje", request.url));
  }

  if (role === "sales" && pathname.startsWith("/zamowienia/nowe")) {
    return NextResponse.redirect(new URL("/prosba", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
