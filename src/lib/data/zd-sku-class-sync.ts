/**
 * Przeliczenie klas ABC/XYZ (`zd_sku_class`) — cron miesięczny + „Przelicz” w /zakupy/automat.
 * Właściciel znaczeń `zd_sku_class` (abc/xyz i nadpisania). Tylko GET do Subiekta.
 *
 * Zakres: wyłącznie towary ze zmapowanych zakresów dostawców (`zd_estimate_supplier_scopes`
 * × `subiekt_product_scope_index`), nigdy cały katalog. Dostawca towaru: przypisanie w OnTime
 * (`zd_product_supplier_assignments`), inaczej jedyny dostawca zakresu; wspólny zakres bez
 * przypisania → `supplier_id` NULL (ABC liczone w tej grupie osobno).
 */
import { query, withClient } from "@/lib/db/pool";
import { mapPool } from "@/lib/async/map-pool";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import { subiektJson } from "@/lib/subiekt/client";
import { resolveSubiektOrdersConfig, type SubiektConfig } from "@/lib/subiekt/config";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import type { ZdAbc, ZdXyz } from "@/lib/orders/zd-automat-contract";
import {
  zdClassifyAbcByProfit,
  zdClassifyXyz,
  zdSaleLinesFromEstimateDocs,
  zdWeeklySales,
  type ZdSaleLine,
} from "@/lib/orders/zd-sku-class";

const LOCK_KEY = "job_zd_sku_class_lock";
/** Pełny przebieg to kilkanaście minut; blokada wygasa sama, gdy proces padnie. */
const LOCK_TTL_SEC = 2 * 60 * 60;
const CONCURRENCY = 6;
const RETRIES = 3;
const ESTIMATE_PAGE_SIZE = 200;
const ESTIMATE_MAX_PAGES = 100;
const ASORTYMENT_PAGE_SIZE = 500;
/** Okno linii sprzedaży: 2 lata — starsza sprzedaż odróżnia towar wracający od nowości (N). */
const SALES_HISTORY_DAYS = 728;
const DB_CHUNK = 500;

export type ZdScopeRef = { mode: "grupa" | "cecha"; scopeId: number };

export type ZdScopeTw = { twId: number; supplierId: string | null };

const addDays = (key: string, days: number) =>
  new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function withSubiektRetry<T>(fn: () => Promise<T>, tries = RETRIES): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i + 1 >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

export function subiektOrdersConfig(): SubiektConfig {
  const r = resolveSubiektOrdersConfig();
  if (!r.ok) throw new Error(r.message);
  return r.config;
}

/** Zmapowane zakresy i ich towary z dostawcą (przypisanie → jedyny dostawca zakresu → NULL). */
export async function loadZdScopeTowary(): Promise<{ scopes: ZdScopeRef[]; towary: ZdScopeTw[] }> {
  const res = await query<{ tw: number; suppliers: string[]; assigned: string | null }>(
    `WITH s AS (
       SELECT supplier_id, mode, COALESCE(grupa_id, cecha_id) AS scope_id FROM zd_estimate_supplier_scopes
     ),
     tw AS (
       SELECT s.supplier_id, i.subiekt_tw_id
         FROM s JOIN subiekt_product_scope_index i ON i.cecha_ids @> ARRAY[s.scope_id]
        WHERE s.mode = 'cecha'
       UNION
       SELECT s.supplier_id, i.subiekt_tw_id
         FROM s JOIN subiekt_product_scope_index i ON i.grupa_id = s.scope_id
        WHERE s.mode = 'grupa'
     )
     SELECT tw.subiekt_tw_id AS tw, array_agg(DISTINCT tw.supplier_id::text) AS suppliers,
            a.supplier_id::text AS assigned
       FROM tw LEFT JOIN zd_product_supplier_assignments a ON a.subiekt_tw_id = tw.subiekt_tw_id
      GROUP BY tw.subiekt_tw_id, a.supplier_id`
  );
  const scopesRes = await query<{ mode: "grupa" | "cecha"; scope_id: number }>(
    `SELECT DISTINCT mode, COALESCE(grupa_id, cecha_id) AS scope_id FROM zd_estimate_supplier_scopes`
  );
  return {
    scopes: scopesRes.rows.map((r) => ({ mode: r.mode, scopeId: Number(r.scope_id) })),
    towary: res.rows.map((r) => ({
      twId: Number(r.tw),
      supplierId: r.assigned ?? (r.suppliers.length === 1 ? r.suppliers[0]! : null),
    })),
  };
}

export type ZdAsortymentRow = { twId: number; qty: number; netto: number; koszt: number; zysk: number };

/** `GET /reports/sprzedaz/asortyment` dla zakresu (FS+KFS+ZW+PA), wszystkie strony. */
export async function fetchZdAsortyment(
  cfg: SubiektConfig,
  scope: ZdScopeRef,
  dataOd: string,
  dataDo: string
): Promise<ZdAsortymentRow[]> {
  const out: ZdAsortymentRow[] = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const qs = subiektQueryString({
      dataOd,
      dataDo,
      zDetalem: true,
      [scope.mode === "cecha" ? "cechaId" : "grupaId"]: scope.scopeId,
      page,
      pageSize: ASORTYMENT_PAGE_SIZE,
    });
    const j = await withSubiektRetry(() =>
      subiektJson<{
        data?: { items?: Array<Record<string, unknown>> };
        pagination?: { totalPages?: number };
      }>(`/reports/sprzedaz/asortyment${qs}`, {}, cfg)
    );
    for (const r of j.data?.items ?? []) {
      const twId = Math.trunc(Number(r.towarId));
      if (!(twId > 0)) continue;
      out.push({
        twId,
        qty: Number(r.ilosc) || 0,
        netto: Number(r.netto) || 0,
        koszt: Number(r.koszt) || 0,
        zysk: Number(r.zysk) || 0,
      });
    }
    total = Math.max(1, Math.trunc(Number(j.pagination?.totalPages)) || 1);
  }
  return out;
}

/** Linie sprzedaży jednego towaru (`sprzedazOkres`) — wszystkie strony. */
async function fetchSaleLines(cfg: SubiektConfig, twId: number, dataOd: string, dataDo: string): Promise<ZdSaleLine[]> {
  const out: ZdSaleLine[] = [];
  for (let page = 1, total = 1; page <= total && page <= ESTIMATE_MAX_PAGES; page++) {
    const qs = subiektQueryString({ dataOd, dataDo, page, pageSize: ESTIMATE_PAGE_SIZE });
    const j = await withSubiektRetry(() =>
      subiektJson<{
        data?: { dokumenty?: Array<Record<string, unknown>> };
        pagination?: { totalPages?: number };
      }>(`${SUBIEKT_PATHS.ordersZdEstimateTowar(twId)}${qs}`, {}, cfg)
    );
    out.push(...zdSaleLinesFromEstimateDocs(j.data?.dokumenty ?? []));
    total = Math.max(1, Math.trunc(Number(j.pagination?.totalPages)) || 1);
  }
  return out;
}

type ClassRow = {
  twId: number;
  supplierId: string | null;
  abc: ZdAbc;
  xyz: ZdXyz;
  profit: number;
  revenue: number;
  cv: number | null;
  activeWeeks: number;
  firstSale: string | null;
};

export type ZdSkuClassSyncResult = {
  ok: boolean;
  asOf: string;
  scopes: number;
  towary: number;
  /** Towary ze sprzedażą w 12 mies. — dla nich pobrano tygodnie. */
  withSales: number;
  /** Nie udało się pobrać tygodni (po ponowieniach) — stara klasa zostaje. */
  failed: number;
  written: number;
  removed: number;
  counts: Record<string, number>;
  durationMs: number;
  error?: string;
};

export async function runZdSkuClassSync(opts: { asOf?: string } = {}): Promise<
  ZdSkuClassSyncResult | { skipped: "already_running" }
> {
  if (!(await tryAcquireLock(LOCK_KEY, LOCK_TTL_SEC, "zd_sku_class"))) return { skipped: "already_running" };
  const t0 = Date.now();
  const asOf = opts.asOf ?? todayDateKeyInWarsaw();
  const base: ZdSkuClassSyncResult = {
    ok: false, asOf, scopes: 0, towary: 0, withSales: 0, failed: 0, written: 0, removed: 0, counts: {}, durationMs: 0,
  };
  try {
    const cfg = subiektOrdersConfig();
    const { scopes, towary } = await loadZdScopeTowary();
    base.scopes = scopes.length;
    base.towary = towary.length;
    const dataDo = addDays(asOf, -1);

    // ABC: zysk 12 mies. per towar (towar z kilku zakresów — ten sam wiersz, bierzemy raz).
    const sales = new Map<number, ZdAsortymentRow>();
    for (const rows of await mapPool(scopes, CONCURRENCY, (s) => fetchZdAsortyment(cfg, s, addDays(asOf, -365), dataDo))) {
      for (const r of rows) sales.set(r.twId, r);
    }

    // XYZ: tygodnie tylko dla towarów ze sprzedażą w 12 mies.
    // shortcut: towar sprzedany wyłącznie WZ niepowiązaną (nie ma go w asortymencie) dostaje Z bez pobrania
    // tygodni — gdy takich będzie dużo, pobierać tygodnie dla całego zakresu.
    const sold = towary.filter((t) => sales.has(t.twId));
    base.withSales = sold.length;
    const historyFrom = addDays(asOf, -SALES_HISTORY_DAYS);
    const weekly = new Map<number, ReturnType<typeof zdWeeklySales>>();
    let failed = 0;
    await mapPool(sold, CONCURRENCY, async (t) => {
      try {
        weekly.set(t.twId, zdWeeklySales(await fetchSaleLines(cfg, t.twId, historyFrom, dataDo), asOf));
      } catch (e) {
        failed++;
        console.error("[zd-sku-class] tygodnie", t.twId, e instanceof Error ? e.message : e);
      }
    });
    base.failed = failed;
    const failedIds = new Set(sold.filter((t) => !weekly.has(t.twId)).map((t) => t.twId));

    const bySupplier = new Map<string, ZdScopeTw[]>();
    for (const t of towary) {
      const k = t.supplierId ?? "";
      const list = bySupplier.get(k);
      if (list) list.push(t);
      else bySupplier.set(k, [t]);
    }
    const rows: ClassRow[] = [];
    for (const group of bySupplier.values()) {
      const abc = zdClassifyAbcByProfit(group.map((t) => ({ twId: t.twId, profit: sales.get(t.twId)?.zysk ?? 0 })));
      for (const t of group) {
        if (failedIds.has(t.twId)) continue;
        const w = weekly.get(t.twId) ?? { weeks: new Array<number>(52).fill(0), firstSale: null };
        const x = zdClassifyXyz({ ...w, asOf });
        rows.push({
          twId: t.twId,
          supplierId: t.supplierId,
          abc: abc.get(t.twId) ?? "C",
          xyz: x.xyz,
          profit: sales.get(t.twId)?.zysk ?? 0,
          revenue: sales.get(t.twId)?.netto ?? 0,
          cv: x.cv,
          activeWeeks: x.activeWeeks,
          firstSale: w.firstSale,
        });
        const key = `${abc.get(t.twId) ?? "C"}${x.xyz}`;
        base.counts[key] = (base.counts[key] ?? 0) + 1;
      }
    }

    const keepIds = towary.map((t) => t.twId);
    const removed = await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        for (let i = 0; i < rows.length; i += DB_CHUNK) {
          const chunk = rows.slice(i, i + DB_CHUNK);
          await client.query(
            `INSERT INTO zd_sku_class (subiekt_tw_id, supplier_id, abc, xyz, profit_12m, revenue_12m,
                                       weekly_cv, active_weeks, first_sale_date, computed_at)
             SELECT * , now() FROM jsonb_to_recordset($1::jsonb) AS x(
               tw int, supplier uuid, abc char(1), xyz char(1), profit numeric, revenue numeric,
               cv numeric, weeks int, first date)
             ON CONFLICT (subiekt_tw_id) DO UPDATE SET
               supplier_id = EXCLUDED.supplier_id, abc = EXCLUDED.abc, xyz = EXCLUDED.xyz,
               profit_12m = EXCLUDED.profit_12m, revenue_12m = EXCLUDED.revenue_12m,
               weekly_cv = EXCLUDED.weekly_cv, active_weeks = EXCLUDED.active_weeks,
               first_sale_date = EXCLUDED.first_sale_date, computed_at = EXCLUDED.computed_at`,
            [
              JSON.stringify(
                chunk.map((r) => ({
                  tw: r.twId,
                  supplier: r.supplierId,
                  abc: r.abc,
                  xyz: r.xyz,
                  profit: Math.round(r.profit * 100) / 100,
                  revenue: Math.round(r.revenue * 100) / 100,
                  cv: r.cv == null ? null : Math.round(r.cv * 1000) / 1000,
                  weeks: r.activeWeeks,
                  first: r.firstSale,
                }))
              ),
            ]
          );
        }
        // Towar, który wypadł z zakresów, znika — chyba że ma ręczne nadpisanie (decyzja człowieka zostaje).
        const del = await client.query(
          `DELETE FROM zd_sku_class
            WHERE NOT (subiekt_tw_id = ANY($1::int[]))
              AND override_abc IS NULL AND override_xyz IS NULL AND override_note IS NULL`,
          [keepIds]
        );
        await client.query("COMMIT");
        return del.rowCount ?? 0;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    });
    return { ...base, ok: failed === 0, written: rows.length, removed, durationMs: Date.now() - t0,
      error: failed ? `${failed} towarów bez tygodni sprzedaży (Subiekt) — zostały stare klasy` : undefined };
  } catch (e) {
    return { ...base, durationMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

// ---------------------------------------------------------------------------
// Odczyt i ręczne nadpisania (/zakupy/automat)
// ---------------------------------------------------------------------------

export type ZdSkuClassOverrideRow = {
  twId: number;
  symbol: string | null;
  name: string;
  supplierName: string | null;
  abc: ZdAbc;
  xyz: ZdXyz;
  overrideAbc: ZdAbc | null;
  overrideXyz: ZdXyz | null;
  note: string | null;
};

export type ZdSkuClassSummary = {
  computedAt: string | null;
  /** Klasa w użyciu (nadpisanie ?? policzona), np. "AX" → liczba towarów. */
  counts: Record<string, number>;
  /** Zysk 12 mies. per klasa ABC w użyciu (nadpisanie ?? policzona). */
  profitByAbc: Record<ZdAbc, number>;
  overrides: ZdSkuClassOverrideRow[];
  running: boolean;
};

export async function loadZdSkuClassSummary(): Promise<ZdSkuClassSummary> {
  const [counts, overrides, lock] = await Promise.all([
    query<{ abc: ZdAbc; xyz: ZdXyz; n: number; profit: string; at: Date | null }>(
      `SELECT COALESCE(override_abc, abc) AS abc, COALESCE(override_xyz, xyz) AS xyz, count(*)::int AS n,
              sum(profit_12m) AS profit, max(computed_at) AS at
         FROM zd_sku_class GROUP BY 1, 2`
    ),
    query<{
      tw: number; symbol: string | null; name: string | null; supplier: string | null;
      abc: ZdAbc; xyz: ZdXyz; oabc: ZdAbc | null; oxyz: ZdXyz | null; note: string | null;
    }>(
      `SELECT c.subiekt_tw_id AS tw, p.symbol, p.name, s.name AS supplier, c.abc, c.xyz,
              c.override_abc AS oabc, c.override_xyz AS oxyz, c.override_note AS note
         FROM zd_sku_class c
         LEFT JOIN subiekt_products p ON p.subiekt_tw_id = c.subiekt_tw_id
         LEFT JOIN suppliers s ON s.id = c.supplier_id
        WHERE c.override_abc IS NOT NULL OR c.override_xyz IS NOT NULL
        ORDER BY s.name NULLS LAST, p.symbol`
    ),
    query<{ running: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM job_locks WHERE key = $1 AND locked_until > now()) AS running`,
      [LOCK_KEY]
    ),
  ]);
  const out: ZdSkuClassSummary = {
    computedAt: null,
    counts: {},
    profitByAbc: { A: 0, B: 0, C: 0 },
    overrides: overrides.rows.map((r) => ({
      twId: Number(r.tw),
      symbol: r.symbol,
      name: r.name ?? "",
      supplierName: r.supplier,
      abc: r.abc,
      xyz: r.xyz,
      overrideAbc: r.oabc,
      overrideXyz: r.oxyz,
      note: r.note,
    })),
    running: Boolean(lock.rows[0]?.running),
  };
  let at = 0;
  for (const r of counts.rows) {
    out.counts[`${r.abc}${r.xyz}`] = Number(r.n);
    out.profitByAbc[r.abc] += Number(r.profit) || 0;
    if (r.at) at = Math.max(at, new Date(r.at).getTime());
  }
  out.computedAt = at ? new Date(at).toISOString() : null;
  return out;
}

/** Towar z `zd_sku_class` po tw_Id albo symbolu (dokładnie, bez wielkości liter). */
export async function findZdSkuClassTw(input: string): Promise<{ twId: number; symbol: string | null; name: string } | null> {
  const q = input.trim();
  if (!q) return null;
  const res = await query<{ tw: number; symbol: string | null; name: string | null }>(
    `SELECT c.subiekt_tw_id AS tw, p.symbol, p.name
       FROM zd_sku_class c LEFT JOIN subiekt_products p ON p.subiekt_tw_id = c.subiekt_tw_id
      WHERE c.subiekt_tw_id = $2 OR lower(p.symbol) = lower($1)
      LIMIT 2`,
    // Rzutowanie w JS: Postgres nie gwarantuje kolejności warunków, `$1::int` na symbolu rzuciłby błąd.
    [q, /^\d{1,9}$/.test(q) ? Number(q) : null]
  );
  if (res.rows.length !== 1) return null;
  const r = res.rows[0]!;
  return { twId: Number(r.tw), symbol: r.symbol, name: r.name ?? "" };
}

/** Ręczne nadpisanie klasy (z powodem); oba null = usunięcie nadpisania. Przeliczenie go nie zmienia. */
export async function setZdSkuClassOverride(input: {
  twId: number;
  abc: ZdAbc | null;
  xyz: ZdXyz | null;
  note: string | null;
}): Promise<boolean> {
  const clear = input.abc == null && input.xyz == null;
  const res = await query(
    `UPDATE zd_sku_class SET override_abc = $2, override_xyz = $3, override_note = $4 WHERE subiekt_tw_id = $1`,
    [input.twId, input.abc, input.xyz, clear ? null : input.note]
  );
  return (res.rowCount ?? 0) > 0;
}
