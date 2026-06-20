/**
 * Diagnostyka dopasowania terminów ZD dla wszystkich kandydatów handlowca.
 *
 *   export $(grep -v '^#' .env.local | grep -E 'SUBIEKT|SUPABASE' | xargs)
 *   npx tsx scripts/run-zd-eta-diagnose.ts [sales_person_id]
 *   npx tsx scripts/run-zd-eta-diagnose.ts --apply [sales_person_id]  # zapis do bazy
 */
import { loadAppSupplierRefsWithAliases } from "../src/lib/data/supplier-subiekt-kh";
import { diagnoseZdEtaCandidates } from "../src/lib/subiekt/zd-eta-diagnose";
import { runZdEtaSync } from "../src/lib/subiekt/zd-eta-sync";

const args = process.argv.slice(2).filter((a) => a !== "--apply");
const apply = process.argv.includes("--apply");
const salesPersonId =
  args[0]?.trim() || "4e0c3e1f-b58d-443a-88a3-81162e6fe392";

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width - 1) + "…" : value.padEnd(width);
}

async function main() {
  console.log(
    apply
      ? "Diagnostyka + zapis (runZdEtaSync force) dla handlowca:"
      : "Diagnostyka ZD ETA (bez zapisu) dla handlowca:",
    salesPersonId
  );

  const rows = await diagnoseZdEtaCandidates({
    salesPersonId,
    maxOrders: 48,
    maxDocsPerOrder: 24,
  });

  const header = [
    pad("Dostawca", 18),
    pad("Symbol", 16),
    pad("Metoda", 8),
    pad("ZD", 22),
    pad("Termin", 12),
    pad("Idx", 4),
    pad("Docs", 4),
    "Uwagi",
  ].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  let matched = 0;
  let incomplete = 0;
  for (const row of rows) {
    if (row.deadline) matched++;
    if (row.incomplete) incomplete++;
    console.log(
      [
        pad(row.supplier, 18),
        pad(row.symbol, 16),
        pad(row.method, 8),
        pad(row.dokNr ?? "-", 22),
        pad(row.deadline ?? "-", 12),
        pad(String(row.indexCandidates), 4),
        pad(String(row.docsFetched), 4),
        row.note ?? "",
      ].join(" ")
    );
  }

  console.log("-".repeat(header.length));
  console.log(
    `Pozycji: ${rows.length}, z terminem: ${matched}, niepełne: ${incomplete}`
  );

  if (apply) {
    const supplierRefs = await loadAppSupplierRefsWithAliases();
    const result = await runZdEtaSync({
      salesPersonId,
      force: true,
      allowLiveSearch: true,
      supplierRefs,
      maxOrders: 48,
      maxDocsPerRun: 200,
      maxDocsPerSupplier: 48,
      maxDurationMs: 180_000,
    });
    console.log("Sync:", JSON.stringify(result, null, 2));
  } else {
    console.log("\nAby zapisać terminy: dodaj flagę --apply");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
