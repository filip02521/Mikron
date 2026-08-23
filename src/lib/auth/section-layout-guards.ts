import { headers } from "next/headers";
import { requireAdmin, requireOperations, requireWarehouse, getSessionUser } from "@/lib/auth";
import {
  canAccessOperations,
  canManageSuppliers,
  isIvoclarRaportyLegacyPath,
} from "@/lib/auth-roles";
import { requireMailCenterAccess } from "@/lib/auth/admin-modules";

/** Defense-in-depth obok proxy — sekcja /admin. */
export async function ensureAdminSection(): Promise<void> {
  await requireAdmin();
}

/** Centrum maili: `role=admin` lub moduł `MAIL_CENTER_MODULE_SLUG`. */
export async function ensureMailCenterSectionAccess(): Promise<void> {
  await requireMailCenterAccess();
}

/** Panel operacji zakupowych (admin + zakupy + zakupy_zeby dla dostawców). */
export async function ensureOperationsSection(): Promise<void> {
  const pathname = (await headers()).get("x-pathname") ?? "";
  // Legacy Ivoclar bookmark — strona sama robi redirect / komunikat; bez requireOperations.
  if (isIvoclarRaportyLegacyPath(pathname)) {
    const user = await getSessionUser();
    if (!user) await requireOperations();
    return;
  }

  const user = await getSessionUser();
  if (!user?.role) {
    await requireOperations();
    return;
  }
  const ws = user.assignedWorkspaces;
  if (canAccessOperations(user.role, ws)) return;
  if (canManageSuppliers(user.role, ws)) return;
  await requireOperations();
}

/** Magazyn: kolejka, notatki magazynowe (admin + zakupy + magazyn). */
export async function ensureWarehouseSection(): Promise<void> {
  await requireWarehouse();
}
