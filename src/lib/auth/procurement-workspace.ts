import type { UserRole } from "@/types/database";
import { isAdmin } from "@/lib/auth-roles";

/** Funkcja zakupowa przypisana do konta (na razie z roli w DB). */
export type ProcurementFunction = "dostawy" | "zeby";

/** Aktywny obszar pracy w sesji (cookie). */
export type ProcurementWorkspace = ProcurementFunction;

export const PROCUREMENT_WORKSPACE_COOKIE = "ontime_procurement_workspace";

const VALID_WORKSPACES: ProcurementWorkspace[] = ["dostawy", "zeby"];

export function parseProcurementWorkspace(
  raw: string | undefined | null
): ProcurementWorkspace | null {
  if (!raw) return null;
  return VALID_WORKSPACES.includes(raw as ProcurementWorkspace)
    ? (raw as ProcurementWorkspace)
    : null;
}

/** Funkcje zakupowe dostępne dla roli (granty czasowe — faza późniejsza). */
export function grantedProcurementFunctions(role: UserRole): ProcurementFunction[] {
  if (isAdmin(role)) return ["dostawy", "zeby"];
  if (role === "zakupy_zeby") return ["dostawy", "zeby"];
  if (role === "zakupy") return ["dostawy"];
  return [];
}

export function hasProcurementFunction(
  role: UserRole,
  fn: ProcurementFunction
): boolean {
  return grantedProcurementFunctions(role).includes(fn);
}

export function canSwitchProcurementWorkspace(role: UserRole): boolean {
  return grantedProcurementFunctions(role).length > 1;
}

/** Domyślny obszar po logowaniu / bez cookie. */
export function defaultProcurementWorkspace(role: UserRole): ProcurementWorkspace | null {
  const fns = grantedProcurementFunctions(role);
  if (fns.length === 0) return null;
  if (role === "zakupy_zeby" || (fns.includes("zeby") && !fns.includes("dostawy"))) {
    return "zeby";
  }
  return "dostawy";
}

export function resolveProcurementWorkspace(
  role: UserRole,
  rawCookie: string | undefined | null
): ProcurementWorkspace | null {
  const fns = grantedProcurementFunctions(role);
  if (fns.length === 0) return null;
  const parsed = parseProcurementWorkspace(rawCookie);
  if (parsed && fns.includes(parsed)) return parsed;
  return defaultProcurementWorkspace(role);
}

export function homePathForProcurementWorkspace(workspace: ProcurementWorkspace): string {
  return workspace === "zeby" ? "/zeby/kolejka" : "/podsumowanie";
}

export function homePathForUser(
  role: UserRole,
  workspace: ProcurementWorkspace | null
): string {
  if (workspace) return homePathForProcurementWorkspace(workspace);
  if (role === "zakupy_zeby") return "/zeby/kolejka";
  return role === "magazyn" ? "/kolejka" : "/podsumowanie";
}

export function labelForProcurementWorkspace(workspace: ProcurementWorkspace): string {
  return workspace === "zeby" ? "Zęby" : "Dostawy";
}

export function subtitleForProcurementWorkspace(
  workspace: ProcurementWorkspace | null
): string | null {
  if (workspace === "zeby") return "Zęby syntetyczne";
  return null;
}

export const PROCUREMENT_WORKSPACE_OPTIONS: {
  value: ProcurementWorkspace;
  label: string;
  title: string;
}[] = [
  {
    value: "dostawy",
    label: "Dostawy",
    title: "Panel dzienny, weryfikacja i przyjęcie towaru",
  },
  {
    value: "zeby",
    label: "Zęby",
    title: "Kolejka, przyjęcie i historia zębów",
  },
];

export const PROCUREMENT_WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function buildProcurementWorkspaceCookie(workspace: ProcurementWorkspace) {
  return {
    name: PROCUREMENT_WORKSPACE_COOKIE,
    value: workspace,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PROCUREMENT_WORKSPACE_COOKIE_MAX_AGE,
  };
}

/** Wspólne ścieżki obu obszarów zakupów (tablica, notatki, karty/urlopy). */
const PROCUREMENT_SHARED_PATH_PREFIXES = [
  "/notatki",
  "/zakupy/tablica",
  "/zakupy/dostawcy",
  "/zakupy/urlopy",
];

const DOSTAWY_WORKSPACE_PATH_PREFIXES = [
  "/podsumowanie",
  "/weryfikacja",
  "/lokalizacje",
  "/kolejka",
  "/dostawy",
  "/historia",
  "/zamowienia",
];

const ZEBY_WORKSPACE_PATH_PREFIXES = ["/zeby"];

function matchesPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Czy ścieżka należy do aktywnego obszaru pracy (dla kont z przełącznikiem). */
export function pathAllowedForProcurementWorkspace(
  pathname: string,
  workspace: ProcurementWorkspace
): boolean {
  if (matchesPathPrefix(pathname, PROCUREMENT_SHARED_PATH_PREFIXES)) return true;
  if (workspace === "zeby") {
    return matchesPathPrefix(pathname, ZEBY_WORKSPACE_PATH_PREFIXES);
  }
  return matchesPathPrefix(pathname, DOSTAWY_WORKSPACE_PATH_PREFIXES);
}
