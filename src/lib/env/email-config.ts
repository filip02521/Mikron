import { ONTIME_EMAIL_FROM_NAME } from "@/lib/ui/ontime-brand";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { loadEnvConfig } from "@next/env";

let envLoaded = false;

function readEnvFileVar(name: string): string | undefined {
  const path = [join(process.cwd(), ".env"), join(process.cwd(), ".env.local")].find((p) =>
    existsSync(p)
  );
  if (!path) return undefined;
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

/** Gwarantuje wczytanie .env / .env.local przez Next.js */
function ensureEnvLoaded() {
  if (envLoaded) return;
  loadEnvConfig(process.cwd());
  envLoaded = true;
}

/**
 * Opcjonalna zmienna env — jeśli w shellu jest pusta, dotenv jej nie nadpisuje;
 * wtedy czytamy bezpośrednio z pliku .env.
 */
function readOptionalEnv(name: string): string | undefined {
  ensureEnvLoaded();
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  return readEnvFileVar(name);
}

export function getSmtpHost(): string | undefined {
  return readOptionalEnv("SMTP_HOST");
}

export function getSmtpPort(): number {
  const raw = readOptionalEnv("SMTP_PORT");
  if (!raw) return 587;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 587;
}

export function getSmtpUser(): string | undefined {
  return readOptionalEnv("SMTP_USER");
}

export function getSmtpPass(): string | undefined {
  return readOptionalEnv("SMTP_PASS");
}

/** STARTTLS na 587 → false; SSL na 465 → true. */
export function getSmtpSecure(): boolean {
  const raw = readOptionalEnv("SMTP_SECURE");
  if (!raw) return false;
  return raw === "true" || raw === "1";
}

/** Zweryfikowana domena w Amazon SES (np. ontime.mikran.pl). */
export function getEmailDomain(): string | undefined {
  return readOptionalEnv("EMAIL_DOMAIN");
}

/** Lokalna część nadawcy przy składaniu z EMAIL_DOMAIN (domyślnie OnTime@). */
function getEmailFromLocalPart(): string {
  return readOptionalEnv("EMAIL_FROM_LOCAL") || "OnTime";
}

/**
 * Adres nadawcy z domeny projektu.
 * Bez EMAIL_DOMAIN zwraca pusty string — wtedy `isEmailConfigured()` jest false,
 * chyba że `EMAIL_FROM` zawiera pełny adres z `@`.
 */
export function getDefaultSenderAddress(): string {
  const domain = getEmailDomain();
  if (!domain) return "";
  return `${getEmailFromLocalPart()}@${domain}`;
}

export function getDefaultEmailFrom(): string {
  const address = getDefaultSenderAddress();
  if (!address) return "";
  return `${ONTIME_EMAIL_FROM_NAME} <${address}>`;
}

/** SES wymaga `email@domena` lub `Nazwa <email@domena>`. */
function normalizeEmailFrom(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return getDefaultEmailFrom();
  if (/<[^>]+@[^>]+>/.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
  const defaultAddress = getDefaultSenderAddress();
  if (!defaultAddress) return value;
  return `${value} <${defaultAddress}>`;
}

export function getEmailFromAddress(): string {
  const fromProcess = readOptionalEnv("EMAIL_FROM");
  return normalizeEmailFrom(fromProcess);
}

function hasSenderIdentity(): boolean {
  const from = readOptionalEnv("EMAIL_FROM");
  if (from?.includes("@")) return true;
  return Boolean(getEmailDomain());
}

/** SMTP host+user+pass oraz tożsamość nadawcy (EMAIL_FROM z @ lub EMAIL_DOMAIN). */
export function isEmailConfigured(): boolean {
  return Boolean(
    getSmtpHost() && getSmtpUser() && getSmtpPass() && hasSenderIdentity()
  );
}

/** Override odbiorcy (testy) — ten sam fallback pliku co SMTP_* przy pustej zmiennej w shellu. */
export function getEmailOverrideTo(): string | undefined {
  return readOptionalEnv("EMAIL_OVERRIDE_TO");
}
