import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import { homePathForAdminPanelContext } from "@/lib/auth/admin-panel-context";
import {
  canSwitchProcurementWorkspace,
  hasProcurementFunction,
  homePathForUser,
  pathAllowedForProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import type { ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
import type { UserRole, Workspace } from "@/types/database";

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isZakupy(role: UserRole): boolean {
  return role === "zakupy";
}

export function isZakupyZeby(role: UserRole): boolean {
  return role === "zakupy_zeby";
}

/** Dostęp do toru zębów — funkcja zeby na koncie (admin zawsze). */
export function canAccessTeethPanel(role: UserRole, workspaces?: Workspace[]): boolean {
  if (workspaces && workspaces.length > 0) return workspaces.includes("zeby");
  return isAdmin(role) || hasProcurementFunction(role, "zeby");
}

export function isMagazyn(role: UserRole, workspaces?: Workspace[]): boolean {
  if (workspaces && workspaces.length > 0)
    return workspaces.includes("magazyn") && !workspaces.includes("dostawy");
  return role === "magazyn";
}

/** Magazyn i regał — przyjęcie towaru + dziennik dostaw. */
export function canAccessWarehouse(role: UserRole, workspaces?: Workspace[]): boolean {
  if (workspaces && workspaces.length > 0)
    return workspaces.includes("dostawy") || workspaces.includes("magazyn");
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

/** Panel dzienny, kolejka towaru, harmonogramy PL/ZA, formularz grupowy */
export function canAccessOperations(role: UserRole, workspaces?: Workspace[]): boolean {
  if (workspaces && workspaces.length > 0) return workspaces.includes("dostawy");
  return isAdmin(role) || hasProcurementFunction(role, "dostawy");
}

/** Baza dostawców i urlopy (tor dzienny lub zęby). */
export function canManageSuppliers(role: UserRole, workspaces?: Workspace[]): boolean {
  if (workspaces && workspaces.length > 0)
    return workspaces.includes("dostawy") || workspaces.includes("zeby");
  return canAccessOperations(role) || hasProcurementFunction(role, "zeby");
}

const PROCUREMENT_PREFIXES = ["/zakupy"];
const SALES_TEAM_PREFIXES = ["/zespol"];

const WAREHOUSE_PATH_PREFIXES = ["/kolejka", "/dostawy", "/notatki", "/ustawienia"];

const OPERATIONS_PATH_PREFIXES = [
  "/podsumowanie",
  "/kolejka",
  "/dostawy",
  "/historia",
  "/lokalizacje",
  "/zamowienia",
  "/weryfikacja",
  ...PROCUREMENT_PREFIXES,
];

const SALES_PATH_PREFIXES = ["/moje", "/plan", "/prosba", "/notatnik", "/zk", "/tablica"];

/** Domyślna strona startowa handlowca po logowaniu. */
export const SALES_HOME_PATH = "/moje";

export function homePathForRole(role: UserRole, workspaces?: Workspace[]): string {
  if (workspaces && workspaces.length > 0) {
    if (workspaces.includes("dostawy")) return "/podsumowanie";
    if (workspaces.includes("zeby")) return "/zeby/kolejka";
    if (workspaces.includes("magazyn")) return "/kolejka";
  }
  if (isMagazyn(role)) return "/kolejka";
  if (isZakupyZeby(role)) return "/zeby/kolejka";
  if (canAccessOperations(role)) return "/podsumowanie";
  return SALES_HOME_PATH;
}

export type CanAccessPathOptions = {
  /** Parametr ?dla= — podgląd panelu handlowca (admin / kierownik). */
  previewSalesPersonId?: string | null;
  /** Tryb podglądu panelu (tylko admin, cookie). */
  adminPanelContext?: AdminPanelContext | null;
  /** Aktywny obszar pracy — ogranicza URL dla kont z przełącznikiem. */
  procurementWorkspace?: ProcurementWorkspace | null;
  /** Przypisane obszary robocze (z profiles.assigned_workspaces). */
  workspaces?: Workspace[];
};

function canAccessPathForRole(
  role: UserRole,
  pathname: string,
  options?: CanAccessPathOptions
): boolean {
  const ws = options?.workspaces;

  if (isAdmin(role) && options?.adminPanelContext && options.adminPanelContext !== "admin") {
    if (pathname === "/admin/wybor-handlowca") return true;
    return canAccessPathForRole(options.adminPanelContext, pathname, {
      previewSalesPersonId: options.previewSalesPersonId,
    });
  }

  if (pathname.startsWith("/admin")) return isAdmin(role);
  if (pathname === "/zeby" || pathname.startsWith("/zeby/")) {
    return canAccessTeethPanel(role, ws);
  }
  if (pathname === "/zakupy/tablica" || pathname.startsWith("/zakupy/tablica/")) {
    return canAccessOperations(role, ws) || canAccessTeethPanel(role, ws);
  }
  if (
    pathname.startsWith("/zakupy/dostawcy") ||
    pathname.startsWith("/zakupy/urlopy")
  ) {
    return canManageSuppliers(role, ws);
  }
  if (isMagazyn(role, ws)) {
    return WAREHOUSE_PATH_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  }
  if (OPERATIONS_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return canAccessOperations(role, ws);
  }
  if (SALES_TEAM_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return canManageSalesTeam(role);
  }
  if (pathname === "/notatki" || pathname.startsWith("/notatki/")) {
    return canAccessOperations(role, ws) || isMagazyn(role, ws) || canAccessTeethPanel(role, ws);
  }
  if (
    SALES_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    if (isSalesAccount(role)) return true;
    if (isAdmin(role) && options?.previewSalesPersonId?.trim()) return true;
    return false;
  }
  return pathname === "/" || pathname === "/login" || pathname === "/ustaw-haslo" || pathname === "/ustawienia";
}

/** Czy rola może wejść na ścieżkę (do przekierowania po logowaniu). */
export function canAccessPath(
  role: UserRole,
  pathname: string,
  options?: CanAccessPathOptions
): boolean {
  if (!canAccessPathForRole(role, pathname, options)) return false;
  const workspace = options?.procurementWorkspace;
  const ws = options?.workspaces;
  if (workspace && canSwitchProcurementWorkspace(role, ws)) {
    return pathAllowedForProcurementWorkspace(pathname, workspace);
  }
  return true;
}

export function redirectPathAfterLogin(
  role: UserRole,
  next: string | null,
  options?: {
    adminPanelContext?: AdminPanelContext | null;
    procurementWorkspace?: ProcurementWorkspace | null;
    workspaces?: Workspace[];
  }
): string {
  const adminPanelContext = options?.adminPanelContext ?? null;
  const procurementWorkspace = options?.procurementWorkspace ?? null;
  const workspaces = options?.workspaces;
  const target = next?.trim() || "/";
  const targetPath = target.split("?")[0] ?? target;
  if (
    target !== "/" &&
    canAccessPath(role, targetPath, { adminPanelContext, procurementWorkspace, workspaces })
  ) {
    return target;
  }
  if (isAdmin(role) && adminPanelContext && adminPanelContext !== "admin") {
    return homePathForAdminPanelContext(adminPanelContext);
  }
  if (isSalesAccount(role)) return SALES_HOME_PATH;
  if (procurementWorkspace) return homePathForUser(role, procurementWorkspace);
  return homePathForRole(role, workspaces);
}
