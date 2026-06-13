import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";
import type { ResolvedSalesPerson } from "@/lib/auth/sales-person";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import { isAdmin } from "@/lib/auth-roles";

/** Podgląd panelu handlowca (kierownik / admin). */
export async function resolvePreviewSalesPerson(
  salesPersonId: string,
  viewer?: Pick<SessionUser, "id" | "role">
): Promise<ResolvedSalesPerson | null> {
  if (!hasSupabaseConfig() || !salesPersonId) return null;

  if (viewer && !isAdmin(viewer.role)) {
    const allowed = await canAccessSalesPerson(viewer, salesPersonId);
    if (!allowed) return null;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sales_people")
    .select("id, name")
    .eq("id", salesPersonId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name };
}

/** Profil użytkownika powiązany z kartą handlowca — do tablicy i stanu odczytów. */
export async function resolveProfileIdForSalesPerson(
  salesPersonId: string
): Promise<string | null> {
  if (!hasSupabaseConfig() || !salesPersonId) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  return data?.id ?? null;
}
