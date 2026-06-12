/**
 * Weryfikuje kolumnę individual_orders.sales_request_note (migracja 058).
 * Użycie: npx tsx scripts/verify-sales-request-note-migration.ts
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
  const { error } = await supabase
    .from("individual_orders")
    .select("sales_request_note")
    .limit(0);

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("sales_request_note")) {
      console.error("✗ Brak kolumny sales_request_note — uruchom migrację 058.");
      process.exit(1);
    }
    console.error("Błąd sprawdzania kolumny:", msg);
    process.exit(1);
  }

  console.log("✓ kolumna individual_orders.sales_request_note jest dostępna");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
