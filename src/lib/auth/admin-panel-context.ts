import type { UserRole } from "@/types/database";
import { isAdmin } from "@/lib/auth-roles";

/** Kontekst podglądu panelu — tylko dla administratora (cookie, nie zmiana roli w DB). */
export type AdminPanelContext =
  | "admin"
  | "zakupy"
  | "magazyn"
  | "sales"
  | "sales_manager";

export const ADMIN_PANEL_COOKIE = "ontime_admin_panel";

const VALID_CONTEXTS: AdminPanelContext[] = [
  "admin",
  "zakupy",
  "magazyn",
  "sales",
  "sales_manager",
];

export function parseAdminPanelContext(
  raw: string | undefined | null
): AdminPanelContext | null {
  if (!raw) return null;
  return VALID_CONTEXTS.includes(raw as AdminPanelContext)
    ? (raw as AdminPanelContext)
    : null;
}

/** Domyślny kontekst admina bez cookie — pełny panel administracyjny. */
export function resolveAdminPanelContext(
  raw: string | undefined | null
): AdminPanelContext {
  return parseAdminPanelContext(raw) ?? "admin";
}

export function homePathForAdminPanelContext(context: AdminPanelContext): string {
  switch (context) {
    case "admin":
      return "/admin";
    case "zakupy":
      return "/podsumowanie";
    case "magazyn":
      return "/kolejka";
    case "sales":
      return "/admin/wybor-handlowca";
    case "sales_manager":
      return "/zespol";
  }
}

export function labelForAdminPanelContext(context: AdminPanelContext): string {
  switch (context) {
    case "admin":
      return "Administracja";
    case "zakupy":
      return "Zakupy";
    case "magazyn":
      return "Magazyn";
    case "sales":
      return "Handlowiec";
    case "sales_manager":
      return "Zespół";
  }
}

/** Rola używana do nawigacji i badge'y w trybie podglądu. */
export function navRoleForAdminPanelContext(context: AdminPanelContext): UserRole {
  if (context === "admin") return "admin";
  return context;
}

export function effectiveNavRole(
  realRole: UserRole,
  panelContext: AdminPanelContext | null
): UserRole {
  if (!isAdmin(realRole)) return realRole;
  const ctx = panelContext ?? "admin";
  if (ctx === "admin") return "admin";
  return navRoleForAdminPanelContext(ctx);
}

export function isAdminPanelPreview(
  realRole: UserRole | null | undefined,
  panelContext: AdminPanelContext | null | undefined
): boolean {
  return Boolean(
    realRole && isAdmin(realRole) && panelContext != null && panelContext !== "admin"
  );
}

/** Alias — tryb podglądu bez mutacji w UI panelu handlowca / zespołu / magazynu. */
export function isAdminReadOnlyPanelPreview(
  realRole: UserRole | null | undefined,
  panelContext: AdminPanelContext | null | undefined
): boolean {
  return isAdminPanelPreview(realRole, panelContext);
}

/**
 * UI read-only dla operacji zakupowych i magazynu.
 * Podgląd „Zakupy” to realna praca operacyjna (zgodnie z assertAdminPanelAllowsOperationsMutations).
 */
export function isAdminOperationsPreviewReadOnly(
  realRole: UserRole | null | undefined,
  panelContext: AdminPanelContext | null | undefined
): boolean {
  if (!isAdminPanelPreview(realRole, panelContext)) return false;
  return panelContext !== "zakupy";
}

/**
 * Podgląd handlowca w sidebarze / nagłówku — tylko gdy cookie panelu to „sales”
 * i w URL jest ?dla= (nagłówek ustawia proxy).
 */
export function shouldApplyAdminSalesPreviewHeader(
  panelContext: AdminPanelContext | null | undefined,
  previewSalesPersonId: string | null | undefined
): boolean {
  return panelContext === "sales" && Boolean(previewSalesPersonId?.trim());
}

export const ADMIN_PANEL_CONTEXT_OPTIONS: {
  value: AdminPanelContext;
  label: string;
  title: string;
}[] = [
  {
    value: "admin",
    label: "Admin",
    title: "Hub systemu, konta i katalog",
  },
  {
    value: "zakupy",
    label: "Zakupy",
    title: "Panel dzienny i dostawcy",
  },
  {
    value: "magazyn",
    label: "Magazyn",
    title: "Kolejka przyjęcia i regał",
  },
  {
    value: "sales_manager",
    label: "Zespół",
    title: "Podgląd kierownictwa",
  },
  {
    value: "sales",
    label: "Handlowiec",
    title: "Podgląd panelu handlowca (tylko odczyt)",
  },
];
