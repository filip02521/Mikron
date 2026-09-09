import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

/**
 * Liczba kont z rolą admin.
 * `null` = nie udało się sprawdzić (nie wolno wtedy wymuszać /setup).
 */
export async function countAdmins(): Promise<number | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    console.error("[bootstrap] Nie można sprawdzić profili admin:", error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * true = trzeba utworzyć pierwszego administratora (ignoruje DEV_ADMIN_MODE i sesje).
 * Przy błędzie DB / braku konfiguracji → false (fail-open), żeby nie zapętlać
 * /login ↔ /setup.
 */
export async function needsBootstrapSetup(): Promise<boolean> {
  const count = await countAdmins();
  if (count === null) return false;
  return count === 0;
}
