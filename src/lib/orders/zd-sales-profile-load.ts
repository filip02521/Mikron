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
/**
 * Kreator: profil do tylu dni używamy od razu (okna przesunięte o kilka dni nie zmieniają
 * klasyfikacji), a odświeżamy w tle — duże zakresy liczą się nawet minutę.
 */
const USABLE_DAYS = 14;

function shiftDateKey(key: string, days: number): string {
  const ms = Date.parse(`${key}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** fresh = do 3 dni, usable = do 14 dni, none = brak / starszy / z przyszłości względem okna. */
async function latestEndDate(scope: ZdSalesProfileScope): Promise<string | null> {
  const { rows } = await query<{ end_date: string | null }>(
    `SELECT max(end_date)::text AS end_date
       FROM zd_sales_profiles
      WHERE scope_mode = $1 AND scope_id = $2`,
    [scope.mode, scope.id]
  );
  return rows[0]?.end_date ?? null;
}

async function scopeAge(
  scope: ZdSalesProfileScope,
  endDate: string
): Promise<"fresh" | "usable" | "none"> {
  const latest = await latestEndDate(scope);
  if (latest == null || latest > endDate) return "none";
  if (latest >= shiftDateKey(endDate, -FRESH_DAYS)) return "fresh";
  return latest >= shiftDateKey(endDate, -USABLE_DAYS) ? "usable" : "none";
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
  // Profil dla starszego okna (Kreator na dawnych datach) nie nadpisuje nowszego.
  const latest = await latestEndDate(scope);
  if (latest != null && latest > endDate) return;
  // Upsert, potem usunięcie towarów spoza zakresu — bez okna z pustym profilem
  // i bez konfliktu klucza, gdy Kreator i nocny przebieg liczą ten sam zakres.
  if (tw.length > 0) {
    await query(
      `INSERT INTO zd_sales_profiles (scope_mode, scope_id, subiekt_tw_id, windows, end_date)
       SELECT $1, $2, t.tw, t.w::numeric[], $5::date
         FROM unnest($3::int[], $4::text[]) AS t(tw, w)
       ON CONFLICT (scope_mode, scope_id, subiekt_tw_id) DO UPDATE
         SET windows = EXCLUDED.windows, end_date = EXCLUDED.end_date, computed_at = now()`,
      [scope.mode, scope.id, tw, series, endDate]
    );
  }
  await query(
    `DELETE FROM zd_sales_profiles
      WHERE scope_mode = $1 AND scope_id = $2 AND NOT (subiekt_tw_id = ANY($3::int[]))`,
    [scope.mode, scope.id, tw]
  );
}

/** Jedno liczenie zakresu naraz w procesie (Kreator + nocny przebieg, dwa Policz). */
const inFlight = new Map<string, Promise<Map<number, number[]>>>();

function refreshScope(scope: ZdSalesProfileScope, endDate: string): Promise<Map<number, number[]>> {
  const key = `${scope.mode}:${scope.id}:${endDate}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = computeScopeProfiles(scope, endDate)
    .then(async (computed) => {
      await saveScopeProfiles(scope, endDate, computed);
      return computed;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function loadScopeProfiles(scope: ZdSalesProfileScope): Promise<Map<number, number[]>> {
  const { rows } = await query<{ subiekt_tw_id: number; windows: Array<string | number> }>(
    `SELECT subiekt_tw_id, windows FROM zd_sales_profiles WHERE scope_mode = $1 AND scope_id = $2`,
    [scope.mode, scope.id]
  );
  return new Map(rows.map((r) => [r.subiekt_tw_id, r.windows.map((x) => Number(x) || 0)]));
}

/**
 * Profile dla zakresów: świeże z bazy, brakujące liczone z Subiekta i zapisywane.
 * `refresh: "background"` (Kreator) — profil do 14 dni od razu, odświeżenie w tle.
 * `refresh: "sync"` (nocny przebieg) — nieświeży liczony od razu.
 * Pierwszy zakres wygrywa przy towarze w kilku zakresach.
 */
export async function ensureZdSalesProfiles(input: {
  scopes: readonly ZdSalesProfileScope[];
  endDate: string;
  refresh?: "sync" | "background";
}): Promise<Map<number, number[]>> {
  const perScope = await Promise.all(
    input.scopes.map(async (scope) => {
      const age = await scopeAge(scope, input.endDate);
      if (age === "fresh") return loadScopeProfiles(scope);
      if (age === "usable" && input.refresh === "background") {
        void refreshScope(scope, input.endDate).catch((e: unknown) =>
          console.warn("[zd-sales-profile] odświeżenie w tle", scope, e)
        );
        return loadScopeProfiles(scope);
      }
      return refreshScope(scope, input.endDate);
    })
  );
  const out = new Map<number, number[]>();
  for (const map of perScope) {
    for (const [tw, w] of map) if (!out.has(tw)) out.set(tw, w);
  }
  return out;
}

/**
 * Sprzedaż pod klienta zwykle idzie kilka dni po dostawie prośby — liczymy dostawy
 * od 14 dni przed oknem do 3 dni przed jego końcem (dostarczone na końcu okna
 * najczęściej sprzedają się już po nim, więc nie ma ich w sprzedaży okna).
 */
const PROSBA_DELIVERY_LEAD_DAYS = 14;
const PROSBA_DELIVERY_TAIL_DAYS = 3;

/**
 * Sztuki z próśb zrealizowanych — ta sprzedaż była pod klienta i nie powinna budować
 * zapasu (odejmowana przy wygładzeniu, z limitem do sprzedaży w oknie).
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
    [
      input.twIds,
      shiftDateKey(input.dataOd, -PROSBA_DELIVERY_LEAD_DAYS),
      shiftDateKey(input.dataDo, -PROSBA_DELIVERY_TAIL_DAYS),
    ]
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
