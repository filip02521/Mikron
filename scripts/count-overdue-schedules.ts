/** Liczba dostawców z computed_next_date < dziś (Warszawa). */
import { createAdminClient } from "../src/lib/supabase/admin";
import { warsawNowParts } from "../src/lib/time/warsaw";

async function main() {
  const supabase = createAdminClient();
  const today = warsawNowParts().dateKey;
  const { count, error } = await supabase
    .from("supplier_schedules")
    .select("*", { count: "exact", head: true })
    .not("computed_next_date", "is", null)
    .lt("computed_next_date", today);
  if (error) throw error;

  console.log("Dziś (Warszawa):", today);
  console.log("Zaległe harmonogramy (computed_next < dziś):", count ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
