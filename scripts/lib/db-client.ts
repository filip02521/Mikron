import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { createAdminClient, type DatabaseClient } from "../../src/lib/db/admin";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadScriptEnv(): Record<string, string> {
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
      if (!(key in out) || out[key] === undefined) out[key] = val;
    }
  }
  for (const [k, v] of Object.entries(out)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return out;
}

export function requireDatabaseUrl(): string {
  const env = loadScriptEnv();
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Ustaw DATABASE_URL (.env / .env.local)");
  }
  return url;
}

export function createScriptPool() {
  const url = requireDatabaseUrl();
  return new pg.Pool({ connectionString: url });
}

/** Klient PostgREST-kompatybilny dla skryptów (dawniej createClient(url, key)). */
export function createScriptAdminClient(): DatabaseClient {
  requireDatabaseUrl();
  return createAdminClient();
}
