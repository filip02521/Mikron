/**
 * Sprawdza konfigurację projektu przed uruchomieniem.
 * Użycie: npx tsx scripts/setup-check.ts
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  getEmailFromAddress,
} from "../src/lib/env/email-config";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(): Record<string, string> {
  const path = [join(root, ".env"), join(root, ".env.local")].find((p) => existsSync(p));
  if (!path) return {};
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
  const env = { ...process.env, ...loadEnvFile() };
  const issues: string[] = [];
  const ok: string[] = [];

  const nodeCheck = assessNodeRuntime();
  if (nodeCheck.issue) issues.push(nodeCheck.issue);
  else if (nodeCheck.ok) ok.push(nodeCheck.ok);

  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
  ];
  for (const key of required) {
    if (!env[key] || env[key]!.includes("your-") || env[key]!.includes("CHANGE_ME")) {
      issues.push(`Brak lub placeholder: ${key}`);
    } else {
      ok.push(key);
    }
  }

  if (env.DEV_ADMIN_MODE === "true") {
    ok.push("DEV_ADMIN_MODE (dev bez logowania)");
  } else if (process.env.NODE_ENV !== "production") {
    ok.push("Logowanie lokalne (cookie ontime_session; produkcja: DEV_ADMIN_MODE=false)");
  }

  if (!env.CRON_SECRET || env.CRON_SECRET === "change-me-in-production") {
    issues.push("Ustaw CRON_SECRET przed produkcją");
  } else {
    ok.push("CRON_SECRET");
  }

  const smtpHost = env.SMTP_HOST?.trim();
  const smtpUser = env.SMTP_USER?.trim();
  const smtpPass = env.SMTP_PASS?.trim();
  if (!smtpHost || !smtpUser || !smtpPass) {
    issues.push(
      "Brak SMTP_HOST / SMTP_USER / SMTP_PASS — powiadomienia e-mail nie będą wysyłane"
    );
  } else {
    ok.push(`SMTP (${smtpHost})`);
  }

  if (env.EMAIL_DOMAIN) {
    ok.push(`EMAIL_DOMAIN (${env.EMAIL_DOMAIN})`);
  } else if (smtpHost && smtpUser && smtpPass && !env.EMAIL_FROM?.includes("@")) {
    issues.push("Brak EMAIL_DOMAIN — ustaw zweryfikowaną domenę SES (np. ontime.mikran.pl)");
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
  } else if (smtpHost && smtpUser && smtpPass && !env.EMAIL_DOMAIN) {
    issues.push(
      "Brak EMAIL_FROM i EMAIL_DOMAIN — ustaw nadawcę z domeny zweryfikowanej w SES"
    );
  }

  if (env.EMAIL_OVERRIDE_TO) {
    ok.push(`EMAIL_OVERRIDE_TO (${env.EMAIL_OVERRIDE_TO}) — wszystkie maile na ten adres`);
  }

  const appUrl = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    issues.push(
      "Brak APP_URL / NEXT_PUBLIC_APP_URL — linki resetu hasła i maile będą niepoprawne"
    );
  } else if (appUrl.includes("192.168.10.173")) {
    issues.push(
      "NEXT_PUBLIC_APP_URL wskazuje stary adres dev (192.168.10.173) — ustaw http://ontime.mikran.pl:3000"
    );
  } else if (appUrl.includes("localhost") && process.env.NODE_ENV === "production") {
    issues.push(
      "APP_URL / NEXT_PUBLIC_APP_URL=localhost w produkcji — ustaw http://ontime.mikran.pl:3000"
    );
  } else {
    ok.push(`APP_URL (${appUrl})`);
    process.env.APP_URL = env.APP_URL?.trim() || appUrl;
    process.env.NEXT_PUBLIC_APP_URL = env.NEXT_PUBLIC_APP_URL?.trim() || appUrl;
    process.env.APP_SERVER_HOST = env.APP_SERVER_HOST;
    process.env.APP_PORT = env.APP_PORT;
    process.env.APP_EXTRA_REDIRECT_URLS = env.APP_EXTRA_REDIRECT_URLS;
    const { getAppUrl } = await import("../src/lib/env/app-config");
    console.log(`\nAPP_URL: ${getAppUrl()}\n`);
  }

  if (env.DATABASE_URL) {
    try {
      process.env.DATABASE_URL = env.DATABASE_URL;
      const { createAdminClient } = await import("../src/lib/db/admin");
      const db = createAdminClient();
      const tables = ["suppliers", "sales_people", "profiles", "app_users"] as const;
      for (const t of tables) {
        const { error, count } = await db
          .from(t)
          .select("*", { count: "exact", head: true });
        if (error?.message?.includes("does not exist") || error?.code === "42P01") {
          issues.push(`Tabela ${t} nie istnieje — uruchom npm run db:migrate`);
        } else if (error) {
          issues.push(`Błąd ${t}: ${error.message}`);
        } else {
          ok.push(`${t}: ${count ?? 0} wierszy`);
        }
      }

      const { runSchemaChecks } = await import("../src/lib/supabase/schema-check");
      const schema = await runSchemaChecks(db);
      if (schema.ok) {
        ok.push("Schemat bazy (schema-check)");
      } else {
        issues.push(...schema.issues);
      }
    } catch (e) {
      issues.push(`Połączenie Postgres: ${e instanceof Error ? e.message : e}`);
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
    console.log("  1. cp .env.example .env.local && uzupełnij DATABASE_URL / SESSION_SECRET");
    console.log("  2. docker compose -f docker-compose.db.yml up -d && npm run db:migrate");
    console.log("  3. npm run seed");
    process.exit(1);
  }
  console.log("\nKonfiguracja wygląda poprawnie.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
