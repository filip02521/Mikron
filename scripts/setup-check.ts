/**
 * Sprawdza konfigurację projektu przed uruchomieniem.
 * Użycie: npx tsx scripts/setup-check.ts
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { fileURLToPath } from "url";
import { dirname } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal(): Record<string, string> {
  const path = join(root, ".env.local");
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
  const env = { ...process.env, ...loadEnvLocal() };
  const issues: string[] = [];
  const ok: string[] = [];

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const key of required) {
    if (!env[key] || env[key]!.includes("your-")) {
      issues.push(`Brak lub placeholder: ${key}`);
    } else {
      ok.push(key);
    }
  }

  if (env.DEV_ADMIN_MODE === "true") {
    ok.push("DEV_ADMIN_MODE (dev bez logowania)");
  } else if (process.env.NODE_ENV !== "production") {
    ok.push("Logowanie Supabase Auth na chronionych trasach (produkcja: DEV_ADMIN_MODE=false)");
  }

  if (!env.CRON_SECRET || env.CRON_SECRET === "change-me-in-production") {
    issues.push("Ustaw CRON_SECRET przed produkcją");
  } else {
    ok.push("CRON_SECRET");
  }

  if (!env.RESEND_API_KEY) {
    issues.push("Brak RESEND_API_KEY — powiadomienia e-mail nie będą wysyłane");
  } else {
    ok.push("RESEND_API_KEY");
  }

  if (env.EMAIL_FROM) {
    ok.push(`EMAIL_FROM (${env.EMAIL_FROM})`);
  }

  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );
      const tables = ["suppliers", "sales_people", "profiles"] as const;
      for (const t of tables) {
        const { error, count } = await supabase
          .from(t)
          .select("*", { count: "exact", head: true });
        if (error?.message?.includes("does not exist")) {
          issues.push(`Tabela ${t} nie istnieje — uruchom migracje SQL w Supabase`);
        } else if (error) {
          issues.push(`Błąd ${t}: ${error.message}`);
        } else {
          ok.push(`${t}: ${count ?? 0} wierszy`);
        }
      }

      const { runSchemaChecks } = await import("../src/lib/supabase/schema-check");
      const schema = await runSchemaChecks(supabase);
      if (schema.ok) {
        ok.push("Schemat bazy (migracje 006–013)");
      } else {
        issues.push(...schema.issues);
      }
    } catch (e) {
      issues.push(`Połączenie Supabase: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n=== System Dostaw — setup check ===\n");
  if (ok.length) {
    console.log("OK:");
    ok.forEach((l) => console.log("  ✓", l));
  }
  if (issues.length) {
    console.log("\nDo poprawy:");
    issues.forEach((l) => console.log("  ✗", l));
    console.log("\nKroki:");
    console.log("  1. cp .env.example .env.local");
    console.log(
      "  2. SQL Editor: migracje z supabase/migrations/ (min. 001, 002, 004–006)"
    );
    console.log("  3. echo DEV_ADMIN_MODE=true >> .env.local  (dev)");
    console.log("  4. npm run seed  lub  npm run migrate -- ./data");
    process.exit(1);
  }
  console.log("\nKonfiguracja wygląda poprawnie.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
