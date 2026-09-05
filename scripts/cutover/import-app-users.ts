/**
 * Import auth.users CSV → app_users + app_user_invites (cross-platform).
 * Usage: npx tsx scripts/cutover/import-app-users.ts --csv data/cutover/auth_users_export.csv
 */
import { readFileSync } from "fs";
import pg from "pg";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const csvPath = arg("--csv");
  const url = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
  if (!csvPath || !url) {
    console.error("Wymagane: --csv path oraz DATABASE_MIGRATE_URL/DATABASE_URL");
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf-8").trim();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) {
    console.error("CSV pusty");
    process.exit(1);
  }
  const header = parseCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const idI = idx("id");
  const emailI = idx("email");
  const passI = idx("encrypted_password");
  const confirmedI = idx("email_confirmed_at");
  const createdI = idx("created_at");
  const metaI = idx("raw_user_meta_data");
  if ([idI, emailI, passI, createdI].some((i) => i < 0)) {
    console.error("CSV brak wymaganych kolumn:", header.join(", "));
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("ALTER TABLE app_users DISABLE TRIGGER on_app_user_created");
    await client.query("BEGIN");
    let users = 0;
    let invites = 0;
    for (let li = 1; li < lines.length; li++) {
      const cols = parseCsvLine(lines[li]);
      const id = cols[idI]?.trim();
      const email = cols[emailI]?.trim().toLowerCase();
      const password = cols[passI]?.trim();
      if (!id || !email || !password) continue;

      const confirmed = cols[confirmedI]?.trim() || null;
      const created = cols[createdI]?.trim() || new Date().toISOString();
      const metaRaw = metaI >= 0 ? cols[metaI]?.trim() : "";
      let meta: Record<string, unknown> = {};
      if (metaRaw) {
        try {
          meta = JSON.parse(metaRaw) as Record<string, unknown>;
        } catch {
          meta = {};
        }
      }

      await client.query(
        `INSERT INTO app_users (id, email, password_hash, email_confirmed_at, created_at)
         VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
         ON CONFLICT (id) DO NOTHING`,
        [id, email, password, confirmed, created]
      );
      users += 1;

      const spId = meta.sales_person_id;
      if (typeof spId === "string" && spId.trim()) {
        await client.query(
          `INSERT INTO app_user_invites (user_id, sales_person_id)
           VALUES ($1, $2::uuid)
           ON CONFLICT (user_id) DO UPDATE SET sales_person_id = EXCLUDED.sales_person_id`,
          [id, spId.trim()]
        );
        invites += 1;
      }
    }
    await client.query("COMMIT");

    const { rows: counts } = await client.query<{ app_users: string; orphan_profiles: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM app_users) AS app_users,
         (SELECT COUNT(*)::text FROM profiles p LEFT JOIN app_users u ON u.id = p.id WHERE u.id IS NULL) AS orphan_profiles`
    );
    console.log(`import-app-users: ${users} wierszy CSV, ${invites} zaproszeń`);
    console.log(`app_users=${counts[0]?.app_users}, orphan_profiles=${counts[0]?.orphan_profiles}`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.query("ALTER TABLE app_users ENABLE TRIGGER on_app_user_created").catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
