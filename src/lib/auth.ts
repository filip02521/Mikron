import { createClient } from "@/lib/supabase/server";
import { fetchProfileByUserId } from "@/lib/auth/profile";
import { canAccessOperations, canManageSuppliers, isAdmin } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  salesPersonId: string | null;
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
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    throw new Error("Brak uprawnień administratora");
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

/** Zarządzanie dostawcami i urlopami (admin + zakupy). */
export async function requireSupplierManagement(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !canManageSuppliers(user.role)) {
    throw new Error("Brak uprawnień do zarządzania dostawcami");
  }
  return user;
}
