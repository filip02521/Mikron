/**
 * Profile sprzedaży (12 × 30 dni) — odczyt / przeliczenie / zapis oraz sztuki
 * z zrealizowanych próśb w oknie. Wspólne dla Kreatora i nocnego przebiegu
 * (oba idą przez runZdOrderEngine).
 */

import { query } from "@/lib/db/pool";
import { fetchSubiektZdEstimateAll } from "@/lib/subiekt/api";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { ZD_SALES_PROFILE, zdSalesProfileWindows } from "@/lib/orders/zd-sales-profile";

export type ZdSalesProfileScope = { mode: "grupa" | "cecha"; id: number };

/** Profil zakresu uznajemy za świeży, gdy kończy się najwyżej tyle dni przed końcem okna. */
const FRESH_DAYS = 3;

function shiftDateKey(key: string, days: number): string {
  const ms = Date.parse(`${key}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function scopeIsFresh(scope: ZdSalesProfileScope, endDate: string): Promise<boolean> {
  const { rows } = await query<{ end_date: string | null }>(
    `SELECT max(end_date)::text AS end_date
       FROM zd_sales_profiles
      WHERE scope_mode = $1 AND scope_id = $2`,
    [scope.mode, scope.id]
  );
  const latest = rows[0]?.end_date;
  return latest != null && latest >= shiftDateKey(endDate, -FRESH_DAYS) && latest <= endDate;
}

/** Okna naraz — 12 równolegle dawało timeouty SQL Subiekta przy nocnym przebiegu. */
const WINDOW_CONCURRENCY = 4;

/** Sprzedaż w 12 oknach 30-dniowych (po 4 naraz, jedno ponowienie okna). */
async function computeScopeProfiles(
  scope: ZdSalesProfileScope,
  endDate: string
): Promise<Map<number, number[]>> {
  const windows = zdSalesProfileWindows(endDate);
  const fetchWindow = (w: { dataOd: string; dataDo: string }) =>
    fetchSubiektZdEstimateAll({
      ...(scope.mode === "grupa" ? { grupaId: scope.id } : { cechaId: scope.id }),
      dataOd: w.dataOd,
      dataDo: w.dataDo,
      dniZapasu: ZD_SALES_PROFILE.windowDays,
      tylkoBraki: false,
    });
  const results: Awaited<ReturnType<typeof fetchWindow>>[] = [];
  for (let i = 0; i < windows.length; i += WINDOW_CONCURRENCY) {
    const chunk = windows.slice(i, i + WINDOW_CONCURRENCY);
    results.push(...(await Promise.all(chunk.map((w) => fetchWindow(w).catch(() => fetchWindow(w))))));
  }
  const byTw = new Map<number, number[]>();
  results.forEach((r, idx) => {
    for (const p of r.pozycje) {
      const tw = Math.trunc(Number(p.tw_Id) || 0);
      if (!(tw > 0)) continue;
      const series = byTw.get(tw) ?? Array<number>(windows.length).fill(0);
      series[idx] = Math.max(0, Number(p.sprzedazOkres) || 0);
      byTw.set(tw, series);
    }
  });
  return byTw;
}

async function saveScopeProfiles(
  scope: ZdSalesProfileScope,
  endDate: string,
  byTw: ReadonlyMap<number, number[]>
): Promise<void> {
  const tw: number[] = [];
  const series: string[] = [];
  for (const [id, w] of byTw) {
    tw.push(id);
    series.push(`{${w.join(",")}}`);
  }
  await query(`DELETE FROM zd_sales_profiles WHERE scope_mode = $1 AND scope_id = $2`, [
    scope.mode,
    scope.id,
  ]);
  if (tw.length === 0) return;
  await query(
    `INSERT INTO zd_sales_profiles (scope_mode, scope_id, subiekt_tw_id, windows, end_date)
     SELECT $1, $2, t.tw, t.w::numeric[], $5::date
       FROM unnest($3::int[], $4::text[]) AS t(tw, w)`,
    [scope.mode, scope.id, tw, series, endDate]
  );
}

async function loadScopeProfiles(scope: ZdSalesProfileScope): Promise<Map<number, number[]>> {
  const { rows } = await query<{ subiekt_tw_id: number; windows: Array<string | number> }>(
    `SELECT subiekt_tw_id, windows FROM zd_sales_profiles WHERE scope_mode = $1 AND scope_id = $2`,
    [scope.mode, scope.id]
  );
  return new Map(rows.map((r) => [r.subiekt_tw_id, r.windows.map((x) => Number(x) || 0)]));
}

/**
 * Profile dla zakresów: świeże z bazy, przeterminowane liczone z Subiekta i zapisywane.
 * Pierwszy zakres wygrywa przy towarze w kilku zakresach.
 */
export async function ensureZdSalesProfiles(input: {
  scopes: readonly ZdSalesProfileScope[];
  endDate: string;
}): Promise<Map<number, number[]>> {
  const perScope = await Promise.all(
    input.scopes.map(async (scope) => {
      if (await scopeIsFresh(scope, input.endDate)) return loadScopeProfiles(scope);
      const computed = await computeScopeProfiles(scope, input.endDate);
      await saveScopeProfiles(scope, input.endDate, computed);
      return computed;
    })
  );
  const out = new Map<number, number[]>();
  for (const map of perScope) {
    for (const [tw, w] of map) if (!out.has(tw)) out.set(tw, w);
  }
  return out;
}

/**
 * Sztuki z próśb zrealizowanych (dostawa w oknie sprzedaży) — ta sprzedaż była
 * pod klienta i nie powinna budować zapasu.
 */
export async function loadDeliveredProsbaPiecesByTwId(input: {
  twIds: readonly number[];
  dataOd: string;
  dataDo: string;
}): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (input.twIds.length === 0) return out;
  const { rows } = await query<{
    subiekt_tw_id: number;
    status: string;
    quantity: string | null;
    delivered_quantity: string | null;
  }>(
    `SELECT subiekt_tw_id, status, quantity, delivered_quantity
       FROM individual_orders
      WHERE subiekt_tw_id = ANY($1::int[])
        AND status IN ('Zrealizowane', 'Czesciowo_zrealizowane')
        AND delivery_at IS NOT NULL
        AND (delivery_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN $2::date AND $3::date`,
    [input.twIds, input.dataOd, input.dataDo]
  );
  for (const r of rows) {
    const delivered =
      parseOrderQuantity(r.delivered_quantity ?? "") ??
      (r.status === "Zrealizowane" ? parseOrderQuantity(r.quantity ?? "") : null) ??
      0;
    if (delivered > 0) out.set(r.subiekt_tw_id, (out.get(r.subiekt_tw_id) ?? 0) + delivered);
  }
  return out;
}
