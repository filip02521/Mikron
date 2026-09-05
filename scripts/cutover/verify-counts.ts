/**
 * Porównuje COUNT(*) tabel public z snapshotem JSON.
 * Usage: npx tsx scripts/cutover/verify-counts.ts --source counts.json
 */
import { readFileSync } from "fs";
import pg from "pg";

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

async function main() {
  const sourcePath = arg("--source");
  const url = process.env.DATABASE_URL;
  if (!sourcePath || !url) {
    console.error("Wymagane: --source counts.json oraz DATABASE_URL");
    process.exit(1);
  }
  const expected = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, number>;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    let failed = false;
    for (const [table, count] of Object.entries(expected)) {
      if (table.startsWith("__")) continue;
      const { rows } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.${table.replace(/[^a-z0-9_]/gi, "")}`
      );
      const actual = Number(rows[0]?.n ?? 0);
      const ok = actual === count;
      console.log(`${ok ? "OK" : "DIFF"} ${table}: expected ${count}, got ${actual}`);
      if (!ok) failed = true;
    }

    const expectedAuth = expected.__auth_users;
    if (typeof expectedAuth === "number") {
      const { rows } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM app_users`
      );
      const actual = Number(rows[0]?.n ?? 0);
      const ok = actual === expectedAuth;
      console.log(`${ok ? "OK" : "DIFF"} app_users (from auth.users): expected ${expectedAuth}, got ${actual}`);
      if (!ok) failed = true;
    }

    const orphans = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM profiles p LEFT JOIN app_users u ON u.id = p.id WHERE u.id IS NULL`
    );
    const orphanCount = Number(orphans.rows[0]?.n ?? 0);
    console.log(`${orphanCount === 0 ? "OK" : "DIFF"} orphan_profiles: ${orphanCount}`);
    if (orphanCount !== 0) failed = true;

    if (failed) process.exit(1);
    console.log("verify-counts: PASS");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
