/**
 * Backfill: auto-assign supplier_id for existing teeth orders that have null supplier_id.
 *
 * Matches teeth manufacturer (from prosba_teeth_products) to supplier name
 * (e.g. "Wiedent" → "Wiedent Sp. z o.o.").
 *
 * Run: npx tsx scripts/backfill-teeth-supplier.ts
 */
import { createClient } from "@supabase/supabase-js";
import { fetchTeethProductInfo } from "../src/lib/data/teeth-products";
import { fetchSuppliersForForm } from "../src/lib/data/queries";
import { resolveSupplierForTeethManufacturer } from "../src/lib/orders/teeth-ocr-prosba-prefill";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Użyj --env-file=.env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const teethProducts = await fetchTeethProductInfo().catch(() => []);
  const manufacturerByTwId = new Map(teethProducts.map((row) => [row.twId, row.manufacturer]));
  const suppliers = await fetchSuppliersForForm().catch(() => [] as Array<{ id: string; name: string }>);

  if (!suppliers.length) {
    console.error("No suppliers found in database.");
    process.exit(1);
  }

  // Fetch all teeth orders with null supplier_id
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, subiekt_tw_id, status")
    .eq("is_teeth", true)
    .is("supplier_id", null);

  if (error) {
    console.error("Failed to fetch teeth orders:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("No teeth orders without supplier_id found. Nothing to backfill.");
    return;
  }

  console.log(`Found ${data.length} teeth orders without supplier_id.`);

  let updated = 0;
  let skipped = 0;

  for (const row of data) {
    const twId = row.subiekt_tw_id != null && row.subiekt_tw_id > 0
      ? Math.trunc(row.subiekt_tw_id)
      : null;
    if (!twId) {
      console.log(`  SKIP ${row.id}: no subiekt_tw_id (status: ${row.status})`);
      skipped++;
      continue;
    }
    const manufacturer = manufacturerByTwId.get(twId);
    if (!manufacturer) {
      console.log(`  SKIP ${row.id}: no manufacturer for tw_id ${twId} (status: ${row.status})`);
      skipped++;
      continue;
    }
    const resolvedSupplierId = resolveSupplierForTeethManufacturer(manufacturer, suppliers);
    if (!resolvedSupplierId) {
      console.log(`  SKIP ${row.id}: no supplier match for manufacturer "${manufacturer}" (status: ${row.status})`);
      skipped++;
      continue;
    }
    const { error: updErr } = await supabase
      .from("individual_orders")
      .update({ supplier_id: resolvedSupplierId })
      .eq("id", row.id);
    if (updErr) {
      console.error(`  ERROR ${row.id}: ${updErr.message}`);
      skipped++;
      continue;
    }
    console.log(`  OK ${row.id}: assigned supplier ${resolvedSupplierId} (manufacturer: ${manufacturer}, status: ${row.status})`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Total: ${data.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
