/**
 * Oznacza historyczne pozycje Zrealizowane jako odebrane (sales_acknowledged_at),
 * żeby nie wisiały w inwentaryzacji regału.
 *
 * npx tsx scripts/backfill-sales-acknowledged-zrealizowane.ts
 * npx tsx scripts/backfill-sales-acknowledged-zrealizowane.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import type { IndividualOrder } from "../src/types/database";

const PAGE = 500;

function ackAt(order: Pick<IndividualOrder, "delivery_at" | "ordered_at" | "action_at">): string {
  const raw = order.delivery_at ?? order.ordered_at ?? order.action_at;
  return raw ? new Date(raw).toISOString() : new Date().toISOString();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  }

  const supabase = createClient(url, key);
  let offset = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("individual_orders")
      .select("id, status, delivery_at, ordered_at, action_at")
      .eq("status", "Zrealizowane")
      .is("sales_acknowledged_at", null)
      .is("sales_cancelled_at", null)
      .order("action_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;

    const batch = data ?? [];
    scanned += batch.length;
    if (!batch.length) break;

    if (!dryRun) {
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        await Promise.all(
          chunk.map((row) =>
            supabase
              .from("individual_orders")
              .update({ sales_acknowledged_at: ackAt(row) })
              .eq("id", row.id)
              .is("sales_acknowledged_at", null)
          )
        );
        updated += chunk.length;
      }
    } else {
      updated += batch.length;
    }

    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  console.log(
    dryRun
      ? `[dry-run] Do oznaczenia jako odebrane: ${updated} (przeskanowano ${scanned})`
      : `Oznaczono jako odebrane: ${updated} (przeskanowano ${scanned})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
