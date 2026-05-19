import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { loadEnvConfig } from "@next/env";

let envLoaded = false;

function readEnvLocalVar(name: string): string | undefined {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    if (t.slice(0, i).trim() !== name) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val || undefined;
  }
  return undefined;
}

/** Gwarantuje wczytanie .env.local */
function ensureEnvLoaded() {
  if (envLoaded) return;
  loadEnvConfig(process.cwd());
  envLoaded = true;
}

/**
 * RESEND_API_KEY — jeśli w shellu jest pusta zmienna, dotenv jej nie nadpisuje;
 * wtedy czytamy bezpośrednio z .env.local.
 */
export function getResendApiKey(): string | undefined {
  ensureEnvLoaded();
  const fromProcess = process.env.RESEND_API_KEY?.trim();
  if (fromProcess) return fromProcess;
  return readEnvLocalVar("RESEND_API_KEY");
}

export function getEmailFromAddress(): string {
  ensureEnvLoaded();
  const fromProcess = process.env.EMAIL_FROM?.trim();
  const fromFile = readEnvLocalVar("EMAIL_FROM");
  return fromProcess || fromFile || "Mikran - Asystent Zamówień <onboarding@resend.dev>";
}

export function isEmailConfigured(): boolean {
  return Boolean(getResendApiKey());
}
