/** Raport czasów dostaw ZD → FZ dla panelu admina (porównanie z pomiarami z panelu). */
import { query } from "@/lib/db/pool";
import {
  isSubiektLeadTimesSyncRunning,
  readSubiektLeadTimesState,
  type SubiektLeadTimesSyncState,
} from "@/lib/data/subiekt-lead-times-sync";
import { SUBIEKT_STATS_WINDOW_MONTHS } from "@/lib/orders/delivery-stats-samples";

export type SubiektLeadTimeSupplierStatus =
  | "subiekt"
  | "subiekt_old"
  | "panel_fallback"
  | "shared_kh"
  | "osobno"
  | "no_kh"
  | "no_data";

export type SubiektLeadTimeSupplierRow = {
  supplierId: string;
  name: string;
  isActive: boolean;
  status: SubiektLeadTimeSupplierStatus;
  subiektAll: number;
  subiektWindow: number;
  subiektP50: number | null;
  subiektP90: number | null;
  /** Mediana do pierwszej dostawy (część towaru) w oknie. */
  subiektFirstP50: number | null;
  correctedWindow: number;
  lastZdDate: string | null;
  panelCount: number;
  panelP50: number | null;
  /** Średnia, której ETA używa teraz (delivery_stats). */
  etaAvg: number | null;
  trend: Array<{ year: number; n: number; p50: number }>;
};

export type SubiektLeadTimesReport = {
  state: SubiektLeadTimesSyncState | null;
  /** Synchronizacja w toku (np. pełna historia w tle). */
  running: boolean;
  windowMonths: number;
  docs: { zd: number; fz: number; oldest: string | null; newest: string | null };
  suppliers: SubiektLeadTimeSupplierRow[];
  /** Konta z Subiekta z zamówieniami w oknie, bez karty dostawcy w OnTime. */
  unmapped: Array<{ khId: number; khSymbol: string | null; orders: number; lastZdDate: string | null }>;
};

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export async function fetchSubiektLeadTimesReport(): Promise<SubiektLeadTimesReport> {
  const windowSql = `current_date - interval '${SUBIEKT_STATS_WINDOW_MONTHS} months'`;

  const [state, running, docs, suppliers, trend, unmapped] = await Promise.all([
    readSubiektLeadTimesState(),
    isSubiektLeadTimesSyncRunning(),
    query<{ zd: string; fz: string; oldest: string | null; newest: string | null }>(
      `SELECT count(*) FILTER (WHERE typ = 15) AS zd, count(*) FILTER (WHERE typ = 1) AS fz,
              to_char(min(data_wyst), 'YYYY-MM-DD') AS oldest, to_char(max(data_wyst), 'YYYY-MM-DD') AS newest
       FROM subiekt_purchase_docs`
    ),
    query(
      `WITH kh AS (
         SELECT subiekt_kh_id AS kh, id AS supplier_id FROM suppliers WHERE subiekt_kh_id IS NOT NULL
         UNION SELECT subiekt_kh_id, supplier_id FROM supplier_subiekt_kh_aliases
       ), shared AS (
         -- Jak loadKhAssignment: dostawca bez ani jednego „własnego” kontrahenta.
         SELECT k.supplier_id FROM kh k GROUP BY k.supplier_id
         HAVING bool_and((SELECT count(DISTINCT supplier_id) FROM kh k2 WHERE k2.kh = k.kh) > 1)
       ), s AS (
         SELECT supplier_id, source, business_days_full AS d, business_days_first AS d1,
                placement_date, date_corrected, placement_date >= ${windowSql} AS in_win
         FROM delivery_stats_samples WHERE deleted_at IS NULL
       )
       SELECT sup.id, sup.name, sup.is_active, sup.stats_mode,
              EXISTS (SELECT 1 FROM kh WHERE kh.supplier_id = sup.id) AS has_kh,
              sup.id IN (SELECT supplier_id FROM shared) AS shared_kh,
              count(*) FILTER (WHERE s.source = 'subiekt') AS sub_all,
              count(*) FILTER (WHERE s.source = 'subiekt' AND s.in_win) AS sub_win,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY s.d) FILTER (WHERE s.source = 'subiekt' AND s.in_win) AS sub_p50,
              percentile_disc(0.9) WITHIN GROUP (ORDER BY s.d) FILTER (WHERE s.source = 'subiekt' AND s.in_win) AS sub_p90,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY s.d1) FILTER (WHERE s.source = 'subiekt' AND s.in_win) AS sub_first_p50,
              count(*) FILTER (WHERE s.source = 'subiekt' AND s.in_win AND s.date_corrected) AS corrected,
              to_char(max(s.placement_date) FILTER (WHERE s.source = 'subiekt'), 'YYYY-MM-DD') AS last_zd,
              count(*) FILTER (WHERE s.source IN ('receive', 'backfill')) AS panel_n,
              count(*) FILTER (WHERE s.source <> 'subiekt') AS other_n,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY s.d) FILTER (WHERE s.source IN ('receive', 'backfill')) AS panel_p50,
              (SELECT CASE WHEN coalesce(ds.main_count, 0) + coalesce(ds.side_count, 0) > 0
                        THEN round((coalesce(ds.main_sum, 0) + coalesce(ds.side_sum, 0))
                                   / (coalesce(ds.main_count, 0) + coalesce(ds.side_count, 0)), 1) END
                 FROM delivery_stats ds WHERE ds.supplier_id = sup.id) AS eta_avg
       FROM suppliers sup LEFT JOIN s ON s.supplier_id = sup.id
       GROUP BY sup.id`
    ),
    query<{ supplier_id: string; year: number; n: string; p50: number }>(
      `SELECT supplier_id, extract(year FROM placement_date)::int AS year, count(*) AS n,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY business_days_full) AS p50
       FROM delivery_stats_samples
       WHERE deleted_at IS NULL AND source = 'subiekt'
         AND placement_date >= date_trunc('year', current_date) - interval '5 years'
       GROUP BY 1, 2`
    ),
    query<{ kh_id: number; kh_symbol: string | null; orders: string; last_zd: string | null }>(
      `WITH mapped AS (
         SELECT subiekt_kh_id AS kh FROM suppliers WHERE subiekt_kh_id IS NOT NULL
         UNION SELECT subiekt_kh_id FROM supplier_subiekt_kh_aliases
       )
       SELECT kh_id, max(kh_symbol) AS kh_symbol, count(*) AS orders,
              to_char(max(data_wyst), 'YYYY-MM-DD') AS last_zd
       FROM subiekt_purchase_docs
       WHERE typ = 15 AND kh_id IS NOT NULL AND data_wyst >= ${windowSql}
         AND kh_id NOT IN (SELECT kh FROM mapped)
       GROUP BY kh_id ORDER BY count(*) DESC LIMIT 40`
    ),
  ]);

  const trendBySupplier = new Map<string, SubiektLeadTimeSupplierRow["trend"]>();
  for (const t of trend.rows) {
    const list = trendBySupplier.get(t.supplier_id) ?? [];
    list.push({ year: t.year, n: Number(t.n), p50: Number(t.p50) });
    trendBySupplier.set(t.supplier_id, list);
  }

  const rows: SubiektLeadTimeSupplierRow[] = suppliers.rows.map((r) => {
    const subAll = Number(r.sub_all);
    const subWin = Number(r.sub_win);
    const panelN = Number(r.panel_n);
    // Kolejność jak w selectSamplesForStats / loadKhAssignment.
    const status: SubiektLeadTimeSupplierStatus =
      r.stats_mode === "OSOBNO"
        ? "osobno"
        : r.shared_kh
          ? "shared_kh"
          : !r.has_kh
            ? "no_kh"
            : subWin > 0
              ? "subiekt"
              : subAll > 0 && Number(r.other_n) > 0
                ? "panel_fallback"
                : subAll > 0
                  ? "subiekt_old"
                  : "no_data";
    return {
      supplierId: r.id,
      name: r.name,
      isActive: r.is_active,
      status,
      subiektAll: subAll,
      subiektWindow: subWin,
      subiektP50: num(r.sub_p50),
      subiektP90: num(r.sub_p90),
      subiektFirstP50: num(r.sub_first_p50),
      correctedWindow: Number(r.corrected),
      lastZdDate: r.last_zd,
      panelCount: panelN,
      panelP50: num(r.panel_p50),
      etaAvg: num(r.eta_avg),
      trend: (trendBySupplier.get(r.id) ?? []).sort((a, b) => a.year - b.year),
    };
  });
  rows.sort((a, b) => b.subiektWindow - a.subiektWindow || a.name.localeCompare(b.name, "pl"));

  const d = docs.rows[0];
  return {
    state,
    running,
    windowMonths: SUBIEKT_STATS_WINDOW_MONTHS,
    docs: { zd: Number(d?.zd ?? 0), fz: Number(d?.fz ?? 0), oldest: d?.oldest ?? null, newest: d?.newest ?? null },
    suppliers: rows,
    unmapped: unmapped.rows.map((u) => ({
      khId: u.kh_id,
      khSymbol: u.kh_symbol,
      orders: Number(u.orders),
      lastZdDate: u.last_zd,
    })),
  };
}
