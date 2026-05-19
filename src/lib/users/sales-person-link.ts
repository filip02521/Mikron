import type { SupabaseClient } from "@supabase/supabase-js";

/** Sprawdza, czy handlowiec nie jest już powiązany z innym kontem. */
export async function assertUniqueSalesPersonLink(
  supabase: SupabaseClient,
  salesPersonId: string | null,
  excludeUserId?: string
): Promise<string | null> {
  if (!salesPersonId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  if (error) return error.message;
  if (data && data.id !== excludeUserId) {
    return `Ten handlowiec jest już powiązany z kontem ${data.email ?? data.id}.`;
  }
  return null;
}
