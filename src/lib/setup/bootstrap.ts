import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

/** Liczba kont z rolą admin w bazie */
export async function countAdmins(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    console.error("[bootstrap] Nie można sprawdzić profili admin:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** true = trzeba utworzyć pierwszego administratora (ignoruje DEV_ADMIN_MODE i sesje) */
export async function needsBootstrapSetup(): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;
  return (await countAdmins()) === 0;
}
