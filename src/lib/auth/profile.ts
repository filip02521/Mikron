import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type ProfileRow = {
  role: UserRole;
  sales_person_id: string | null;
  email: string | null;
  must_change_password: boolean;
  sales_onboarding_completed_at: string | null;
};

/** Odczyt profilu service role — zawsze zgodny z bazą (po walidacji JWT). */
export async function fetchProfileByUserId(
  userId: string
): Promise<ProfileRow | null> {
  if (!hasSupabaseConfig()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role, sales_person_id, email, must_change_password, sales_onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    role: data.role as UserRole,
    sales_person_id: data.sales_person_id,
    email: data.email,
    must_change_password: Boolean(data.must_change_password),
    sales_onboarding_completed_at: data.sales_onboarding_completed_at ?? null,
  };
}
