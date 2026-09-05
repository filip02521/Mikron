/**
 * Weryfikuje DATABASE_URL i SELECT 1.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

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

async function main() {
  const env = {
    ...loadEnvFile(join(process.cwd(), ".env")),
    ...loadEnvFile(join(process.cwd(), ".env.local")),
    ...process.env,
  };
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.error("✗ Brak DATABASE_URL");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("SELECT 1");
    const version = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations ORDER BY applied_at DESC LIMIT 1`
    ).catch(() => ({ rows: [] as { filename: string }[] }));
    console.log("✓ DATABASE_URL — połączenie OK");
    if (version.rows[0]) {
      console.log(`✓ Ostatnia migracja: ${version.rows[0].filename}`);
    }
  } catch (error) {
    console.error("✗ Błąd połączenia z Postgres:", error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
