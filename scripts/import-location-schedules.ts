/**
 * Import harmonogramów 1:1 z data/{location}-schedules.json
 *
 *   npx tsx scripts/import-location-schedules.ts ZAGRANICA
 *   npx tsx scripts/import-location-schedules.ts POLSKA
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { LocationScheduleRow } from "./lib/location-schedule-pdf";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const NAME_ALIASES: Record<string, Record<string, string>> = {
  POLSKA: {
    "FUTURE TECHNOLOGY AND DEVELOPMENT": "AND DEVELOPMENT",
  },
  ZAGRANICA: {
    "Dentsply Sirona (dawny Zhermack)": "Dentsply Sirona (dawny Zhermack)",
  },
  IMPORT: {},
};

async function main() {
  const location = (process.argv[2] || "ZAGRANICA").toUpperCase();
  if (!["POLSKA", "ZAGRANICA", "IMPORT"].includes(location)) {
    console.error("Lokalizacja: POLSKA | ZAGRANICA | IMPORT");
    process.exit(1);
  }

  if (!url || !key) {
    console.error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const slug = location.toLowerCase();
  const dataPath = join(process.cwd(), "data", `${slug}-schedules.json`);
  if (!existsSync(dataPath)) {
    console.error(`Brak ${dataPath} — uruchom build-${slug}-from-pdf`);
    process.exit(1);
  }

  const rows = (JSON.parse(readFileSync(dataPath, "utf-8")) as LocationScheduleRow[]).filter(
    (r) => r.name && !/^\d{4}-\d{2}-\d{2}$/.test(r.name) && !/^w razie potrzeby$/i.test(r.name)
  );

  const supabase = createClient(url, key);
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("location", location);

  if (error) throw new Error(error.message);

  const byName = new Map(
    (suppliers ?? []).map((s) => [s.name.toUpperCase().trim(), s.id])
  );

  const aliases = NAME_ALIASES[location] ?? {};
  let updated = 0;
  const missing: string[] = [];

  for (const row of rows) {
    const keyName = row.name.toUpperCase().trim();
    let id = byName.get(keyName);
    if (!id && aliases[keyName]) {
      id = byName.get(aliases[keyName].toUpperCase().trim());
    }
    if (!id) {
      missing.push(row.name);
      continue;
    }

    const supplierPatch: Record<string, unknown> = {
      name: row.name,
      pickup_mikran: row.pickup_mikran,
      pickup_pallet: row.pickup_pallet,
      notes: row.notes || undefined,
      extra_info: row.extra_info || undefined,
      updated_at: new Date().toISOString(),
    };
    if (row.stock_raw?.trim()) {
      supplierPatch.stock_raw = row.stock_raw.trim();
      supplierPatch.stock = row.stock_weeks;
    }
    await supabase.from("suppliers").update(supplierPatch).eq("id", id);

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

  console.log(`${location}: zaktualizowano ${updated}/${rows.length}`);
  if (missing.length) {
    console.warn(`Brak w bazie (${missing.length}):`, missing.slice(0, 12).join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
