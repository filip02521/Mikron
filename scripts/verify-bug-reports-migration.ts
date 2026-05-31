/**
 * Smoke test tabeli sales_bug_reports po migracji 049.
 * Użycie: npx tsx scripts/verify-bug-reports-migration.ts
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal(): Record<string, string> {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() } as Record<string, string>;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { error: headErr } = await supabase
    .from("sales_bug_reports")
    .select("id", { count: "exact", head: true });
  if (headErr) {
    console.error("Tabela sales_bug_reports:", headErr.message);
    process.exit(1);
  }
  console.log("✓ tabela sales_bug_reports istnieje");

  const { data: linked, error: linkErr } = await supabase
    .from("profiles")
    .select("id, sales_person_id, sales_people(name)")
    .not("sales_person_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (linkErr || !linked?.sales_person_id) {
    console.error("Brak profilu powiązanego z handlowcem:", linkErr?.message);
    process.exit(1);
  }

  const spName =
    (linked.sales_people as { name?: string } | null)?.name ?? "Handlowiec";

  const smokeMessage = `[smoke-test ${Date.now()}] weryfikacja migracji 049`;
  const { data: inserted, error: insErr } = await supabase
    .from("sales_bug_reports")
    .insert({
      profile_id: linked.id,
      sales_person_id: linked.sales_person_id,
      reporter_name: spName,
      reporter_email: "smoke@test.local",
      page_path: "/moje",
      message: smokeMessage,
      status: "open",
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    console.error("Insert failed:", insErr?.message);
    process.exit(1);
  }
  console.log("✓ insert OK");

  const { count, error: countErr } = await supabase
    .from("sales_bug_reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");
  if (countErr || (count ?? 0) < 1) {
    console.error("Count open failed:", countErr?.message);
    process.exit(1);
  }
  console.log("✓ count open OK");

  const { data: updated, error: updErr } = await supabase
    .from("sales_bug_reports")
    .update({ status: "closed", admin_note: "smoke ok" })
    .eq("id", inserted.id)
    .select("status")
    .single();
  if (updErr || updated?.status !== "closed") {
    console.error("Update failed:", updErr?.message);
    process.exit(1);
  }
  console.log("✓ update status OK");

  const { error: delErr } = await supabase
    .from("sales_bug_reports")
    .delete()
    .eq("id", inserted.id);
  if (delErr) {
    console.error("Delete failed:", delErr.message);
    process.exit(1);
  }
  console.log("✓ cleanup OK");
  console.log("\nMigracja 049 — weryfikacja zakończona pomyślnie.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
