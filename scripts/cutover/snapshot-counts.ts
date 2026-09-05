/**
 * Snapshot COUNT(*) wszystkich tabel public → JSON (stdout lub --out).
 */
import { writeFileSync } from "fs";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const counts: Record<string, number> = {};
    for (const { tablename } of rows) {
      const { rows: c } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.${tablename}`
      );
      counts[tablename] = Number(c[0]?.n ?? 0);
    }
    const json = JSON.stringify(counts, null, 2);
    const out = process.argv.includes("--out")
      ? process.argv[process.argv.indexOf("--out") + 1]
      : null;
    if (out) writeFileSync(out, json);
    else console.log(json);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
