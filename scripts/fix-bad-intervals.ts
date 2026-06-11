/**
 * Czyści błędne interval_weeks (np. numery telefonów z importu PDF).
 * npx tsx scripts/fix-bad-intervals.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(url, key);
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, interval_weeks");

  let fixed = 0;
  for (const s of suppliers ?? []) {
    const n = s.interval_weeks != null ? Number(s.interval_weeks) : null;
    if (n == null || isNaN(n)) continue;
    if (n > 0 && n <= 104) continue;

    const fallback = 4;
    await supabase
      .from("suppliers")
      .update({ interval_weeks: fallback })
      .eq("id", s.id);
    console.log(`Poprawiono ${s.name}: ${n} → ${fallback}`);
    fixed++;
  }
  console.log(fixed ? `Naprawiono ${fixed} rekordów.` : "Brak błędnych interwałów.");
}

main().catch(console.error);
