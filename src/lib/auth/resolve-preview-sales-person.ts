import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { ResolvedSalesPerson } from "@/lib/auth/sales-person";

/** Podgląd panelu handlowca (kierownik / admin). */
export async function resolvePreviewSalesPerson(
  salesPersonId: string
): Promise<ResolvedSalesPerson | null> {
  if (!hasSupabaseConfig() || !salesPersonId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sales_people")
    .select("id, name")
    .eq("id", salesPersonId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name };
}
