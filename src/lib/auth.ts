import { createClient } from "@/lib/supabase/server";
import { fetchProfileByUserId } from "@/lib/auth/profile";
import {
  canAccessOperations,
  canAccessWarehouse,
  canManageSalesTeam,
  canManageSuppliers,
  isAdmin,
  isSalesAccount,
} from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  salesPersonId: string | null;
  mustChangePassword: boolean;
  salesOnboardingCompletedAt: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const profile = await fetchProfileByUserId(user.id);
  if (!profile) return null;

  return {
    id: user.id,
    email: profile.email ?? user.email ?? "",
    role: profile.role,
    salesPersonId: profile.sales_person_id,
    mustChangePassword: profile.must_change_password,
    salesOnboardingCompletedAt: profile.sales_onboarding_completed_at,
  };
}

export async function requireSalesTeamManagement(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canManageSalesTeam(user.role)) {
    throw new Error("Brak uprawnień do zarządzania zespołem handlowców");
  }
  return user;
}

export async function requireSalesAccount(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień handlowca");
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

export async function requireAdminOrSalesTeamManagement(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user.role) && !canManageSalesTeam(user.role))) {
    throw new Error("Brak uprawnień");
  }
  return user;
}

/** Operacje: panel dzienny, kolejka, harmonogramy (admin + zakupy). */
export async function requireOperations(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canAccessOperations(user.role)) {
    throw new Error("Brak uprawnień do operacji zakupowych");
  }
  return user;
}

/** Magazyn: przyjęcie towaru, dziennik dostaw (admin + zakupy + magazyn). */
export async function requireWarehouse(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canAccessWarehouse(user.role)) {
    throw new Error("Brak uprawnień magazynu");
  }
  return user;
}

/** Zarządzanie dostawcami i urlopami (admin + zakupy). */
export async function requireSupplierManagement(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canManageSuppliers(user.role)) {
    throw new Error("Brak uprawnień do zarządzania dostawcami");
  }
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
