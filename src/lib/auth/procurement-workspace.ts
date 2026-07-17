import type { UserRole, Workspace } from "@/types/database";
import { isAdmin } from "@/lib/auth-roles";

/** Obszar roboczy przypisany do konta (z profiles.assigned_workspaces). */
export type ProcurementFunction = Workspace;

/** Aktywny obszar pracy w sesji (cookie). */
export type ProcurementWorkspace = Workspace;

export const PROCUREMENT_WORKSPACE_COOKIE = "ontime_procurement_workspace";

const VALID_WORKSPACES: ProcurementWorkspace[] = ["dostawy", "zeby", "magazyn"];

export function parseProcurementWorkspace(
  raw: string | undefined | null
): ProcurementWorkspace | null {
  if (!raw) return null;
  return VALID_WORKSPACES.includes(raw as ProcurementWorkspace)
    ? (raw as ProcurementWorkspace)
    : null;
}

/** Obszary robocze dostępne dla roli (fallback z roli gdy brak assigned_workspaces). */
export function grantedProcurementFunctions(role: UserRole, workspaces?: Workspace[]): ProcurementFunction[] {
  if (workspaces && workspaces.length > 0) return workspaces;
  if (isAdmin(role)) return ["dostawy", "zeby", "magazyn"];
  if (role === "zakupy_zeby") return ["dostawy", "zeby"];
  if (role === "zakupy") return ["dostawy"];
  if (role === "magazyn") return ["magazyn"];
  return [];
}

export function hasProcurementFunction(
  role: UserRole,
  fn: ProcurementFunction,
  workspaces?: Workspace[]
): boolean {
  return grantedProcurementFunctions(role, workspaces).includes(fn);
}

export function canSwitchProcurementWorkspace(role: UserRole, workspaces?: Workspace[]): boolean {
  return grantedProcurementFunctions(role, workspaces).length > 1;
}

/** Domyślny obszar po logowaniu / bez cookie. */
export function defaultProcurementWorkspace(role: UserRole, workspaces?: Workspace[]): ProcurementWorkspace | null {
  const fns = grantedProcurementFunctions(role, workspaces);
  if (fns.length === 0) return null;
  if (fns.includes("zeby")) return "zeby";
  if (fns.includes("dostawy")) return "dostawy";
  return "magazyn";
}

export function resolveProcurementWorkspace(
  role: UserRole,
  rawCookie: string | undefined | null,
  workspaces?: Workspace[]
): ProcurementWorkspace | null {
  const fns = grantedProcurementFunctions(role, workspaces);
  if (fns.length === 0) return null;
  const parsed = parseProcurementWorkspace(rawCookie);
  if (parsed && fns.includes(parsed)) return parsed;
  return defaultProcurementWorkspace(role, workspaces);
}

export function homePathForProcurementWorkspace(workspace: ProcurementWorkspace): string {
  switch (workspace) {
    case "zeby":
      return "/zeby/kolejka";
    case "magazyn":
      return "/kolejka";
    case "dostawy":
      return "/podsumowanie";
  }
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
  switch (workspace) {
    case "zeby":
      return "Zęby";
    case "magazyn":
      return "Magazyn";
    case "dostawy":
      return "Dostawy";
  }
}

export function subtitleForProcurementWorkspace(
  workspace: ProcurementWorkspace | null
): string | null {
  if (workspace === "zeby") return "Zęby syntetyczne";
  if (workspace === "magazyn") return "Przyjęcie towaru i dostawy";
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
  {
    value: "magazyn",
    label: "Magazyn",
    title: "Przyjęcie towaru i dziennik dostaw",
  },
];

export const PROCUREMENT_WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function buildProcurementWorkspaceCookie(workspace: ProcurementWorkspace) {
  return {
    name: PROCUREMENT_WORKSPACE_COOKIE,
    value: workspace,
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: PROCUREMENT_WORKSPACE_COOKIE_MAX_AGE,
  };
}

/** Wspólne ścieżki wszystkich obszarów zakupów (tablica, notatki, karty/urlopy). */
const PROCUREMENT_SHARED_PATH_PREFIXES = [
  "/notatki",
  "/zakupy/tablica",
  "/zakupy/dostawcy",
  "/zakupy/urlopy",
  "/ustawienia",
  "/urlopy",
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

const MAGAZYN_WORKSPACE_PATH_PREFIXES = [
  "/kolejka",
  "/dostawy",
];

function matchesPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Czy ścieżka należy do aktywnego obszaru pracy (dla kont z przełącznikiem). */
export function pathAllowedForProcurementWorkspace(
  pathname: string,
  workspace: ProcurementWorkspace
): boolean {
  if (matchesPathPrefix(pathname, PROCUREMENT_SHARED_PATH_PREFIXES)) return true;
  switch (workspace) {
    case "zeby":
      return matchesPathPrefix(pathname, ZEBY_WORKSPACE_PATH_PREFIXES);
    case "magazyn":
      return matchesPathPrefix(pathname, MAGAZYN_WORKSPACE_PATH_PREFIXES);
    case "dostawy":
      return matchesPathPrefix(pathname, DOSTAWY_WORKSPACE_PATH_PREFIXES);
  }
}
