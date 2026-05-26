/**
 * Usuwa błędne rekordy dostawców powstałe przy imporcie CSV bez obsługi pól wieloliniowych.
 */
import { createAdminClient, hasSupabaseConfig } from "../src/lib/supabase/admin";

async function main() {
  if (!hasSupabaseConfig()) {
    console.error("Brak SUPABASE");
    process.exit(1);
  }
  const supabase = createAdminClient();
  const { data: all } = await supabase.from("suppliers").select("id, name");
  const junk = (all ?? []).filter((s) => {
    const n = s.name;
    if (n === "FUTURE TECHNOLOGY" || n === "FUTURE TECHNOLOGYAND DEVELOPMENT") return true;
    if (n.includes(",POLSKA,BRAK,")) return true;
    if (n.startsWith("hasło:") || n.startsWith("login:") || n.startsWith("KSEF:")) return true;
    if (n.startsWith("DW Stefano") || n.startsWith("FORMULARZ")) return true;
    if (n.startsWith("na zamówienie,")) return true;
    return false;
  });

  console.log(`Śmieciowe rekordy do usunięcia: ${junk.length}`);
  for (const { id, name } of junk) {
    await supabase.from("delivery_stats").delete().eq("supplier_id", id);
    await supabase.from("supplier_schedules").delete().eq("supplier_id", id);
    await supabase.from("vacations").delete().eq("supplier_id", id);
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) console.warn(name, error.message);
    else console.log("  usunięto:", name);
  }

  const { count } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true });
  console.log("Dostawców po czyszczeniu:", count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
