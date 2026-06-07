import type { UserRole } from "@/types/database";

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isZakupy(role: UserRole): boolean {
  return role === "zakupy";
}

export function isMagazyn(role: UserRole): boolean {
  return role === "magazyn";
}

/** Magazyn i regał — przyjęcie towaru + dziennik dostaw. */
export function canAccessWarehouse(role: UserRole): boolean {
  return role === "admin" || role === "zakupy" || role === "magazyn";
}

export function isSales(role: UserRole): boolean {
  return role === "sales";
}

export function isSalesManager(role: UserRole): boolean {
  return role === "sales_manager";
}

/** Handlowiec lub kierownik — panel /moje, /prosba, /plan */
export function isSalesAccount(role: UserRole): boolean {
  return role === "sales" || role === "sales_manager";
}

export function canManageSalesTeam(role: UserRole): boolean {
  return role === "admin" || role === "sales_manager";
}

export function canViewTeamMemberOrders(role: UserRole): boolean {
  return canManageSalesTeam(role);
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
const SALES_TEAM_PREFIXES = ["/zespol"];

const WAREHOUSE_PATH_PREFIXES = ["/kolejka", "/notatki"];

const OPERATIONS_PATH_PREFIXES = [
  "/podsumowanie",
  "/kolejka",
  "/historia",
  "/lokalizacje",
  "/zamowienia",
  "/weryfikacja",
  ...PROCUREMENT_PREFIXES,
];

const SALES_PATH_PREFIXES = ["/moje", "/plan", "/prosba", "/notatnik", "/tablica"];

export function homePathForRole(role: UserRole): string {
  if (isMagazyn(role)) return "/kolejka";
  if (canAccessOperations(role)) return "/podsumowanie";
  if (isSalesManager(role)) return "/zespol";
  return "/moje";
}

export type CanAccessPathOptions = {
  /** Parametr ?dla= — podgląd notatnika handlowca (admin). */
  previewSalesPersonId?: string | null;
};

/** Czy rola może wejść na ścieżkę (do przekierowania po logowaniu). */
export function canAccessPath(
  role: UserRole,
  pathname: string,
  options?: CanAccessPathOptions
): boolean {
  if (pathname.startsWith("/admin")) return isAdmin(role);
  if (isMagazyn(role)) {
    return WAREHOUSE_PATH_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  }
  if (OPERATIONS_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return canAccessOperations(role);
  }
  if (SALES_TEAM_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return canManageSalesTeam(role);
  }
  if (pathname === "/notatnik" || pathname.startsWith("/notatnik/")) {
    if (isSalesAccount(role)) return true;
    if (isAdmin(role) && options?.previewSalesPersonId?.trim()) return true;
    return false;
  }
  if (pathname === "/notatki" || pathname.startsWith("/notatki/")) {
    return isAdmin(role) || isZakupy(role) || isMagazyn(role);
  }
  if (
    SALES_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return isSalesAccount(role);
  }
  return pathname === "/" || pathname === "/login" || pathname === "/ustaw-haslo";
}

export function redirectPathAfterLogin(role: UserRole, next: string | null): string {
  const target = next?.trim() || "/";
  if (target !== "/" && canAccessPath(role, target)) return target;
  return homePathForRole(role);
}
