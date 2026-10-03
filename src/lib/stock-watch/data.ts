import type { PoolClient } from "pg";
import { query } from "@/lib/db/pool";
import type {
  StockWatchRule,
  StockWatchStatus,
} from "@/lib/stock-watch/analysis";
import type { ZdDeliveryRisk } from "@/lib/orders/zd-order-horizon";

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
// Wynik per (dostawca, towar) — lista „Do ZD” z silnika + sygnały
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
  salesPeriodQty: number;
  salesPeriodDays: number;
  velocityDaily: number;
  velocityTrend: number | null;
  daysOfCover: number | null;
  runOutDate: string | null;
  bufferDays: number;
  targetQty: number;
  minStockQty: number | null;
  inOrder: boolean;
  orderZdUnits: number;
  orderUnitLabel: string | null;
  orderPieces: number;
  orderIndividualPieces: number;
  orderValue: number | null;
  unitPriceNet: number | null;
  dailyValue: number | null;
  /** Sygnał z czasu dostawy — bez wpływu na ilość. */
  deliveryRisk: ZdDeliveryRisk | null;
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
  "sales_period_qty",
  "sales_period_days",
  "velocity_daily",
  "velocity_trend",
  "days_of_cover",
  "run_out_date",
  "buffer_days",
  "target_qty",
  "min_stock_qty",
  "in_order",
  "order_zd_units",
  "order_unit_label",
  "order_pieces",
  "order_individual_pieces",
  "order_value",
  "unit_price_net",
  "daily_value",
  "delivery_risk",
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
    item.salesPeriodQty,
    item.salesPeriodDays,
    item.velocityDaily,
    item.velocityTrend,
    item.daysOfCover,
    item.runOutDate,
    item.bufferDays,
    item.targetQty,
    item.minStockQty,
    item.inOrder,
    item.orderZdUnits,
    item.orderUnitLabel,
    item.orderPieces,
    item.orderIndividualPieces,
    item.orderValue,
    item.unitPriceNet,
    item.dailyValue,
    item.deliveryRisk,
    item.status,
  ];
}

/**
 * Zastępuje wynik dostawcy: upsert bieżącej listy, usunięcie towarów,
 * których w tym przebiegu już nie ma (lista = to, co policzył silnik).
 */
export async function replaceSupplierStockWatchItems(
  supplierId: string,
  runId: string,
  items: readonly StockWatchItemWrite[]
): Promise<number> {
  let written = 0;
  const chunkSize = 200;
  const updates = ITEM_COLUMNS.filter((c) => c !== "subiekt_tw_id" && c !== "supplier_id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat("computed_at = now()")
    .join(", ");
  for (let start = 0; start < items.length; start += chunkSize) {
    const chunk = items.slice(start, start + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((item) => {
      const placeholders = itemValues(item).map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")}, now())`;
    });
    const res = await query(
      `INSERT INTO stock_watch_items (${ITEM_COLUMNS.join(", ")}, computed_at)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (supplier_id, subiekt_tw_id) DO UPDATE SET ${updates}`,
      params
    );
    written += res.rowCount ?? 0;
  }
  await query(
    `DELETE FROM stock_watch_items
      WHERE supplier_id = $1 AND run_id IS DISTINCT FROM $2`,
    [supplierId, runId]
  );
  return written;
}

/** Wyniki dostawców, których zakres zniknął — po kilku dniach poza panelem. */
export async function pruneStaleStockWatchItems(olderThanDays: number): Promise<number> {
  const res = await query(
    `DELETE FROM stock_watch_items
      WHERE computed_at < now() - ($1::int * interval '1 day')`,
    [olderThanDays]
  );
  await query(
    `DELETE FROM stock_watch_supplier_orders
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
    salesPeriodQty: num(row.sales_period_qty),
    salesPeriodDays: num(row.sales_period_days),
    velocityDaily: num(row.velocity_daily),
    velocityTrend: numOrNull(row.velocity_trend),
    daysOfCover: numOrNull(row.days_of_cover),
    runOutDate: dateKey(row.run_out_date),
    bufferDays: num(row.buffer_days),
    targetQty: num(row.target_qty),
    minStockQty: numOrNull(row.min_stock_qty),
    inOrder: row.in_order === true,
    orderZdUnits: num(row.order_zd_units),
    orderUnitLabel: (row.order_unit_label as string | null) ?? null,
    orderPieces: num(row.order_pieces),
    orderIndividualPieces: num(row.order_individual_pieces),
    orderValue: numOrNull(row.order_value),
    unitPriceNet: numOrNull(row.unit_price_net),
    dailyValue: numOrNull(row.daily_value),
    deliveryRisk:
      row.delivery_risk === "before_delivery" || row.delivery_risk === "before_next_delivery"
        ? row.delivery_risk
        : null,
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

const ITEM_SELECT = `SELECT i.*,
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
       LEFT JOIN product_purchase_prices p ON p.subiekt_tw_id = i.subiekt_tw_id`;

/**
 * Wszystkie wyniki z regułą liczoną na żywo — oznaczenie „Wyklucz” / „Na prośbę”
 * działa w panelu od razu, bez czekania na nocny przebieg.
 */
export async function listStockWatchItems(): Promise<StockWatchItem[]> {
  const res = await query<ItemRow>(ITEM_SELECT);
  return res.rows.map(mapItem);
}

/** Wyszukiwanie po symbolu / nazwie (zakładka reguł) — limit 50. */
export async function searchStockWatchItems(term: string): Promise<StockWatchItem[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const res = await query<ItemRow>(
    `${ITEM_SELECT}
      WHERE i.tw_symbol ILIKE $1 OR i.tw_nazwa ILIKE $1
      ORDER BY (i.tw_symbol ILIKE $2) DESC, i.velocity_daily DESC, i.tw_symbol
      LIMIT 50`,
    [`%${escaped}%`, `${escaped}%`]
  );
  return res.rows.map(mapItem);
}

// ---------------------------------------------------------------------------
// Podsumowanie „Do ZD” per dostawca
// ---------------------------------------------------------------------------

export type StockWatchSupplierOrder = {
  supplierId: string;
  supplierName: string | null;
  runId: string | null;
  scopeMode: "grupa" | "cecha";
  scopeId: number;
  dniZapasu: number;
  dataOd: string;
  dataDo: string;
  lineCount: number;
  zdUnitsSum: number;
  orderValue: number;
  unpricedCount: number;
  explodeBomIncomplete: boolean;
  historyFetchFailed: boolean;
  pendingIndividualsError: string | null;
  truncated: boolean;
  /** Czas dostawy (dni kalendarzowe) i kolejne planowe zamówienie. */
  leadDays: number | null;
  leadSource: string | null;
  leadSamples: number | null;
  nextOrderDate: string | null;
  nextOrderDays: number | null;
  computedAt: string;
};

export async function upsertStockWatchSupplierOrder(
  row: Omit<StockWatchSupplierOrder, "supplierName" | "computedAt">
): Promise<void> {
  await query(
    `INSERT INTO stock_watch_supplier_orders
       (supplier_id, run_id, scope_mode, scope_id, dni_zapasu, data_od, data_do,
        line_count, zd_units_sum, order_value, unpriced_count, explode_bom_incomplete,
        history_fetch_failed, pending_individuals_error, truncated,
        lead_days, lead_source, lead_samples, next_order_date, next_order_days, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19::date, $20, now())
     ON CONFLICT (supplier_id) DO UPDATE SET
       run_id = EXCLUDED.run_id,
       scope_mode = EXCLUDED.scope_mode,
       scope_id = EXCLUDED.scope_id,
       dni_zapasu = EXCLUDED.dni_zapasu,
       data_od = EXCLUDED.data_od,
       data_do = EXCLUDED.data_do,
       line_count = EXCLUDED.line_count,
       zd_units_sum = EXCLUDED.zd_units_sum,
       order_value = EXCLUDED.order_value,
       unpriced_count = EXCLUDED.unpriced_count,
       explode_bom_incomplete = EXCLUDED.explode_bom_incomplete,
       history_fetch_failed = EXCLUDED.history_fetch_failed,
       pending_individuals_error = EXCLUDED.pending_individuals_error,
       truncated = EXCLUDED.truncated,
       lead_days = EXCLUDED.lead_days,
       lead_source = EXCLUDED.lead_source,
       lead_samples = EXCLUDED.lead_samples,
       next_order_date = EXCLUDED.next_order_date,
       next_order_days = EXCLUDED.next_order_days,
       computed_at = now()`,
    [
      row.supplierId,
      row.runId,
      row.scopeMode,
      row.scopeId,
      row.dniZapasu,
      row.dataOd,
      row.dataDo,
      row.lineCount,
      row.zdUnitsSum,
      row.orderValue,
      row.unpricedCount,
      row.explodeBomIncomplete,
      row.historyFetchFailed,
      row.pendingIndividualsError?.slice(0, 500) ?? null,
      row.truncated,
      row.leadDays,
      row.leadSource,
      row.leadSamples,
      row.nextOrderDate,
      row.nextOrderDays,
    ]
  );
}

export async function listStockWatchSupplierOrders(): Promise<StockWatchSupplierOrder[]> {
  const res = await query<ItemRow>(
    `SELECT o.*, s.name AS supplier_name
       FROM stock_watch_supplier_orders o
       LEFT JOIN suppliers s ON s.id = o.supplier_id`
  );
  return res.rows.map((row) => ({
    supplierId: String(row.supplier_id),
    supplierName: (row.supplier_name as string | null) ?? null,
    runId: (row.run_id as string | null) ?? null,
    scopeMode: row.scope_mode === "cecha" ? "cecha" : "grupa",
    scopeId: num(row.scope_id),
    dniZapasu: num(row.dni_zapasu),
    dataOd: dateKey(row.data_od) ?? "",
    dataDo: dateKey(row.data_do) ?? "",
    lineCount: num(row.line_count),
    zdUnitsSum: num(row.zd_units_sum),
    orderValue: num(row.order_value),
    unpricedCount: num(row.unpriced_count),
    explodeBomIncomplete: row.explode_bom_incomplete === true,
    historyFetchFailed: row.history_fetch_failed === true,
    pendingIndividualsError: (row.pending_individuals_error as string | null) ?? null,
    truncated: row.truncated === true,
    leadDays: numOrNull(row.lead_days),
    leadSource: (row.lead_source as string | null) ?? null,
    leadSamples: numOrNull(row.lead_samples),
    nextOrderDate: dateKey(row.next_order_date),
    nextOrderDays: numOrNull(row.next_order_days),
    computedAt: iso(row.computed_at) ?? "",
  }));
}

/** Skrót analizy per dostawca — karty panelu dziennego (czy jest co zamawiać). */
export type StockWatchSupplierSignal = {
  /** Pozycje „Do ZD” — to samo co Kreator (bez opcji). */
  lineCount: number;
  orderValue: number;
  unpricedCount: number;
  /** Brak towaru + krytyczne (zgodnie z regułami towarów). */
  criticalCount: number;
  /** Dzień danych analizy (koniec okna sprzedaży). */
  dataDo: string;
};

export async function listStockWatchSupplierSignals(): Promise<
  Record<string, StockWatchSupplierSignal>
> {
  const res = await query<{
    supplier_id: string;
    line_count: unknown;
    order_value: unknown;
    unpriced_count: unknown;
    data_do: unknown;
    critical: unknown;
  }>(
    `SELECT o.supplier_id, o.line_count, o.order_value, o.unpriced_count, o.data_do,
            (SELECT count(*) FROM stock_watch_items i
              WHERE i.supplier_id = o.supplier_id
                AND i.status IN ('out_of_stock', 'critical')) AS critical
       FROM stock_watch_supplier_orders o`
  );
  const out: Record<string, StockWatchSupplierSignal> = {};
  for (const row of res.rows) {
    out[String(row.supplier_id)] = {
      lineCount: num(row.line_count),
      orderValue: num(row.order_value),
      unpricedCount: num(row.unpriced_count),
      criticalCount: num(row.critical),
      dataDo: dateKey(row.data_do) ?? "",
    };
  }
  return out;
}

/** Aktywni dostawcy z / bez zakresu w kreatorze ZD — tylko zmapowani wchodzą do analizy. */
export async function getSupplierScopeCoverage(): Promise<{ active: number; mapped: number }> {
  const res = await query<{ active: string; mapped: string }>(
    `SELECT count(DISTINCT s.id)::text AS active,
            count(DISTINCT z.supplier_id)::text AS mapped
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

export type StockWatchOffPlanSupplier = {
  supplierId: string;
  supplierName: string;
  /** Towary (Standard), które skończą się przed dostawą zamówienia złożonego dziś. */
  count: number;
  nextOrderDate: string | null;
};

/**
 * „Zamów dziś poza planem” (panel dzienny): dostawcy bez planowego zamówienia
 * na dziś, u których coś skończy się przed dostawą zamówienia złożonego dziś.
 * Reguły „Wyklucz” / „Na prośbę” na żywo; wyniki starsze niż 2 dni pomijane.
 */
export async function listStockWatchOffPlanSuppliers(
  todayKey: string
): Promise<StockWatchOffPlanSupplier[]> {
  const res = await query<{
    supplier_id: string;
    name: string;
    n: string;
    next_date: unknown;
  }>(
    `SELECT i.supplier_id, s.name, count(*)::text AS n, ss.computed_next_date AS next_date
       FROM stock_watch_items i
       JOIN suppliers s ON s.id = i.supplier_id
       LEFT JOIN supplier_schedules ss ON ss.supplier_id = i.supplier_id
       LEFT JOIN zd_estimate_exclusions e ON e.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN zd_estimate_on_request r ON r.subiekt_tw_id = i.subiekt_tw_id
      WHERE i.delivery_risk = 'before_delivery'
        AND e.subiekt_tw_id IS NULL
        AND r.subiekt_tw_id IS NULL
        AND i.computed_at > now() - interval '2 days'
        AND COALESCE(s.is_active, true)
        AND (ss.computed_next_date IS NULL OR ss.computed_next_date > $1::date)
      GROUP BY i.supplier_id, s.name, ss.computed_next_date
      ORDER BY count(*) DESC, s.name`,
    [todayKey]
  );
  return res.rows.map((r) => ({
    supplierId: r.supplier_id,
    supplierName: r.name,
    count: num(r.n),
    nextOrderDate: dateKey(r.next_date),
  }));
}
