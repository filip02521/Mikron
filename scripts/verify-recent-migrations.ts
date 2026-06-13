/**
 * Weryfikuje migracje 059 (sales_cancelled_quantity) i 060 (password_reset_otps).
 * Użycie: npx tsx scripts/verify-recent-migrations.ts
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
  let failed = false;

  const { error: noteError } = await supabase
    .from("individual_orders")
    .select("sales_cancelled_quantity")
    .limit(0);

  if (noteError?.message?.includes("sales_cancelled_quantity")) {
    console.error("✗ Brak kolumny sales_cancelled_quantity — uruchom migrację 059.");
    failed = true;
  } else if (noteError) {
    console.error("✗ Błąd sprawdzania 059:", noteError.message);
    failed = true;
  } else {
    console.log("✓ migracja 059 — individual_orders.sales_cancelled_quantity");
  }

  const { error: otpError } = await supabase.from("password_reset_otps").select("id").limit(0);

  if (otpError?.message?.includes("password_reset_otps")) {
    console.error("✗ Brak tabeli password_reset_otps — uruchom migrację 060.");
    failed = true;
  } else if (otpError) {
    console.error("✗ Błąd sprawdzania 060:", otpError.message);
    failed = true;
  } else {
    console.log("✓ migracja 060 — password_reset_otps");
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
