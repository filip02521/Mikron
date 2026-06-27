import { fetchOwnProfileForSession } from "@/lib/auth/profile";
import { assertPasswordChangeCompleted } from "@/lib/auth/must-change-password-guard";
import {
  assertAdminNotInReadOnlyPanelPreview,
  assertAdminPanelAllowsOperationsMutations,
  assertAdminPanelAllowsWarehouseMutations,
} from "@/lib/auth/guard-admin-panel-preview";
import {
  canAccessOperations,
  canAccessWarehouse,
  canManageSalesTeam,
  canManageSuppliers,
  isAdmin,
  isSalesAccount,
} from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

type AuthIntent = "read" | "mutate";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  salesPersonId: string | null;
  mustChangePassword: boolean;
  salesOnboardingCompletedAt: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const profile = await fetchOwnProfileForSession();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email ?? "",
    role: profile.role,
    salesPersonId: profile.sales_person_id,
    mustChangePassword: profile.must_change_password,
    salesOnboardingCompletedAt: profile.sales_onboarding_completed_at,
  };
}

export async function requireSalesTeamManagement(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canManageSalesTeam(user.role)) {
    throw new Error("Brak uprawnień do zarządzania zespołem handlowców");
  }
  if (intent === "mutate") {
    await assertAdminNotInReadOnlyPanelPreview(user);
  }
  return user;
}

export async function requireSalesAccount(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień handlowca");
  }
  if (intent === "mutate") {
    await assertAdminNotInReadOnlyPanelPreview(user);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    throw new Error("Brak uprawnień administratora");
  }
  return user;
}

/** Administracja z mutacją — blokada w trybie podglądu innego panelu. */
export async function requireAdminForMutation(): Promise<SessionUser> {
  const user = await requireAdmin();
  await assertAdminNotInReadOnlyPanelPreview(user);
  return user;
}

export async function requireAdminOrSalesTeamManagement(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user.role) && !canManageSalesTeam(user.role))) {
    throw new Error("Brak uprawnień");
  }
  if (intent === "mutate") {
    await assertAdminNotInReadOnlyPanelPreview(user);
  }
  return user;
}

/** Operacje: panel dzienny, kolejka, harmonogramy (admin + zakupy). */
export async function requireOperations(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canAccessOperations(user.role)) {
    throw new Error("Brak uprawnień do operacji zakupowych");
  }
  if (intent === "mutate") {
    await assertAdminPanelAllowsOperationsMutations(user);
  }
  return user;
}

/** Magazyn: przyjęcie towaru, dziennik dostaw (admin + zakupy + magazyn). */
export async function requireWarehouse(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canAccessWarehouse(user.role)) {
    throw new Error("Brak uprawnień magazynu");
  }
  if (intent === "mutate") {
    await assertAdminPanelAllowsWarehouseMutations(user);
  }
  return user;
}

/** Zarządzanie dostawcami i urlopami (admin + zakupy). */
export async function requireSupplierManagement(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canManageSuppliers(user.role)) {
    throw new Error("Brak uprawnień do zarządzania dostawcami");
  }
  if (intent === "mutate") {
    await assertAdminPanelAllowsOperationsMutations(user);
  }
  return user;
}

/** Sesja wymagana do mutacji (z blokadą podglądu panelu admina). */
export async function getSessionUserForMutation(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Brak sesji — zaloguj się ponownie.");
  }
  assertPasswordChangeCompleted(user);
  await assertAdminPanelAllowsOperationsMutations(user);
  return user;
}

/** Podpowiedzi Subiekt przy składaniu / edycji próśb (handlowiec, zakupy, admin). */
export async function requireSubiektLookup(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || (!isSalesAccount(user.role) && !canAccessOperations(user.role))) {
    throw new Error("Brak uprawnień do podpowiedzi Subiekt");
  }
  return user;
}
