/**
 * Ustawia suppliers.order_on_demand na podstawie stock_raw / interval_raw / extra_info.
 *
 * npx tsx scripts/backfill-order-on-demand.ts
 */

import { createClient } from "@supabase/supabase-js";
import { detectOrderOnDemandFromFields } from "../src/lib/orders/supplier-on-demand";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, stock_raw, interval_raw, extra_info, order_on_demand");
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    const should = detectOrderOnDemandFromFields(row);
    if (Boolean(row.order_on_demand) === should) continue;
    const { error: upErr } = await supabase
      .from("suppliers")
      .update({ order_on_demand: should })
      .eq("id", row.id);
    if (upErr) throw upErr;
    updated++;
    console.log(`${should ? "✓" : "·"} ${row.name}`);
  }
  console.log(`\nZaktualizowano: ${updated} / ${data?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
