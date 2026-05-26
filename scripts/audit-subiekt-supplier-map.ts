/**
 * Porównanie dostawców app vs dopasowanie nazwą z Subiekta.
 * npx tsx scripts/audit-subiekt-supplier-map.ts
 */
import { createClient } from "@supabase/supabase-js";
import { searchSubiektSuppliers } from "../src/lib/subiekt/api";
import {
  formatSubiektKontrahentLabel,
  matchSubiektKontrahentToSupplier,
} from "../src/lib/subiekt/match-supplier";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(url, key);
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .order("name");
  if (error) throw error;

  const appRefs = suppliers ?? [];
  let matched = 0;
  let miss = 0;
  const misses: string[] = [];

  for (const s of appRefs) {
    const q = s.name.split(/[(/]/)[0]?.trim() || s.name;
    if (q.length < 3) continue;

    try {
      const res = await searchSubiektSuppliers({ search: q.slice(0, 24), pageSize: 5 });
      let found = false;
      for (const k of res.data) {
        const id = matchSubiektKontrahentToSupplier(k, appRefs);
        if (id === s.id) {
          found = true;
          break;
        }
      }
      if (found) matched++;
      else {
        miss++;
        if (misses.length < 15) {
          const sub = res.data[0]
            ? formatSubiektKontrahentLabel(res.data[0])
            : "(brak w Subiekcie)";
          misses.push(`  · ${s.name}\n    Subiekt: ${sub}`);
        }
      }
    } catch {
      miss++;
    }
  }

  console.log(`Dostawców w app: ${appRefs.length}`);
  console.log(`Dopasowanych nazwą (przybliżone): ${matched}`);
  console.log(`Bez pewnego dopasowania: ${miss}`);
  if (misses.length) {
    console.log("\nPrzykłady rozbieżności:");
    console.log(misses.join("\n"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
