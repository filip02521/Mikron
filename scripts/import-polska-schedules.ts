/**
 * Importuje harmonogramy POLSKA 1:1 z data/polska-schedules.json do Supabase.
 * Nie wywołuje przeliczania — zapisuje dokładnie daty z arkusza.
 *
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx scripts/build-polska-from-pdf.ts
 *   npx tsx scripts/import-polska-schedules.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { PolskaScheduleRow } from "./build-polska-from-pdf";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const dataPath = join(process.cwd(), "data", "polska-schedules.json");

/** Nazwy rozjechane między arkuszami po eksporcie PDF z USTAWIENIA */
const NAME_ALIASES: Record<string, string> = {
  "FUTURE TECHNOLOGY AND DEVELOPMENT": "AND DEVELOPMENT",
};

async function main() {
  if (!existsSync(dataPath)) {
    console.error("Brak data/polska-schedules.json — uruchom: npm run build-polska");
    process.exit(1);
  }

  const rows = (JSON.parse(readFileSync(dataPath, "utf-8")) as PolskaScheduleRow[]).filter(
    (r) => r.name && !/^\d{4}-\d{2}-\d{2}$/.test(r.name) && !/^w razie potrzeby$/i.test(r.name)
  );
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("location", "POLSKA");

  if (error) throw new Error(error.message);

  const byName = new Map(
    (suppliers ?? []).map((s) => [s.name.toUpperCase().trim(), s.id])
  );

  let updated = 0;
  let missing = 0;
  const missingNames: string[] = [];

  for (const row of rows) {
    const key = row.name.toUpperCase().trim();
    let id = byName.get(key);
    if (!id && NAME_ALIASES[key]) {
      id = byName.get(NAME_ALIASES[key].toUpperCase().trim());
    }
    if (!id) {
      missing++;
      missingNames.push(row.name);
      continue;
    }

    await supabase
      .from("suppliers")
      .update({
        name: row.name,
        pickup_mikran: row.pickup_mikran,
        pickup_pallet: row.pickup_pallet,
        notes: row.notes || undefined,
        extra_info: row.extra_info || undefined,
        ...(row.stock_raw?.trim()
          ? { stock_raw: row.stock_raw.trim(), stock: row.stock_weeks }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    byName.set(key, id);

    const { error: schedErr } = await supabase.from("supplier_schedules").upsert(
      {
        supplier_id: id,
        order_date: row.order_date,
        shift_date: row.shift_date,
        computed_next_date: row.computed_next_date,
        vacation_note: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supplier_id" }
    );

    if (schedErr) {
      console.warn(row.name, schedErr.message);
      continue;
    }
    updated++;
  }

  console.log(`Zaktualizowano harmonogramy: ${updated}/${rows.length}`);
  if (missing) {
    console.warn(`Brak w bazie (${missing}):`, missingNames.slice(0, 15).join(", "));
    if (missingNames.length > 15) console.warn("… i więcej");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
