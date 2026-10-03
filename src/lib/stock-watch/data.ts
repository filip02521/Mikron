import type { PoolClient } from "pg";
import { query } from "@/lib/db/pool";
import type {
  StockWatchRule,
  StockWatchStatus,
} from "@/lib/stock-watch/analysis";

/** pg zwraca `numeric` jako string — normalizacja w jednym miejscu. */
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateKey(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// ---------------------------------------------------------------------------
// Przebiegi workera
// ---------------------------------------------------------------------------

export type StockWatchRunStatus = "running" | "ok" | "partial" | "failed";

export type StockWatchScopeFailure = {
  supplierId: string;
  supplierName: string;
  message: string;
};

export type StockWatchRun = {
  id: string;
  runDate: string;
  triggerKind: "cron" | "manual";
  status: StockWatchRunStatus;
  startedAt: string;
  heartbeatAt: string;
  finishedAt: string | null;
  salesEndDate: string;
  scopesTotal: number;
  scopesDone: string[];
  scopesFailed: StockWatchScopeFailure[];
  itemsWritten: number;
  pricesUpdated: number;
  error: string | null;
  detail: Record<string, unknown>;
};

type RunRow = {
  id: string;
  run_date: unknown;
  trigger_kind: "cron" | "manual";
  status: StockWatchRunStatus;
  started_at: unknown;
  heartbeat_at: unknown;
  finished_at: unknown;
  sales_end_date: unknown;
  scopes_total: number;
  scopes_done: string[] | null;
  scopes_failed: StockWatchScopeFailure[] | null;
  items_written: number;
  prices_updated: number;
  error: string | null;
  detail: Record<string, unknown> | null;
};

function mapRun(row: RunRow): StockWatchRun {
  return {
    id: row.id,
    runDate: dateKey(row.run_date) ?? "",
    triggerKind: row.trigger_kind,
    status: row.status,
    startedAt: iso(row.started_at) ?? "",
    heartbeatAt: iso(row.heartbeat_at) ?? "",
    finishedAt: iso(row.finished_at),
    salesEndDate: dateKey(row.sales_end_date) ?? "",
    scopesTotal: num(row.scopes_total),
    scopesDone: row.scopes_done ?? [],
    scopesFailed: Array.isArray(row.scopes_failed) ? row.scopes_failed : [],
    itemsWritten: num(row.items_written),
    pricesUpdated: num(row.prices_updated),
    error: row.error,
    detail: row.detail ?? {},
  };
}

export async function getLatestStockWatchRun(
  runDate?: string
): Promise<StockWatchRun | null> {
  const res = runDate
    ? await query<RunRow>(
        `SELECT * FROM stock_watch_runs WHERE run_date = $1
          ORDER BY started_at DESC LIMIT 1`,
        [runDate]
      )
    : await query<RunRow>(
        `SELECT * FROM stock_watch_runs ORDER BY started_at DESC LIMIT 1`
      );
  return res.rows[0] ? mapRun(res.rows[0]) : null;
}

export async function createStockWatchRun(input: {
  runDate: string;
  triggerKind: "cron" | "manual";
  salesEndDate: string;
  scopesTotal: number;
}): Promise<StockWatchRun> {
  const res = await query<RunRow>(
    `INSERT INTO stock_watch_runs (run_date, trigger_kind, sales_end_date, scopes_total)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.runDate, input.triggerKind, input.salesEndDate, input.scopesTotal]
  );
  return mapRun(res.rows[0]!);
}

export async function updateStockWatchRun(
  id: string,
  patch: Partial<{
    status: StockWatchRunStatus;
    scopesTotal: number;
    scopesDone: string[];
    scopesFailed: StockWatchScopeFailure[];
    itemsWritten: number;
    pricesUpdated: number;
    finished: boolean;
    error: string | null;
    detail: Record<string, unknown>;
  }>
): Promise<void> {
  const sets: string[] = ["heartbeat_at = now()"];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    sets.push(`${sql} = $${params.length}`);
  };
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.scopesTotal !== undefined) add("scopes_total", patch.scopesTotal);
  if (patch.scopesDone !== undefined) add("scopes_done", patch.scopesDone);
  if (patch.scopesFailed !== undefined) {
    params.push(JSON.stringify(patch.scopesFailed));
    sets.push(`scopes_failed = $${params.length}::jsonb`);
  }
  if (patch.itemsWritten !== undefined) add("items_written", patch.itemsWritten);
  if (patch.pricesUpdated !== undefined) add("prices_updated", patch.pricesUpdated);
  if (patch.error !== undefined) {
    add("error", patch.error == null ? null : patch.error.slice(0, 2000));
  }
  if (patch.detail !== undefined) {
    params.push(JSON.stringify(patch.detail));
    sets.push(`detail = $${params.length}::jsonb`);
  }
  if (patch.finished) sets.push("finished_at = now()");
  params.push(id);
  await query(
    `UPDATE stock_watch_runs SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params
  );
}

/** Jeden worker naraz (cron + ręczne „Przelicz teraz”). Lock na czas sesji klienta. */
export async function tryStockWatchAdvisoryLock(client: PoolClient): Promise<boolean> {
  const res = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext('stock_watch_worker')) AS locked`
  );
  return res.rows[0]?.locked === true;
}

export async function releaseStockWatchAdvisoryLock(client: PoolClient): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock(hashtext('stock_watch_worker'))`);
}

// ---------------------------------------------------------------------------
// Wynik analizy per towar
// ---------------------------------------------------------------------------

export type StockWatchItemWrite = {
  subiektTwId: number;
  supplierId: string;
  runId: string;
  twSymbol: string | null;
  twNazwa: string;
  grtNazwa: string | null;
  scopeMode: "grupa" | "cecha";
  scopeId: number;
  stockQty: number;
  reservedQty: number;
  availableQty: number;
  openZdQty: number;
  openZkUnreservedQty: number;
  sales30d: number;
  sales60d: number;
  velocityDaily: number;
  velocityTrend: number | null;
  daysOfCover: number | null;
  runOutDate: string | null;
  bufferDays: number;
  safetyStockQty: number;
  minStockQty: number | null;
  suggestedQty: number;
  unitPriceNet: number | null;
  dailyValue: number | null;
  status: StockWatchStatus;
};

const ITEM_COLUMNS = [
  "subiekt_tw_id",
  "supplier_id",
  "run_id",
  "tw_symbol",
  "tw_nazwa",
  "grt_nazwa",
  "scope_mode",
  "scope_id",
  "stock_qty",
  "reserved_qty",
  "available_qty",
  "open_zd_qty",
  "open_zk_unreserved_qty",
  "sales_30d",
  "sales_60d",
  "velocity_daily",
  "velocity_trend",
  "days_of_cover",
  "run_out_date",
  "buffer_days",
  "safety_stock_qty",
  "min_stock_qty",
  "suggested_qty",
  "unit_price_net",
  "daily_value",
  "status",
] as const;

function itemValues(item: StockWatchItemWrite): unknown[] {
  return [
    item.subiektTwId,
    item.supplierId,
    item.runId,
    item.twSymbol,
    item.twNazwa,
    item.grtNazwa,
    item.scopeMode,
    item.scopeId,
    item.stockQty,
    item.reservedQty,
    item.availableQty,
    item.openZdQty,
    item.openZkUnreservedQty,
    item.sales30d,
    item.sales60d,
    item.velocityDaily,
    item.velocityTrend,
    item.daysOfCover,
    item.runOutDate,
    item.bufferDays,
    item.safetyStockQty,
    item.minStockQty,
    item.suggestedQty,
    item.unitPriceNet,
    item.dailyValue,
    item.status,
  ];
}

/**
 * Upsert wyników zakresu. Towar w kilku zakresach (grupa i cecha) — pierwszy
 * zakres w danym przebiegu wygrywa (`run_id` już bieżący = bez nadpisania).
 */
export async function upsertStockWatchItems(
  items: readonly StockWatchItemWrite[]
): Promise<number> {
  let written = 0;
  const chunkSize = 200;
  for (let start = 0; start < items.length; start += chunkSize) {
    const chunk = items.slice(start, start + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((item) => {
      const vals = itemValues(item);
      const placeholders = vals.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")}, now())`;
    });
    const updates = ITEM_COLUMNS.filter((c) => c !== "subiekt_tw_id")
      .map((c) => `${c} = EXCLUDED.${c}`)
      .concat("computed_at = now()")
      .join(", ");
    const res = await query(
      `INSERT INTO stock_watch_items (${ITEM_COLUMNS.join(", ")}, computed_at)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (subiekt_tw_id) DO UPDATE SET ${updates}
       WHERE stock_watch_items.run_id IS DISTINCT FROM EXCLUDED.run_id`,
      params
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

/** Wyniki dostawców, których zakres zniknął — po kilku dniach poza panelem. */
export async function pruneStaleStockWatchItems(olderThanDays: number): Promise<number> {
  const res = await query(
    `DELETE FROM stock_watch_items
      WHERE computed_at < now() - ($1::int * interval '1 day')`,
    [olderThanDays]
  );
  return res.rowCount ?? 0;
}

export type StockWatchItem = StockWatchItemWrite & {
  computedAt: string;
  supplierName: string | null;
  rule: StockWatchRule;
  ruleNote: string | null;
  priceDokNr: string | null;
  priceDate: string | null;
};

type ItemRow = Record<string, unknown>;

function mapItem(row: ItemRow): StockWatchItem {
  const rule: StockWatchRule = row.excluded
    ? "excluded"
    : row.on_request
      ? "on_request"
      : "standard";
  return {
    subiektTwId: num(row.subiekt_tw_id),
    supplierId: String(row.supplier_id ?? ""),
    runId: String(row.run_id ?? ""),
    twSymbol: (row.tw_symbol as string | null) ?? null,
    twNazwa: String(row.tw_nazwa ?? ""),
    grtNazwa: (row.grt_nazwa as string | null) ?? null,
    scopeMode: row.scope_mode === "cecha" ? "cecha" : "grupa",
    scopeId: num(row.scope_id),
    stockQty: num(row.stock_qty),
    reservedQty: num(row.reserved_qty),
    availableQty: num(row.available_qty),
    openZdQty: num(row.open_zd_qty),
    openZkUnreservedQty: num(row.open_zk_unreserved_qty),
    sales30d: num(row.sales_30d),
    sales60d: num(row.sales_60d),
    velocityDaily: num(row.velocity_daily),
    velocityTrend: numOrNull(row.velocity_trend),
    daysOfCover: numOrNull(row.days_of_cover),
    runOutDate: dateKey(row.run_out_date),
    bufferDays: num(row.buffer_days),
    safetyStockQty: num(row.safety_stock_qty),
    minStockQty: numOrNull(row.min_stock_qty),
    suggestedQty: num(row.suggested_qty),
    unitPriceNet: numOrNull(row.unit_price_net),
    dailyValue: numOrNull(row.daily_value),
    status: row.status as StockWatchStatus,
    computedAt: iso(row.computed_at) ?? "",
    supplierName: (row.supplier_name as string | null) ?? null,
    rule,
    ruleNote:
      ((row.excluded_note as string | null) || (row.on_request_note as string | null)) ??
      null,
    priceDokNr: (row.price_dok_nr as string | null) ?? null,
    priceDate: dateKey(row.price_dok_date),
  };
}

/**
 * Wszystkie wyniki z regułą liczoną na żywo — oznaczenie „Wyklucz” / „Na prośbę”
 * działa w panelu od razu, bez czekania na nocny przebieg.
 */
export async function listStockWatchItems(): Promise<StockWatchItem[]> {
  const res = await query<ItemRow>(
    `SELECT i.*,
            s.name AS supplier_name,
            (e.subiekt_tw_id IS NOT NULL) AS excluded,
            e.note AS excluded_note,
            (r.subiekt_tw_id IS NOT NULL) AS on_request,
            r.note AS on_request_note,
            p.dok_nr AS price_dok_nr,
            p.dok_date AS price_dok_date
       FROM stock_watch_items i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       LEFT JOIN zd_estimate_exclusions e ON e.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN zd_estimate_on_request r ON r.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN product_purchase_prices p ON p.subiekt_tw_id = i.subiekt_tw_id`
  );
  return res.rows.map(mapItem);
}

/** Wyszukiwanie po symbolu / nazwie (zakładka reguł) — limit 50. */
export async function searchStockWatchItems(term: string): Promise<StockWatchItem[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const res = await query<ItemRow>(
    `SELECT i.*,
            s.name AS supplier_name,
            (e.subiekt_tw_id IS NOT NULL) AS excluded,
            e.note AS excluded_note,
            (r.subiekt_tw_id IS NOT NULL) AS on_request,
            r.note AS on_request_note,
            p.dok_nr AS price_dok_nr,
            p.dok_date AS price_dok_date
       FROM stock_watch_items i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       LEFT JOIN zd_estimate_exclusions e ON e.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN zd_estimate_on_request r ON r.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN product_purchase_prices p ON p.subiekt_tw_id = i.subiekt_tw_id
      WHERE i.tw_symbol ILIKE $1 OR i.tw_nazwa ILIKE $1
      ORDER BY (i.tw_symbol ILIKE $2) DESC, i.velocity_daily DESC, i.tw_symbol
      LIMIT 50`,
    [like, q.replace(/[\\%_]/g, (c) => `\\${c}`) + "%"]
  );
  return res.rows.map(mapItem);
}

/** Aktywni dostawcy z / bez zakresu w kreatorze ZD — tylko zmapowani wchodzą do analizy. */
export async function getSupplierScopeCoverage(): Promise<{ active: number; mapped: number }> {
  const res = await query<{ active: string; mapped: string }>(
    `SELECT count(*)::text AS active,
            count(z.supplier_id)::text AS mapped
       FROM suppliers s
       LEFT JOIN zd_estimate_supplier_scopes z ON z.supplier_id = s.id
      WHERE COALESCE(s.is_active, true)`
  );
  return { active: num(res.rows[0]?.active), mapped: num(res.rows[0]?.mapped) };
}

// ---------------------------------------------------------------------------
// Ceny zakupu (linie ZD)
// ---------------------------------------------------------------------------

export type ProductPurchasePrice = {
  subiektTwId: number;
  priceNet: number;
  dokId: number;
  dokNr: string | null;
  dokDate: string | null;
};

export async function loadProductPurchasePrices(): Promise<Map<number, ProductPurchasePrice>> {
  const res = await query<ItemRow>(
    `SELECT subiekt_tw_id, price_net, dok_id, dok_nr, dok_date FROM product_purchase_prices`
  );
  const map = new Map<number, ProductPurchasePrice>();
  for (const row of res.rows) {
    map.set(num(row.subiekt_tw_id), {
      subiektTwId: num(row.subiekt_tw_id),
      priceNet: num(row.price_net),
      dokId: num(row.dok_id),
      dokNr: (row.dok_nr as string | null) ?? null,
      dokDate: dateKey(row.dok_date),
    });
  }
  return map;
}

/**
 * Zapis ceny tylko gdy dokument jest nowszy (albo ten sam dzień i wyższy dok_id)
 * — porządek harvestu nie ma znaczenia.
 */
export async function upsertProductPurchasePrices(
  rows: readonly {
    subiektTwId: number;
    priceNet: number;
    dokId: number;
    dokNr: string | null;
    dokDate: string | null;
    khId: number | null;
  }[]
): Promise<number> {
  if (!rows.length) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r) => {
    params.push(r.subiektTwId, r.priceNet, r.dokId, r.dokNr, r.dokDate, r.khId);
    const b = params.length - 6;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::date, $${b + 6}, now())`;
  });
  const res = await query(
    `INSERT INTO product_purchase_prices
       (subiekt_tw_id, price_net, dok_id, dok_nr, dok_date, kh_id, updated_at)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (subiekt_tw_id) DO UPDATE SET
       price_net = EXCLUDED.price_net,
       dok_id = EXCLUDED.dok_id,
       dok_nr = EXCLUDED.dok_nr,
       dok_date = EXCLUDED.dok_date,
       kh_id = EXCLUDED.kh_id,
       updated_at = now()
     WHERE (COALESCE(EXCLUDED.dok_date, DATE '1900-01-01'), EXCLUDED.dok_id)
         > (COALESCE(product_purchase_prices.dok_date, DATE '1900-01-01'), product_purchase_prices.dok_id)`,
    params
  );
  return res.rowCount ?? 0;
}

export async function listZdIndexPendingPriceHarvest(limit: number): Promise<
  { dokId: number; dokDate: string | null; khId: number | null }[]
> {
  const res = await query<ItemRow>(
    `SELECT dok_id, dok_data_wyst, subiekt_kh_id
       FROM subiekt_zd_index
      WHERE price_harvested_at IS NULL
      ORDER BY dok_data_wyst DESC NULLS LAST, dok_id DESC
      LIMIT $1`,
    [limit]
  );
  return res.rows.map((row) => ({
    dokId: num(row.dok_id),
    dokDate: dateKey(row.dok_data_wyst),
    khId: numOrNull(row.subiekt_kh_id),
  }));
}

export async function markZdIndexPriceHarvested(dokIds: readonly number[]): Promise<void> {
  if (!dokIds.length) return;
  await query(
    `UPDATE subiekt_zd_index SET price_harvested_at = now() WHERE dok_id = ANY($1::int[])`,
    [dokIds]
  );
}

export async function countZdIndexPendingPriceHarvest(): Promise<number> {
  const res = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM subiekt_zd_index WHERE price_harvested_at IS NULL`
  );
  return num(res.rows[0]?.n);
}
