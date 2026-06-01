/**
 * Poprawia wiersze individual_orders, które powinny być informacją (STAN / ilość „-”),
 * ale nadal mają request_kind = zamowienie. Domyślnie dry-run.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-informacja-legacy-rows.ts
 *   npx tsx --env-file=.env.local scripts/backfill-informacja-legacy-rows.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { shouldTreatAsInformacjaOnly } from "../src/lib/orders/informacja-import-rules";
import { INFORMACJA_NO_QUANTITY } from "../src/lib/orders/individual";

const apply = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: stanPerson } = await supabase
    .from("sales_people")
    .select("id")
    .ilike("name", "STAN")
    .maybeSingle();
  const stanSalesPersonId = stanPerson?.id ?? null;

  const { data: rows, error } = await supabase
    .from("individual_orders")
    .select(
      "id, quantity, sales_person_id, status, order_type, ordered_at, request_kind, informacja_queue_via_daily_panel"
    )
    .eq("request_kind", "zamowienie");

  if (error) throw new Error(error.message);

  const candidates = (rows ?? []).filter((row) =>
    shouldTreatAsInformacjaOnly({
      quantity: row.quantity,
      salesPersonId: row.sales_person_id,
      stanSalesPersonId,
    })
  );

  console.log(`Kandydaci do konwersji na informacja: ${candidates.length}`);
  if (!candidates.length) return;

  for (const row of candidates.slice(0, 20)) {
    console.log(`  ${row.id} | ${row.status} | qty=${row.quantity}`);
  }
  if (candidates.length > 20) {
    console.log(`  … i ${candidates.length - 20} więcej`);
  }

  if (!apply) {
    console.log("\nDry-run. Uruchom z --apply, aby zapisać zmiany.");
    return;
  }

  let updated = 0;
  for (const row of candidates) {
    const alreadyOrdered = row.status === "Zamowione" || row.status === "Zrealizowane";
    const patch = {
      request_kind: "informacja" as const,
      quantity: INFORMACJA_NO_QUANTITY,
      informacja_queue_via_daily_panel: false,
      ...(alreadyOrdered
        ? {}
        : { order_type: "None" as const, ordered_at: null }),
    };
    const { error: updErr } = await supabase
      .from("individual_orders")
      .update(patch)
      .eq("id", row.id);
    if (updErr) throw new Error(updErr.message);
    updated++;
  }

  console.log(`Zaktualizowano: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
