/**
 * Jednorazowy sync terminów ZD (CLI, bez Next unstable_cache).
 *
 * Diagnostyka (wszystkie dostawcy, bez zapisu):
 *   npx tsx scripts/run-zd-eta-diagnose.ts [sales_person_id]
 *
 * Sync + zapis:
 *   export $(grep -v '^#' .env.local | grep -E 'SUBIEKT|SUPABASE' | xargs)
 *   npx tsx scripts/run-zd-eta-sync-once.ts [sales_person_id]
 */
import { loadAppSupplierRefsWithAliases } from "../src/lib/data/supplier-subiekt-kh";
import { runZdEtaSync } from "../src/lib/subiekt/zd-eta-sync";

const salesPersonId =
  process.argv[2]?.trim() || "4e0c3e1f-b58d-443a-88a3-81162e6fe392";

async function main() {
  const supplierRefs = await loadAppSupplierRefsWithAliases();
  console.log("Sync ZD ETA dla handlowca:", salesPersonId);
  const result = await runZdEtaSync({
    salesPersonId,
    force: true,
    allowLiveSearch: true,
    supplierRefs,
    maxOrders: 24,
    maxDocsPerRun: 96,
    maxDocsPerSupplier: 48,
    maxDurationMs: 120_000,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
