import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type ProfileRow = {
  role: UserRole;
  sales_person_id: string | null;
  email: string | null;
};

/** Odczyt profilu service role — zawsze zgodny z bazą (po walidacji JWT). */
export async function fetchProfileByUserId(
  userId: string
): Promise<ProfileRow | null> {
  if (!hasSupabaseConfig()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role, sales_person_id, email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    role: data.role as UserRole,
    sales_person_id: data.sales_person_id,
    email: data.email,
  };
}
