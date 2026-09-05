import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(): Record<string, string> {
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
      if (!(t.slice(0, i).trim() in out)) {
        out[t.slice(0, i).trim()] = val;
      }
    }
  }
  return out;
}

const PREFIX_ORDER: Record<string, string[]> = {
  "002": ["002_auth_profile_trigger.sql", "002_interval_raw.sql"],
  "052": ["052_operations_notes.sql", "052_individual_orders_sales_client_kh_id.sql"],
  "060": ["060_password_reset_otps.sql", "060_subiekt_zd_index_status_deadline.sql"],
  "077": ["077_teeth_order_queue.sql", "077b_teeth_order_queue.sql"],
  "080": ["080_teeth_jaw.sql", "080_department_board_thread_close.sql"],
  "082": ["082_teeth_product_kind.sql", "082_teeth_details_sales_rls.sql"],
};

function supabaseMigrationFiles(): string[] {
  const dir = join(root, "supabase/migrations");
  const names = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const grouped = new Map<string, string[]>();
  for (const name of names) {
    const prefix = name.match(/^(\d+)/)?.[1] ?? name;
    const list = grouped.get(prefix) ?? [];
    list.push(name);
    grouped.set(prefix, list);
  }
  const prefixes = [...grouped.keys()].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const ordered: string[] = [];
  for (const prefix of prefixes) {
    const files = grouped.get(prefix) ?? [];
    const preferred = PREFIX_ORDER[prefix];
    if (preferred) {
      for (const name of preferred) {
        if (files.includes(name)) ordered.push(name);
      }
      for (const name of files.sort()) {
        if (!ordered.includes(name)) ordered.push(name);
      }
    } else {
      ordered.push(...files.sort());
    }
  }
  return ordered.map((name) => join(dir, name));
}

function overlayFiles(): string[] {
  const dir = join(root, "db/migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => join(dir, name));
}

async function ensureJournal(client: pg.Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Dzieli SQL na instrukcje z uwzględnieniem $tag$…$tag$ i zwykłych stringów.
 * Potrzebne, bo `ALTER TYPE … ADD VALUE` musi być COMMIT-nięte przed użyciem
 * wartości enum w tej samej sesji (PostgreSQL 55P04).
 */
function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      buf += c;
      if (c === "*" && next === "/") {
        buf += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (dollarTag) {
      const end = sql.indexOf(dollarTag, i);
      if (end === -1) {
        buf += sql.slice(i);
        break;
      }
      buf += sql.slice(i, end + dollarTag.length);
      i = end + dollarTag.length;
      dollarTag = null;
      continue;
    }
    if (inSingle) {
      buf += c;
      if (c === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i += 1;
      continue;
    }

    if (c === "-" && next === "-") {
      buf += c + next;
      i += 2;
      inLineComment = true;
      continue;
    }
    if (c === "/" && next === "*") {
      buf += c + next;
      i += 2;
      inBlockComment = true;
      continue;
    }
    if (c === "'") {
      buf += c;
      inSingle = true;
      i += 1;
      continue;
    }
    if (c === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (c === ";") {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = "";
      i += 1;
      continue;
    }

    buf += c;
    i += 1;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

async function applyFile(client: pg.Client, filePath: string) {
  const filename = filePath.slice(root.length + 1);
  const { rows } = await client.query(
    `SELECT 1 FROM schema_migrations WHERE filename = $1`,
    [filename]
  );
  if (rows.length) {
    console.log("skip", filename);
    return;
  }
  const sql = readFileSync(filePath, "utf-8");
  console.log("apply", filename);
  for (const statement of splitSqlStatements(sql)) {
    await client.query(statement);
  }
  await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
}

async function main() {
  const env = loadEnv();
  const url = (env.DATABASE_MIGRATE_URL || env.DATABASE_URL)?.trim();
  if (!url) {
    console.error("Brak DATABASE_MIGRATE_URL / DATABASE_URL");
    process.exit(1);
  }
  if (env.DATABASE_MIGRATE_URL?.trim()) {
    console.log("używam DATABASE_MIGRATE_URL");
  }
  const files = [...overlayFiles().filter((f) => f.includes("0000_")), ...supabaseMigrationFiles(), ...overlayFiles().filter((f) => !f.includes("0000_"))];

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await ensureJournal(client);
    for (const file of files) {
      await applyFile(client, file);
    }
    console.log("OK: migracje zastosowane");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
