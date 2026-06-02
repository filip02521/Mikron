/**
 * Usuwa karty handlowców bez group_id (zwykle import „Jan / Klinika”).
 * Zamówienia przenosi na dopasowaną kartę z grupą; uzupełnia sales_client_name.
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-ungrouped-sales-people.ts
 *   npx tsx --env-file=.env.local scripts/cleanup-ungrouped-sales-people.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import {
  isManagedSalesPersonEmail,
  isTeamSalesPerson,
} from "../src/lib/sales/sales-person-catalog";
import {
  parseSalesPersonAndClient,
  salesPersonNameMatches,
} from "../src/lib/sales/sales-person-alias";

type PersonRow = {
  id: string;
  name: string;
  email: string;
  group_id: string | null;
};

function findMergeTarget(
  orphan: PersonRow,
  team: PersonRow[]
): { id: string; clientName: string | null } | null {
  const { salesName, clientName } = parseSalesPersonAndClient(orphan.name);

  for (const candidate of team) {
    if (!isTeamSalesPerson({ name: candidate.name, email: candidate.email, groupId: candidate.group_id })) {
      continue;
    }
    if (salesPersonNameMatches(candidate.name, salesName)) {
      return { id: candidate.id, clientName };
    }
  }

  const stan = team.find((p) => p.name.trim().toUpperCase() === "STAN");
  if (stan) return { id: stan.id, clientName };

  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key);
  const { data: all, error } = await supabase
    .from("sales_people")
    .select("id, name, email, group_id");
  if (error) throw error;

  const team = (all ?? []).filter((p) => p.group_id);
  const orphans = (all ?? []).filter((p) => !p.group_id);

  console.log(`Handlowcy bez grupy: ${orphans.length} (zespół z grupą: ${team.length})`);
  if (!orphans.length) return;

  let migratedOrders = 0;
  let deleted = 0;
  const blocked: string[] = [];

  for (const orphan of orphans) {
    const target = findMergeTarget(orphan, team);
    const importLike = !isManagedSalesPersonEmail(orphan.email);
    const label = `${orphan.name} <${orphan.email}>`;

    const { data: orders } = await supabase
      .from("individual_orders")
      .select("id, sales_client_name")
      .eq("sales_person_id", orphan.id);

    const orderCount = orders?.length ?? 0;

    if (orderCount > 0) {
      if (!target) {
        blocked.push(`${label} — ${orderCount} zamówień, brak karty docelowej`);
        continue;
      }
      console.log(
        apply ? "→" : "•",
        label,
        `→ ${target.id.slice(0, 8)}… (${orderCount} zamówień)`,
        importLike ? "[import]" : ""
      );
      if (apply) {
        for (const o of orders ?? []) {
          const patch: { sales_person_id: string; sales_client_name?: string } = {
            sales_person_id: target.id,
          };
          if (target.clientName && !o.sales_client_name?.trim()) {
            patch.sales_client_name = target.clientName;
          }
          const { error: upErr } = await supabase
            .from("individual_orders")
            .update(patch)
            .eq("id", o.id);
          if (upErr) throw upErr;
        }
        migratedOrders += orderCount;
      } else {
        migratedOrders += orderCount;
      }
    }

    const { data: linkedProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("sales_person_id", orphan.id)
      .maybeSingle();

    if (linkedProfile) {
      blocked.push(`${label} — powiązany profil ${linkedProfile.email ?? ""}`);
      continue;
    }

    const { count: remaining } = await supabase
      .from("individual_orders")
      .select("id", { count: "exact", head: true })
      .eq("sales_person_id", orphan.id);

    if ((remaining ?? 0) > 0) {
      blocked.push(`${label} — nadal ${remaining} zamówień`);
      continue;
    }

    if (apply) {
      const { error: delErr } = await supabase.from("sales_people").delete().eq("id", orphan.id);
      if (delErr) {
        blocked.push(`${label} — delete: ${delErr.message}`);
        continue;
      }
    }
    deleted += 1;
    if (!orderCount) {
      console.log(apply ? "✓" : "○", "Usuń", label, importLike ? "[import]" : "");
    }
  }

  console.log("\n---");
  console.log(apply ? "Zastosowano" : "Podgląd (dodaj --apply)");
  console.log(`Zamówienia do przeniesienia / przeniesione: ${migratedOrders}`);
  console.log(`Karty do usunięcia / usunięte: ${deleted}`);
  if (blocked.length) {
    console.log(`Zablokowane (${blocked.length}):`);
    for (const b of blocked) console.log("  !", b);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
