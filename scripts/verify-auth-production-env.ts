/**
 * Weryfikuje sekrety auth wymagane na produkcji.
 * Użycie: npx tsx scripts/verify-auth-production-env.ts
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(path: string): Record<string, string> {
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

function loadEnv(): Record<string, string> {
  const cwd = process.cwd();
  return {
    ...loadEnvFile(join(cwd, ".env")),
    ...loadEnvFile(join(cwd, ".env.local")),
    ...process.env,
  } as Record<string, string>;
}

const MIN_OTP_SECRET_LENGTH = 32;

function main() {
  const env = loadEnv();
  let failed = false;

  const otpSecret = env.PASSWORD_RESET_OTP_SECRET?.trim() ?? "";
  if (!otpSecret) {
    console.error(
      "✗ Brak PASSWORD_RESET_OTP_SECRET — reset hasła OTP nie zadziała na produkcji."
    );
    failed = true;
  } else if (otpSecret.length < MIN_OTP_SECRET_LENGTH) {
    console.error(
      `✗ PASSWORD_RESET_OTP_SECRET za krótki (${otpSecret.length} znaków) — użyj min. ${MIN_OTP_SECRET_LENGTH}.`
    );
    failed = true;
  } else if (otpSecret === env.SESSION_SECRET?.trim()) {
    console.warn(
      "⚠ PASSWORD_RESET_OTP_SECRET = SESSION_SECRET — działa, ale lepiej osobny losowy sekret."
    );
    console.log("✓ PASSWORD_RESET_OTP_SECRET ustawiony");
  } else {
    console.log("✓ PASSWORD_RESET_OTP_SECRET ustawiony");
  }

  const sessionSecret = env.SESSION_SECRET?.trim() ?? "";
  if (!sessionSecret || sessionSecret.length < 32) {
    console.error("✗ SESSION_SECRET wymagany (min. 32 znaki). Wygeneruj: openssl rand -hex 32");
    failed = true;
  } else {
    console.log("✓ SESSION_SECRET ustawiony");
  }

  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    console.error("✗ Brak DATABASE_URL");
    failed = true;
  } else {
    console.log("✓ DATABASE_URL ustawiony");
  }

  const storageSecret = env.STORAGE_SIGNING_SECRET?.trim() ?? "";
  if (!storageSecret || storageSecret.length < 32) {
    console.warn("⚠ STORAGE_SIGNING_SECRET brak lub za krótki — upload plików wymaga min. 32 znaków.");
  } else {
    console.log("✓ STORAGE_SIGNING_SECRET ustawiony");
  }

  const cron = env.CRON_SECRET?.trim() ?? "";
  if (!cron || cron === "change-me-in-production") {
    console.error("✗ Ustaw CRON_SECRET (inny niż change-me-in-production).");
    failed = true;
  } else {
    console.log("✓ CRON_SECRET ustawiony");
  }

  if (failed) {
    console.error(
      "\nWygeneruj sekret OTP: openssl rand -hex 32\nDodaj do .env na serwerze i zrestartuj aplikację (npm run build && restart)."
    );
    process.exit(1);
  }

  const e2eLab = env.E2E_LAB?.trim() ?? "";
  if (e2eLab === "1") {
    console.error("✗ E2E_LAB=1 jest zabronione na produkcji — wyłącz przed deployem.");
    process.exit(1);
  }

  const setupToken = env.SETUP_TOKEN?.trim() ?? "";
  if (!setupToken) {
    console.warn(
      "⚠ Brak SETUP_TOKEN — bootstrap admina na produkcji wymaga tokenu w URL (/setup?token=...)."
    );
  } else if (setupToken.length < 16) {
    console.error("✗ SETUP_TOKEN za krótki — użyj min. 16 znaków (openssl rand -hex 16).");
    process.exit(1);
  } else {
    console.log("✓ SETUP_TOKEN ustawiony");
  }
}

main();
