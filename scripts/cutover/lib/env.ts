import { existsSync, readFileSync } from "fs";
import { join } from "path";

export function loadCutoverEnv(): Record<string, string> {
  const root = process.cwd();
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const name of [".env", ".env.local"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
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
      const key = t.slice(0, i).trim();
      if (!(key in out) || !out[key]) out[key] = val;
    }
  }
  return out;
}

function readCommentedEnvKey(key: string): string | null {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    const m = t.match(new RegExp(`^#\\s*${key}=(.+)$`));
    if (m) return m[1].trim();
  }
  return null;
}

function readArchivedSupabaseDbUrl(): string | null {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    const m = t.match(/^#\s*archived supabase DATABASE_URL=(.+)$/i);
    if (m) return m[1].trim();
  }
  return null;
}

/** URL PostgreSQL Supabase (direct lub pooler :5432). */
export function resolveSupabaseDbUrl(env: Record<string, string>): string {
  const explicit =
    env.SUPABASE_DB_URL?.trim() || env.SUPABASE_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const archived = readArchivedSupabaseDbUrl();
  if (archived) return archived;

  const password =
    env.SUPABASE_DB_PASSWORD?.trim() || readCommentedEnvKey("SUPABASE_DB_PASSWORD");
  const publicUrl =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    readCommentedEnvKey("NEXT_PUBLIC_SUPABASE_URL");
  if (!password || !publicUrl) {
    throw new Error(
      "Brak SUPABASE_DB_URL — ustaw w .env.local lub odkomentuj SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL"
    );
  }
  const ref = publicUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error("Nie rozpoznano ref z NEXT_PUBLIC_SUPABASE_URL");
  const host = env.SUPABASE_DB_HOST?.trim() || "aws-0-eu-west-1.pooler.supabase.com";
  const user = env.SUPABASE_DB_USER?.trim() || `postgres.${ref}`;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/postgres`;
}

export function resolveSupabaseStorageCredentials(env: Record<string, string>): {
  url: string;
  key: string;
} {
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    readCommentedEnvKey("NEXT_PUBLIC_SUPABASE_URL") ||
    "";
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    readCommentedEnvKey("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
  if (!url || !key) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (odkomentuj w .env.local na czas cutover storage)"
    );
  }
  return { url, key };
}

export function resolveTargetDbUrl(env: Record<string, string>): string {
  const url = env.DATABASE_MIGRATE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!url) throw new Error("Brak DATABASE_URL / DATABASE_MIGRATE_URL");
  return url;
}
