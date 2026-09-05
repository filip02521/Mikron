import { isE2ELab } from "@/lib/e2e-lab/mode";
import { createAdminClient, hasDatabaseConfig } from "@/lib/db/admin";

/** Szybkie sprawdzenie w middleware — czy jest już admin w bazie */
export async function middlewareNeedsBootstrap(): Promise<boolean> {
  if (isE2ELab()) return false;
  if (!hasDatabaseConfig()) return false;

  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    console.error("middlewareNeedsBootstrap:", error.message);
    // Przy chwilowym błędzie DB nie przekierowuj całej aplikacji na /setup.
    return false;
  }
  return (count ?? 0) === 0;
}
