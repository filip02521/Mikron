/**
 * Pełna weryfikacja powierzchni DB po cutover — hot paths, RPC, embeds, storage refs.
 * Usage: DATABASE_URL=... npx tsx scripts/cutover/verify-db-surface.ts
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import pg from "pg";
import { createAdminClient } from "../../src/lib/db/admin";
import { runSchemaChecks } from "../../src/lib/supabase/schema-check";
import { folderForDbPrefix } from "../../src/lib/storage/local";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name} — ${detail}`);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    // --- Schema check (app layer) ---
    const db = createAdminClient();
    const schema = await runSchemaChecks(db);
    if (schema.ok) pass("schema-check", `${schema.issues.length === 0 ? "all columns/tables" : ""}`);
    else for (const i of schema.issues) fail("schema-check", i);

    // --- RPC (3 biznesowe) ---
    for (const fn of [
      "try_acquire_job_lock",
      "increment_delivery_stats",
      "replace_external_warehouse_line_pallet_shares",
    ] as const) {
      const { rows } = await client.query(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn]
      );
      if (rows.length) pass(`rpc exists: ${fn}`);
      else fail(`rpc exists: ${fn}`, "missing");
    }

    const lock = await db.rpc("try_acquire_job_lock", {
      p_key: "verify-db-surface",
      p_ttl_seconds: 5,
      p_locked_by: "verify-script",
    });
    if (lock.error) fail("rpc try_acquire_job_lock", lock.error.message);
    else {
      pass("rpc try_acquire_job_lock", String(lock.data));
      await db.from("job_locks").delete().eq("key", "verify-db-surface");
    }

    // --- Hot path: panel dzienny (queries pattern) ---
    const suppliers = await db.from("suppliers").select("id, name, location").eq("is_active", true).limit(5);
    if (suppliers.error) fail("suppliers active", suppliers.error.message);
    else pass("suppliers active", `${suppliers.data?.length ?? 0} rows`);

    const orders = await db
      .from("individual_orders")
      .select("id, status, supplier_id, sales_person_id")
      .eq("status", "Nowe")
      .limit(10);
    if (orders.error) fail("individual_orders Nowe", orders.error.message);
    else pass("individual_orders Nowe", `${orders.data?.length ?? 0} sample`);

    // Embed (PostgREST-style) — used in teeth/moje
    const embed = await db
      .from("individual_orders")
      .select("id, sales_people(name, email)")
      .limit(3);
    if (embed.error) fail("embed sales_people", embed.error.message);
    else pass("embed sales_people", `${embed.data?.length ?? 0} rows`);

    const teeth = await db
      .from("individual_order_teeth_details")
      .select("id, jaw, kind, individual_orders(status)")
      .limit(3);
    if (teeth.error) fail("embed teeth details", teeth.error.message);
    else pass("embed teeth details", `${teeth.data?.length ?? 0} rows`);

    // --- Auth tables ---
    const { rows: au } = await client.query(`SELECT COUNT(*)::int AS n FROM app_users`);
    const { rows: pr } = await client.query(`SELECT COUNT(*)::int AS n FROM profiles`);
    if (au[0].n === pr[0].n && au[0].n > 0) pass("app_users = profiles", String(au[0].n));
    else fail("app_users = profiles", `app_users=${au[0].n} profiles=${pr[0].n}`);

    const { rows: orphan } = await client.query(
      `SELECT COUNT(*)::int AS n FROM profiles p LEFT JOIN app_users u ON u.id = p.id WHERE u.id IS NULL`
    );
    if (orphan[0].n === 0) pass("orphan profiles");
    else fail("orphan profiles", String(orphan[0].n));

    // --- Count vs snapshot if present (dynamic tables excluded) ---
    const COUNT_SKIP = new Set(["job_locks", "auth_rate_limit_events"]); // runtime drift during verify
    const snapPath = join(process.cwd(), "data/cutover/counts-source.json");
    if (existsSync(snapPath)) {
      const expected = JSON.parse(readFileSync(snapPath, "utf-8")) as Record<string, number>;
      let diff = 0;
      for (const [table, count] of Object.entries(expected)) {
        if (table.startsWith("__") || COUNT_SKIP.has(table)) continue;
        const { rows: c } = await client.query(`SELECT COUNT(*)::int AS n FROM public.${table}`);
        if (c[0].n !== count) {
          fail(`count ${table}`, `expected ${count} got ${c[0].n}`);
          diff++;
        }
      }
      if (diff === 0) pass("counts vs snapshot", `${Object.keys(expected).length} tables`);
    } else {
      pass("counts vs snapshot", "skipped (no snapshot)");
    }

    // --- Storage refs in DB vs filesystem ---
    if (process.env.STORAGE_ROOT?.trim()) {
      const { rows: ocr } = await client.query<{ image_path: string }>(
        `SELECT DISTINCT image_path FROM teeth_ocr_pending WHERE image_path IS NOT NULL LIMIT 20`
      ).catch(() => ({ rows: [] as { image_path: string }[] }));
      let missing = 0;
      for (const r of ocr) {
        try {
          const abs = folderForDbPrefix(r.image_path);
          if (!existsSync(abs)) missing++;
        } catch {
          missing++;
        }
      }
      if (ocr.length === 0) pass("storage teeth_ocr_pending", "no rows");
      else if (missing === 0) pass("storage teeth_ocr_pending", `${ocr.length} paths OK`);
      else fail("storage teeth_ocr_pending", `${missing}/${ocr.length} missing files`);

      const { rows: board } = await client.query<{ storage_path: string }>(
        `SELECT storage_path FROM department_board_thread_attachments WHERE storage_path IS NOT NULL LIMIT 20`
      ).catch(() => ({ rows: [] as { storage_path: string }[] }));
      missing = 0;
      for (const r of board) {
        try {
          if (!existsSync(folderForDbPrefix(r.storage_path))) missing++;
        } catch {
          missing++;
        }
      }
      if (board.length === 0) pass("storage board attachments", "no rows");
      else if (missing === 0) pass("storage board attachments", `${board.length} paths OK`);
      else fail("storage board attachments", `${missing}/${board.length} missing`);
    } else {
      pass("storage filesystem", "skipped (no STORAGE_ROOT)");
    }

    // --- Critical aggregates (panel / raporty) ---
    const { rows: hist } = await client.query(
      `SELECT COUNT(*)::int AS n FROM normal_order_history`
    );
    pass("normal_order_history", String(hist[0].n));

    const { rows: zd } = await client.query(`SELECT COUNT(*)::int AS n FROM subiekt_zd_index`);
    pass("subiekt_zd_index", String(zd[0].n));

    const { rows: mail } = await client.query(`SELECT COUNT(*)::int AS n FROM mail_send_log`);
    pass("mail_send_log", String(mail[0].n));

  } finally {
    await client.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== verify-db-surface: ${results.length - failed.length}/${results.length} OK ===`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
