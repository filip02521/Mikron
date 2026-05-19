import type { UserRole } from "@/types/database";

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isZakupy(role: UserRole): boolean {
  return role === "zakupy";
}

export function isSales(role: UserRole): boolean {
  return role === "sales";
}

/** Panel dzienny, kolejka, harmonogramy, formularz grupowy */
export function canAccessOperations(role: UserRole): boolean {
  return role === "admin" || role === "zakupy";
}

/** Baza dostawców, urlopy, przeliczanie harmonogramów (bez usuwania dostawcy i kont użytkowników). */
export function canManageSuppliers(role: UserRole): boolean {
  return canAccessOperations(role);
}

const PROCUREMENT_PREFIXES = ["/zakupy"];

const OPERATIONS_PATH_PREFIXES = [
  "/podsumowanie",
  "/kolejka",
  "/historia",
  "/lokalizacje",
  "/zamowienia",
  "/weryfikacja",
  ...PROCUREMENT_PREFIXES,
];

export function homePathForRole(role: UserRole): string {
  if (canAccessOperations(role)) return "/podsumowanie";
  return "/moje";
}

/** Czy rola może wejść na ścieżkę (do przekierowania po logowaniu). */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith("/admin")) return isAdmin(role);
  if (OPERATIONS_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return canAccessOperations(role);
  }
  if (
    pathname.startsWith("/moje") ||
    pathname.startsWith("/plan") ||
    pathname.startsWith("/prosba")
  ) {
    return true;
  }
  return pathname === "/" || pathname === "/login";
}

export function redirectPathAfterLogin(role: UserRole, next: string | null): string {
  const target = next?.trim() || "/";
  if (target !== "/" && canAccessPath(role, target)) return target;
  return homePathForRole(role);
}
