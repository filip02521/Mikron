import { fetchOwnProfileForSession } from "@/lib/auth/profile";
import { assertPasswordChangeCompleted } from "@/lib/auth/must-change-password-guard";
import {
  assertAdminNotInReadOnlyPanelPreview,
  assertAdminPanelAllowsOperationsMutations,
  assertAdminPanelAllowsWarehouseMutations,
} from "@/lib/auth/guard-admin-panel-preview";
import {
  canAccessOperations,
  canAccessTeethPanel,
  canAccessWarehouse,
  canManageSalesTeam,
  canManageSuppliers,
  isAdmin,
  isSalesAccount,
} from "@/lib/auth-roles";
import type { UserRole, Workspace } from "@/types/database";

type AuthIntent = "read" | "mutate";

import type { FontScale } from "./auth/profile";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  salesPersonId: string | null;
  mustChangePassword: boolean;
  salesOnboardingCompletedAt: string | null;
  assignedWorkspaces: Workspace[];
  uniformBackground: boolean;
  fontScale: FontScale;
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
    assignedWorkspaces: profile.assigned_workspaces,
    uniformBackground: profile.uniform_background,
    fontScale: profile.font_scale,
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

export async function requireSalesAccountOrTeamManagement(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || (!isSalesAccount(user.role) && !canManageSalesTeam(user.role))) {
    throw new Error("Brak uprawnień");
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
  if (!user || !canAccessOperations(user.role, user.assignedWorkspaces)) {
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
  if (!user || !canAccessWarehouse(user.role, user.assignedWorkspaces)) {
    throw new Error("Brak uprawnień magazynu");
  }
  if (intent === "mutate") {
    await assertAdminPanelAllowsWarehouseMutations(user);
  }
  return user;
}

/** Panel zębów: oznaczanie zamówionych, edycja próśb, przyjęcie dostaw (admin + zakupy_zeby). */
export async function requireTeethPanel(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canAccessTeethPanel(user.role, user.assignedWorkspaces)) {
    throw new Error("Brak uprawnień do panelu zębów");
  }
  if (intent === "mutate") {
    await assertAdminPanelAllowsOperationsMutations(user);
  }
  return user;
}

/** Przyjęcie towaru — magazyn (zwykły) lub panel zębów (pozycje is_teeth). */
export async function requireReceiveMutateForOrders(
  orderIds: string[],
  intent: AuthIntent = "mutate"
): Promise<SessionUser> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) {
    throw new Error("Brak pozycji do przyjęcia");
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, is_teeth")
    .in("id", ids);

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Nie znaleziono zamówień");

  const teeth = data.filter((row) => row.is_teeth === true);
  const regular = data.filter((row) => row.is_teeth !== true);
  if (teeth.length && regular.length) {
    throw new Error("Nie można mieszać zębów z innym towarem w jednej operacji przyjęcia");
  }

  if (teeth.length) {
    return requireTeethPanel(intent);
  }
  return requireWarehouse(intent);
}

/** Wysyłka zaplanowanych powiadomień po przyjęciu (magazyn lub panel zębów). */
export async function requireReceiveNotificationFlush(): Promise<{
  user: SessionUser;
  scope: "warehouse" | "teeth" | "all";
}> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Brak sesji — zaloguj się ponownie.");
  }
  assertPasswordChangeCompleted(user);

  const warehouse = canAccessWarehouse(user.role, user.assignedWorkspaces);
  const teeth = canAccessTeethPanel(user.role, user.assignedWorkspaces);
  if (!warehouse && !teeth) {
    throw new Error("Brak uprawnień do powiadomień o przyjęciu");
  }
  if (warehouse) {
    await assertAdminPanelAllowsWarehouseMutations(user);
  }
  if (teeth) {
    await assertAdminPanelAllowsOperationsMutations(user);
  }

  const scope = warehouse && teeth ? "all" : warehouse ? "warehouse" : "teeth";
  return { user, scope };
}

/** Zarządzanie dostawcami i urlopami (admin + zakupy). */
export async function requireSupplierManagement(
  intent: AuthIntent = "read"
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canManageSuppliers(user.role, user.assignedWorkspaces)) {
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
  if (!user || (!isSalesAccount(user.role) && !canAccessOperations(user.role, user.assignedWorkspaces) && !canAccessTeethPanel(user.role, user.assignedWorkspaces))) {
    throw new Error("Brak uprawnień do podpowiedzi Subiekt");
  }
  return user;
}
