/**
 * Propozycje powiązań dostawców app ↔ Subiekt (kh_Id).
 *
 * Podgląd:  npx tsx scripts/suggest-supplier-subiekt-links.ts
 * Zapis:    npx tsx scripts/suggest-supplier-subiekt-links.ts --apply
 * Próg:     npx tsx scripts/suggest-supplier-subiekt-links.ts --apply --min-score=85
 */
import { createClient } from "@supabase/supabase-js";
import { searchSubiektSuppliers } from "../src/lib/subiekt/api";
import {
  formatSubiektKontrahentLabel,
  scoreSupplierKontrahentMatch,
} from "../src/lib/subiekt/match-supplier";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apply = process.argv.includes("--apply");
const minScore = Number(
  process.argv.find((a) => a.startsWith("--min-score="))?.split("=")[1] ?? "82"
);

async function main() {
  const supabase = createClient(url, key);
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .order("name");
  if (error) throw error;

  let proposed = 0;
  let applied = 0;
  let skipped = 0;

  for (const s of suppliers ?? []) {
    if (s.subiekt_kh_id != null) continue;

    const q = s.name.split(/[(/]/)[0]?.trim() || s.name;
    if (q.length < 3) {
      skipped++;
      continue;
    }

    let res;
    try {
      res = await searchSubiektSuppliers({ search: q.slice(0, 28), pageSize: 8 });
    } catch {
      skipped++;
      continue;
    }

    const scored = res.data
      .map((k) => ({ k, score: scoreSupplierKontrahentMatch(s.name, k) }))
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      skipped++;
      continue;
    }

    const best = scored[0];
    const second = scored[1];
    if (second && second.score >= minScore && second.score >= best.score - 5) {
      console.log(
        `AMBIG ${s.name}\n  1) ${formatSubiektKontrahentLabel(best.k)} (${best.score})\n  2) ${formatSubiektKontrahentLabel(second.k)} (${second.score})`
      );
      skipped++;
      continue;
    }

    proposed++;
    console.log(
      `${apply ? "APPLY" : "PROP"} ${s.name}\n  → ${formatSubiektKontrahentLabel(best.k)} (kh_Id ${best.k.kh_Id}, score ${best.score})`
    );

    if (apply) {
      const { error: updErr } = await supabase
        .from("suppliers")
        .update({ subiekt_kh_id: best.k.kh_Id })
        .eq("id", s.id)
        .is("subiekt_kh_id", null);
      if (updErr) {
        console.error("  BŁĄD:", updErr.message);
      } else {
        applied++;
      }
    }
  }

  console.log(
    `\nPodsumowanie: zaproponowano ${proposed}, pominięto ${skipped}${apply ? `, zapisano ${applied}` : ""}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
