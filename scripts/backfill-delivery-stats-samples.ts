/**
 * Backfill delivery_stats_samples z historii zamówień (batch).
 *   npx tsx scripts/backfill-delivery-stats-samples.ts [--supplier=UUID] [--batches=50]
 */
import { hasSupabaseConfig } from "../src/lib/supabase/admin";
import { backfillDeliveryStatsSamples } from "../src/lib/data/delivery-stats-samples";

async function main() {
  if (!hasSupabaseConfig()) {
    console.error("Brak konfiguracji Supabase (.env.local)");
    process.exit(1);
  }

  const supplierArg = process.argv.find((a) => a.startsWith("--supplier="));
  const batchesArg = process.argv.find((a) => a.startsWith("--batches="));
  const supplierId = supplierArg?.slice("--supplier=".length) || undefined;
  const maxBatches = batchesArg ? Number(batchesArg.slice("--batches=".length)) : 50;

  console.log("Backfill delivery_stats_samples…", { supplierId, maxBatches });
  const result = await backfillDeliveryStatsSamples({
    supplierId,
    maxBatches: Number.isFinite(maxBatches) ? maxBatches : 50,
  });
  console.log("Done:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
