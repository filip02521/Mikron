/**
 * Sprawdza konfigurację projektu przed uruchomieniem.
 * Użycie: npx tsx scripts/setup-check.ts
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  getEmailDomain,
  getEmailFromAddress,
  isEmailConfigured,
} from "../src/lib/env/email-config";

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

const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 9;

function parseNodeVersion(version: string): [major: number, minor: number, patch: number] {
  const match = version.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function readRecommendedNodeMajor(): number {
  const nvmrcPath = join(root, ".nvmrc");
  if (!existsSync(nvmrcPath)) return 24;
  const raw = readFileSync(nvmrcPath, "utf-8").trim();
  const major = Number.parseInt(raw.split(".")[0] ?? raw, 10);
  return Number.isFinite(major) && major > 0 ? major : 24;
}

function assessNodeRuntime(): { ok?: string; issue?: string } {
  const [major, minor] = parseNodeVersion(process.version);
  if (major < MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)) {
    return {
      issue: `Node ${process.version} — wymagane minimum ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} (zalecany ${readRecommendedNodeMajor()} LTS, plik .nvmrc)`,
    };
  }
  const recommended = readRecommendedNodeMajor();
  if (major < recommended) {
    return {
      ok: `Node ${process.version} (OK; zalecany ${recommended} LTS — nvm use)`,
    };
  }
  return { ok: `Node ${process.version}` };
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const issues: string[] = [];
  const ok: string[] = [];

  const nodeCheck = assessNodeRuntime();
  if (nodeCheck.issue) issues.push(nodeCheck.issue);
  else if (nodeCheck.ok) ok.push(nodeCheck.ok);

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

  if (env.EMAIL_DOMAIN) {
    ok.push(`EMAIL_DOMAIN (${env.EMAIL_DOMAIN})`);
  } else if (isEmailConfigured()) {
    issues.push("Brak EMAIL_DOMAIN — ustaw zweryfikowaną domenę Resend");
  }

  if (env.EMAIL_FROM) {
    ok.push(`EMAIL_FROM (${env.EMAIL_FROM})`);
    const normalized = getEmailFromAddress();
    if (!normalized.includes("@")) {
      issues.push("EMAIL_FROM — nieprawidłowy format (wymagane: Nazwa <adres@domena>)");
    } else if (env.EMAIL_FROM.trim() === normalized && !env.EMAIL_FROM.includes("@")) {
      issues.push(
        `EMAIL_FROM to sama etykieta („${env.EMAIL_FROM}”) — używany zostanie ${normalized}`
      );
    }
  } else if (isEmailConfigured()) {
    issues.push("Brak EMAIL_FROM — używany domyślny adres Resend (sandbox)");
  }

  if (env.EMAIL_OVERRIDE_TO) {
    ok.push(`EMAIL_OVERRIDE_TO (${env.EMAIL_OVERRIDE_TO}) — wszystkie maile na ten adres`);
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    issues.push("Brak NEXT_PUBLIC_APP_URL — linki resetu hasła i maile będą niepoprawne");
  } else if (appUrl.includes("192.168.10.173")) {
    issues.push(
      "NEXT_PUBLIC_APP_URL wskazuje stary adres dev (192.168.10.173) — ustaw http://ontime.mikran.pl:3000"
    );
  } else if (appUrl.includes("localhost") && process.env.NODE_ENV === "production") {
    issues.push("NEXT_PUBLIC_APP_URL=localhost w produkcji — ustaw http://ontime.mikran.pl:3000");
  } else {
    ok.push(`NEXT_PUBLIC_APP_URL (${appUrl})`);
    process.env.NEXT_PUBLIC_APP_URL = appUrl;
    process.env.APP_SERVER_HOST = env.APP_SERVER_HOST;
    process.env.APP_PORT = env.APP_PORT;
    process.env.APP_EXTRA_REDIRECT_URLS = env.APP_EXTRA_REDIRECT_URLS;
    const { getSupabaseAuthRedirectUrls } = await import("../src/lib/env/app-config");
    console.log("\nSupabase → Authentication → Redirect URLs (dopisz wszystkie):");
    for (const redirect of getSupabaseAuthRedirectUrls()) {
      console.log(`  ${redirect}`);
    }
    console.log(`  Site URL: ${appUrl}\n`);
  }

  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );
      const tables = ["suppliers", "sales_people", "profiles", "sales_bug_reports"] as const;
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
