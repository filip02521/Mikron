/**
 * Warstwa logiki migracji — współdzielona między `scripts/db-migrate.ts`
 * a server actions panelu admina. Czyta pliki z `supabase/migrations/`,
 * porównuje z tabelą `schema_migrations` i aplikuje oczekujące.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { PoolClient } from "pg";
import { withClient } from "./pool";

const root =
  typeof __dirname !== "undefined"
    ? join(__dirname, "..", "..")
    : join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Kolejność plików w obrębie tego samego prefixu (gdy jest kilka wersji). */
const PREFIX_ORDER: Record<string, string[]> = {
  "002": ["002_auth_profile_trigger.sql", "002_interval_raw.sql"],
  "052": ["052_operations_notes.sql", "052_individual_orders_sales_client_kh_id.sql"],
  "060": ["060_password_reset_otps.sql", "060_subiekt_zd_index_status_deadline.sql"],
  "077": ["077_teeth_order_queue.sql", "077b_teeth_order_queue.sql"],
  "080": ["080_teeth_jaw.sql", "080_department_board_thread_close.sql"],
  "082": ["082_teeth_product_kind.sql", "082_teeth_details_sales_rls.sql"],
};

export function migrationFiles(): string[] {
  const dir = join(root, "supabase", "migrations");
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const grouped = new Map<string, string[]>();
  for (const name of names) {
    const prefix = name.match(/^(\d+)/)?.[1] ?? name;
    const list = grouped.get(prefix) ?? [];
    list.push(name);
    grouped.set(prefix, list);
  }
  const prefixes = [...grouped.keys()].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
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

/** Zwraca nazwę względną (z prefixem supabase/migrations/) — klucz w schema_migrations. */
export function migrationKey(filePath: string): string {
  return filePath.slice(root.length + 1).replace(/\\/g, "/");
}

/** Dzieli SQL na instrukcje z uwzględnieniem $tag$…$tag$ i zwykłych stringów. */
export function splitSqlStatements(sql: string): string[] {
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

export interface PendingMigration {
  filename: string;
  size: number;
  preview: string;
}

export interface AppliedMigration {
  filename: string;
  applied_at: string;
}

export interface MigrationStatus {
  pending: PendingMigration[];
  appliedCount: number;
  totalFiles: number;
}

export async function ensureJournal(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/** Zwraca listę oczekujących migracji + liczbę zastosowanych. */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  return withClient(async (client) => {
    await ensureJournal(client);
    const { rows } = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations ORDER BY filename`,
    );
    const applied = new Set(rows.map((r) => r.filename));
    const files = migrationFiles();
    const pending: PendingMigration[] = [];
    for (const filePath of files) {
      const key = migrationKey(filePath);
      if (applied.has(key)) continue;
      const content = readFileSync(filePath, "utf-8");
      const preview = content.slice(0, 500);
      pending.push({ filename: key, size: content.length, preview });
    }
    return {
      pending,
      appliedCount: applied.size,
      totalFiles: files.length,
    };
  });
}

/** Wynik aplikacji pojedynczej migracji. */
export interface MigrationApplyResult {
  filename: string;
  success: boolean;
  error?: string;
  statementsApplied: number;
}

/** Aplikuje pojedynczą migrację po nazwie pliku (klucz z migrationKey). */
export async function applyMigration(
  filename: string,
): Promise<MigrationApplyResult> {
  const files = migrationFiles();
  const filePath = files.find((f) => migrationKey(f) === filename);
  if (!filePath) {
    return { filename, success: false, error: "Plik migracji nie istnieje", statementsApplied: 0 };
  }
  const sql = readFileSync(filePath, "utf-8");
  const statements = splitSqlStatements(sql);

  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { rows } = await client.query(
        `SELECT 1 FROM schema_migrations WHERE filename = $1`,
        [filename],
      );
      if (rows.length) {
        await client.query("ROLLBACK");
        return { filename, success: true, statementsApplied: 0, error: "Już zastosowana" };
      }
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [filename],
      );
      await client.query("COMMIT");
      return { filename, success: true, statementsApplied: statements.length };
    } catch (err) {
      await client.query("ROLLBACK");
      const message = err instanceof Error ? err.message : String(err);
      return { filename, success: false, error: message, statementsApplied: 0 };
    }
  });
}

/** Aplikuje wszystkie oczekujące migracje sekwencyjnie. Zatrzymuje się przy pierwszym błędzie. */
export async function applyAllPendingMigrations(): Promise<MigrationApplyResult[]> {
  const status = await getMigrationStatus();
  const results: MigrationApplyResult[] = [];
  for (const m of status.pending) {
    const result = await applyMigration(m.filename);
    results.push(result);
    if (!result.success) break;
  }
  return results;
}
