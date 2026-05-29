/**
 * Przelicza supplier_schedules z normal_order_history (po imporcie HISTORIA.csv).
 *
 *   npx tsx scripts/rebuild-schedules-from-historia.ts
 */
import { rebuildAllSupplierSchedulesFromHistoria } from "../src/lib/services/rebuild-schedules-from-historia";

async function main() {
  const result = await rebuildAllSupplierSchedulesFromHistoria();
  console.log(`Zaktualizowano harmonogramy: ${result.updated} (pełna historia, chronologicznie)`);
  console.log(`Dostawcy bez historii (bez zmian): ${result.skippedNoHistory}`);
  if (result.errors.length) {
    console.log(`Błędy (${result.errors.length}):`);
    result.errors.slice(0, 30).forEach((e) => console.log(`  - ${e}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
