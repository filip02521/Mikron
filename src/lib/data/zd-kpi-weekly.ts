/**
 * KPI tygodniowe automatu ZD (`zd_kpi_weekly.metrics`) — spec §5, cron w poniedziałek rano.
 * Właściciel znaczeń `zd_kpi_weekly`. Tylko GET do Subiekta.
 *
 * Dostawcy: z polityką ≠ classic (`zd_supplier_order_policy`) albo z Polski
 * (`suppliers.subiekt_country_id = 1`, zadanie 2 — bez tej kolumny zostaje sama polityka).
 * Populacja towarów = `zd_sku_class` dostawcy (zmapowane zakresy), klasa = nadpisanie ?? policzona.
 */
import { query } from "@/lib/db/pool";
import { mapPool } from "@/lib/async/map-pool";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import { subiektJson } from "@/lib/subiekt/client";
import type { SubiektConfig } from "@/lib/subiekt/config";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import { readPrices } from "@/lib/price-lists/subiekt-prices";
import { fetchZdEstimatePackaging, type ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import { fetchZdProductPairs, type ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import { unitPricePerPiece, type StockWatchPackaging } from "@/lib/stock-watch/analysis";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { SUBIEKT_COUNTRY_ID_POLAND, type ZdAbc } from "@/lib/orders/zd-automat-contract";
import {
  fetchZdAsortyment,
  subiektOrdersConfig,
  withSubiektRetry,
  type ZdScopeRef,
} from "@/lib/data/zd-sku-class-sync";

const LOCK_KEY = "job_zd_kpi_weekly_lock";
const LOCK_TTL_SEC = 60 * 60;
const CONCURRENCY = 6;
/** Okno dziennego kosztu sprzedaży do rotacji. */
export const ZD_KPI_COST_DAYS = 90;
/** Bez sprzedaży tyle dni = martwy zapas. */
export const ZD_KPI_DEAD_DAYS = 180;

const addDays = (key: string, days: number) =>
  new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 10_000) / 100 : null);

/** Poniedziałek ostatniego pełnego tygodnia (pn–nd) przed dniem `today`. */
export function zdKpiWeekStart(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = niedziela
  return addDays(today, -((dow + 6) % 7) - 7);
}

// ---------------------------------------------------------------------------
// Czyste wyliczenia (testy: zd-kpi-weekly.test.ts)
// ---------------------------------------------------------------------------

export type ZdKpiOos = { pct: number | null; zeroDays: number; skuDays: number };

/** % dni-towarów A z dostępnym ≤ 0 (`stock_daily_history`, zapis rano przed sprzedażą). Brak zapisu dnia = nie liczy się. */
export function zdKpiOosA(rows: ReadonlyArray<{ twId: number; available: number }>, aTwIds: ReadonlySet<number>): ZdKpiOos {
  let zeroDays = 0;
  let skuDays = 0;
  for (const r of rows) {
    if (!aTwIds.has(r.twId)) continue;
    skuDays++;
    if (r.available <= 0) zeroDays++;
  }
  return { pct: pct(zeroDays, skuDays), zeroDays, skuDays };
}

/**
 * Cena z ostatniego ZD za sztukę karty: `product_purchase_prices` jest w jednostce dokumentu ZD
 * (przy opakowaniach — za paczkę), a stan w sztukach. Opakowania i pary jak w Kreatorze (pary wygrywają).
 */
export function zdKpiLastZdPricePerPiece(
  prices: ReadonlyArray<{ twId: number; priceNet: number }>,
  packaging: ReadonlyArray<Pick<ZdEstimatePackagingRow, "subiektTwId" | "unitsPerPackage" | "documentUnitMode">>,
  pairs: ReadonlyArray<Pick<ZdProductPairRow, "packTwId" | "unitsPerPack">>
): Map<number, number> {
  const pkg = new Map<number, StockWatchPackaging>();
  for (const r of packaging) pkg.set(r.subiektTwId, { unitsPerPackage: r.unitsPerPackage, documentUnitMode: r.documentUnitMode });
  for (const p of pairs) pkg.set(p.packTwId, { unitsPerPackage: p.unitsPerPack, documentUnitMode: "packages" });
  const out = new Map<number, number>();
  for (const p of prices) {
    const unit = unitPricePerPiece(p.priceNet, pkg.get(p.twId) ?? null);
    if (unit != null) out.set(p.twId, unit);
  }
  return out;
}

export type ZdKpiStockItem = {
  twId: number;
  abc: ZdAbc;
  stock: number;
  /** Cena kartotekowa, fallback cena z ostatniego ZD; null = bez ceny (wartość 0, liczone w `unpriced`). */
  price: number | null;
  /** Koszt sprzedaży (`asortyment.koszt`) z ostatnich {@link ZD_KPI_COST_DAYS} dni. */
  cost: number;
  /** Sprzedaż w ostatnich {@link ZD_KPI_DEAD_DAYS} dniach (ilość > 0 w asortymencie). */
  soldRecently: boolean;
};

export type ZdKpiRotationPart = { days: number | null; stockValue: number; dailyCost: number };
export type ZdKpiRotation = ZdKpiRotationPart & { byAbc: Record<ZdAbc, ZdKpiRotationPart>; unpriced: number };
export type ZdKpiDeadStock = { value: number; skus: number };

/** Rotacja w dniach = wartość zapasu / dzienny koszt sprzedaży; martwy zapas = wartość towarów bez sprzedaży 180 dni. */
export function zdKpiStock(items: readonly ZdKpiStockItem[]): { rotation: ZdKpiRotation; deadStock: ZdKpiDeadStock } {
  const part = () => ({ value: 0, cost: 0 });
  const all = part();
  const byAbc = { A: part(), B: part(), C: part() };
  const dead = { value: 0, skus: 0 };
  let unpriced = 0;
  for (const it of items) {
    const value = it.stock > 0 && it.price != null ? it.stock * it.price : 0;
    if (it.stock > 0 && it.price == null) unpriced++;
    for (const p of [all, byAbc[it.abc]]) {
      p.value += value;
      p.cost += it.cost;
    }
    if (it.stock > 0 && !it.soldRecently) {
      dead.value += value;
      dead.skus++;
    }
  }
  const out = (p: { value: number; cost: number }): ZdKpiRotationPart => {
    const dailyCost = p.cost / ZD_KPI_COST_DAYS;
    return {
      days: dailyCost > 0 ? Math.round((p.value / dailyCost) * 10) / 10 : null,
      stockValue: round2(p.value),
      dailyCost: round2(dailyCost),
    };
  };
  return {
    rotation: { ...out(all), byAbc: { A: out(byAbc.A), B: out(byAbc.B), C: out(byAbc.C) }, unpriced },
    deadStock: { value: round2(dead.value), skus: dead.skus },
  };
}

export type ZdKpiProposal = {
  status: string;
  /** Odłożona przez minimum (zadanie 5) — także gdy potem wygasła albo przyjęta „mimo to”. */
  deferred?: boolean;
  lines: ReadonlyArray<{ twId: number; zdUnits: number; pieces: number; priceNet: number | null }>;
  finalLines: Record<string, number> | null;
};

export type ZdKpiHumanCorrection = {
  pct: number | null;
  changedValue: number;
  proposalValue: number;
  proposals: number;
  /** Pozycje dopisane na ZD spoza propozycji — bez ceny w propozycji, nie wchodzą do wartości. */
  addedLines: number;
};

const unitValue = (l: ZdKpiProposal["lines"][number]) =>
  l.priceNet != null && l.zdUnits > 0 ? (l.pieces / l.zdUnits) * l.priceNet : null;

/** Wartość ZD po decyzji: jednostki z `final_lines` × wartość jednostki z propozycji. */
export function zdKpiFinalValue(p: ZdKpiProposal): number {
  if (!p.finalLines) return 0;
  let v = 0;
  for (const l of p.lines) v += (Number(p.finalLines[String(l.twId)]) || 0) * (unitValue(l) ?? 0);
  return v;
}

/** % wartości propozycji zmienionej: Σ |jednostki ZD − jednostki propozycji| × wartość jednostki / wartość propozycji. */
export function zdKpiHumanCorrection(proposals: readonly ZdKpiProposal[]): ZdKpiHumanCorrection {
  let changed = 0;
  let total = 0;
  let count = 0;
  let added = 0;
  for (const p of proposals) {
    if (p.status !== "accepted" || !p.finalLines) continue;
    count++;
    const inProposal = new Set<string>();
    for (const l of p.lines) {
      inProposal.add(String(l.twId));
      const uv = unitValue(l);
      if (uv == null) continue;
      total += l.zdUnits * uv;
      changed += Math.abs((Number(p.finalLines[String(l.twId)]) || 0) - l.zdUnits) * uv;
    }
    for (const k of Object.keys(p.finalLines)) if (!inProposal.has(k)) added++;
  }
  return { pct: pct(changed, total), changedValue: round2(changed), proposalValue: round2(total), proposals: count, addedLines: added };
}

export type ZdKpiMinima = {
  proposals: number;
  deferred: number;
  deferredPct: number | null;
  accepted: number;
  acceptedAboveMin: number;
  /** null = dostawca bez minimum albo brak utworzonych ZD. */
  aboveMinPct: number | null;
  minOrderValue: number | null;
};

/**
 * % propozycji odłożonych i % utworzonych ZD z wartością ≥ minimum dostawcy. Odłożona = status `deferred`
 * albo `deferred_reason` — nowa propozycja wygasza odłożoną, więc sam status zaniżałby wynik.
 */
export function zdKpiMinima(proposals: readonly ZdKpiProposal[], minOrderValue: number | null): ZdKpiMinima {
  const deferred = proposals.filter((p) => p.status === "deferred" || p.deferred).length;
  const accepted = proposals.filter((p) => p.status === "accepted" && p.finalLines);
  const above =
    minOrderValue != null && minOrderValue > 0 ? accepted.filter((p) => zdKpiFinalValue(p) >= minOrderValue).length : 0;
  return {
    proposals: proposals.length,
    deferred,
    deferredPct: pct(deferred, proposals.length),
    accepted: accepted.length,
    acceptedAboveMin: above,
    aboveMinPct: minOrderValue != null && minOrderValue > 0 ? pct(above, accepted.length) : null,
    minOrderValue,
  };
}

export type ZdKpiWeeklyMetrics = {
  version: 1;
  weekStart: string;
  weekEnd: string;
  skus: number;
  skusA: number;
  oosA: ZdKpiOos;
  rotation: ZdKpiRotation;
  deadStock: ZdKpiDeadStock;
  humanCorrection: ZdKpiHumanCorrection;
  minima: ZdKpiMinima;
};

// ---------------------------------------------------------------------------
// Przebieg (cron / ręcznie)
// ---------------------------------------------------------------------------

type KpiSupplier = {
  id: string;
  name: string;
  minOrderValue: number | null;
  scopes: ZdScopeRef[];
  /** Strategia ≠ classic = dostawca w automacie propozycji; null = tylko polski dostawca (pomiar). */
  automat: { autoLevel: number; cycleDays: number | null } | null;
};

async function loadKpiSuppliers(): Promise<KpiSupplier[]> {
  const res = await query<{
    id: string;
    name: string;
    min_order_value: string | null;
    mode: "grupa" | "cecha";
    scope_id: number;
    strategy: string | null;
    auto_level: string | null;
    auto_proposals: boolean | null;
    cycle_days: number | null;
  }>(
    // auto_level przez to_jsonb: baza bez migracji 194 czyta się dalej (stopień z auto_proposals).
    `SELECT s.id, s.name, s.min_order_value, z.mode, COALESCE(z.grupa_id, z.cecha_id) AS scope_id,
            p.strategy, to_jsonb(p.*) ->> 'auto_level' AS auto_level, p.auto_proposals, p.cycle_days
       FROM suppliers s
       JOIN zd_estimate_supplier_scopes z ON z.supplier_id = s.id
       LEFT JOIN zd_supplier_order_policy p ON p.supplier_id = s.id
      WHERE (p.strategy IS NOT NULL AND p.strategy <> 'classic') OR s.subiekt_country_id = $1
      ORDER BY s.name`,
    [SUBIEKT_COUNTRY_ID_POLAND]
  );
  const out = new Map<string, KpiSupplier>();
  for (const r of res.rows) {
    const s = out.get(r.id) ?? {
      id: r.id,
      name: r.name,
      minOrderValue: r.min_order_value != null ? Number(r.min_order_value) : null,
      scopes: [],
      automat:
        r.strategy && r.strategy !== "classic"
          ? {
              autoLevel: Math.max(Number(r.auto_level) || 0, r.auto_proposals ? 1 : 0),
              cycleDays: r.cycle_days != null ? Number(r.cycle_days) : null,
            }
          : null,
    };
    s.scopes.push({ mode: r.mode, scopeId: Number(r.scope_id) });
    out.set(r.id, s);
  }
  return [...out.values()];
}

/** Stan z `GET /products?cechaId|grupaId` (tw_Stan) — zdjęcie w chwili przebiegu. */
async function fetchScopeStock(cfg: SubiektConfig, scope: ZdScopeRef): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (let page = 1, total = 1; page <= total; page++) {
    const qs = subiektQueryString({
      [scope.mode === "cecha" ? "cechaId" : "grupaId"]: scope.scopeId,
      page,
      pageSize: 200,
    });
    const j = await withSubiektRetry(() =>
      subiektJson<{ data?: Array<Record<string, unknown>>; pagination?: { totalPages?: number } }>(
        `${SUBIEKT_PATHS.products}${qs}`,
        {},
        cfg
      )
    );
    for (const p of j.data ?? []) out.set(Math.trunc(Number(p.tw_Id)), Number(p.tw_Stan) || 0);
    total = Math.max(1, Math.trunc(Number(j.pagination?.totalPages)) || 1);
  }
  return out;
}

async function computeSupplierKpi(
  cfg: SubiektConfig,
  s: KpiSupplier,
  week: { start: string; end: string },
  today: string,
  lastZdPrice: Map<number, number>
): Promise<ZdKpiWeeklyMetrics> {
  const classes = await query<{ tw: number; abc: ZdAbc }>(
    `SELECT subiekt_tw_id AS tw, COALESCE(override_abc, abc) AS abc FROM zd_sku_class WHERE supplier_id = $1`,
    [s.id]
  );
  const abcOf = new Map(classes.rows.map((r) => [Number(r.tw), r.abc]));
  const aIds = new Set([...abcOf].filter(([, c]) => c === "A").map(([tw]) => tw));

  const history = await query<{ tw: number; available: string }>(
    `SELECT subiekt_tw_id AS tw, available_qty AS available FROM stock_daily_history
      WHERE subiekt_tw_id = ANY($1::int[]) AND day BETWEEN $2 AND $3`,
    [[...aIds], week.start, week.end]
  );
  const oosA = zdKpiOosA(history.rows.map((r) => ({ twId: Number(r.tw), available: Number(r.available) })), aIds);

  const yesterday = addDays(today, -1);
  const stock = new Map<number, number>();
  const cost = new Map<number, number>();
  const sold = new Set<number>();
  for (const scope of s.scopes) {
    for (const [tw, q] of await fetchScopeStock(cfg, scope)) stock.set(tw, q);
    for (const r of await fetchZdAsortyment(cfg, scope, addDays(today, -ZD_KPI_COST_DAYS), yesterday)) cost.set(r.twId, r.koszt);
    for (const r of await fetchZdAsortyment(cfg, scope, addDays(today, -ZD_KPI_DEAD_DAYS), yesterday)) if (r.qty > 0) sold.add(r.twId);
  }
  const inStock = [...abcOf.keys()].filter((tw) => (stock.get(tw) ?? 0) > 0);
  const catalog = new Map<number, number | null>();
  await mapPool(inStock, CONCURRENCY, async (tw) => {
    try {
      catalog.set(tw, (await withSubiektRetry(() => readPrices(cfg, tw))).purchase);
    } catch {
      catalog.set(tw, null);
    }
  });
  const items: ZdKpiStockItem[] = [...abcOf].map(([tw, abc]) => {
    const kart = catalog.get(tw);
    return {
      twId: tw,
      abc,
      stock: stock.get(tw) ?? 0,
      price: kart != null && kart > 0 ? kart : (lastZdPrice.get(tw) ?? null),
      cost: cost.get(tw) ?? 0,
      soldRecently: sold.has(tw),
    };
  });
  const { rotation, deadStock } = zdKpiStock(items);

  const props = await query<{
    status: string;
    lines: ZdKpiProposal["lines"];
    final_lines: Record<string, number> | null;
    deferred: boolean;
  }>(
    `SELECT status, lines, final_lines, deferred_reason IS NOT NULL AS deferred FROM zd_auto_proposals
      WHERE supplier_id = $1 AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN $2 AND $3`,
    [s.id, week.start, week.end]
  );
  const proposals: ZdKpiProposal[] = props.rows.map((r) => ({
    status: r.status,
    deferred: r.deferred,
    lines: Array.isArray(r.lines) ? r.lines : [],
    finalLines: r.final_lines,
  }));

  return {
    version: 1,
    weekStart: week.start,
    weekEnd: week.end,
    skus: abcOf.size,
    skusA: aIds.size,
    oosA,
    rotation,
    deadStock,
    humanCorrection: zdKpiHumanCorrection(proposals),
    minima: zdKpiMinima(proposals, s.minOrderValue),
  };
}

export type ZdKpiWeeklyRunResult = {
  ok: boolean;
  weekStart: string;
  suppliers: number;
  written: number;
  failed: string[];
  durationMs: number;
  error?: string;
};

export async function runZdKpiWeekly(opts: { today?: string } = {}): Promise<
  ZdKpiWeeklyRunResult | { skipped: "already_running" }
> {
  if (!(await tryAcquireLock(LOCK_KEY, LOCK_TTL_SEC, "zd_kpi_weekly"))) return { skipped: "already_running" };
  const t0 = Date.now();
  const today = opts.today ?? todayDateKeyInWarsaw();
  const start = zdKpiWeekStart(today);
  const week = { start, end: addDays(start, 6) };
  const base: ZdKpiWeeklyRunResult = { ok: false, weekStart: start, suppliers: 0, written: 0, failed: [], durationMs: 0 };
  try {
    const cfg = subiektOrdersConfig();
    const suppliers = await loadKpiSuppliers();
    base.suppliers = suppliers.length;
    const [prices, packaging, pairs] = await Promise.all([
      query<{ tw: number; price: string }>(`SELECT subiekt_tw_id AS tw, price_net AS price FROM product_purchase_prices`),
      fetchZdEstimatePackaging(),
      fetchZdProductPairs(),
    ]);
    const lastZdPrice = zdKpiLastZdPricePerPiece(
      prices.rows.map((r) => ({ twId: Number(r.tw), priceNet: Number(r.price) })),
      packaging,
      pairs
    );
    for (const s of suppliers) {
      try {
        const metrics = await computeSupplierKpi(cfg, s, week, today, lastZdPrice);
        await query(
          `INSERT INTO zd_kpi_weekly (supplier_id, week_start, metrics, computed_at)
           VALUES ($1, $2, $3::jsonb, now())
           ON CONFLICT (supplier_id, week_start) DO UPDATE SET metrics = EXCLUDED.metrics, computed_at = now()`,
          [s.id, start, JSON.stringify(metrics)]
        );
        base.written++;
      } catch (e) {
        base.failed.push(s.name);
        console.error("[zd-kpi-weekly]", s.name, e instanceof Error ? e.message : e);
      }
    }
    return { ...base, ok: base.failed.length === 0, durationMs: Date.now() - t0,
      error: base.failed.length ? `KPI nie policzone: ${base.failed.join(", ")}` : undefined };
  } catch (e) {
    return { ...base, durationMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

// ---------------------------------------------------------------------------
// Odczyt (/zakupy/automat)
// ---------------------------------------------------------------------------

export type ZdAutomatKpiSupplier = {
  supplierId: string;
  name: string;
  /** null = polski dostawca poza automatem (tylko pomiar rotacji i braków). */
  automat: { autoLevel: number; cycleDays: number | null } | null;
  /** Najnowszy tydzień pierwszy, najwyżej 4. */
  weeks: ZdKpiWeeklyMetrics[];
};

export async function loadZdAutomatKpi(): Promise<{
  suppliers: ZdAutomatKpiSupplier[];
  computedAt: string | null;
  running: boolean;
}> {
  const [eligible, rows, lock] = await Promise.all([
    loadKpiSuppliers(),
    query<{ supplier_id: string; metrics: ZdKpiWeeklyMetrics; computed_at: Date }>(
      `SELECT supplier_id, metrics, computed_at FROM (
         SELECT k.*, row_number() OVER (PARTITION BY supplier_id ORDER BY week_start DESC) AS rn
           FROM zd_kpi_weekly k
       ) x WHERE rn <= 4 ORDER BY week_start DESC`
    ),
    query<{ running: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM job_locks WHERE key = $1 AND locked_until > now()) AS running`,
      [LOCK_KEY]
    ),
  ]);
  const names = new Map(eligible.map((s) => [s.id, s.name]));
  const automatOf = new Map(eligible.map((s) => [s.id, s.automat]));
  const missing = [...new Set(rows.rows.map((r) => r.supplier_id))].filter((id) => !names.has(id));
  if (missing.length) {
    const extra = await query<{ id: string; name: string }>(`SELECT id, name FROM suppliers WHERE id = ANY($1::uuid[])`, [missing]);
    for (const r of extra.rows) names.set(r.id, r.name);
  }
  const bySupplier = new Map<string, ZdKpiWeeklyMetrics[]>([...names.keys()].map((id) => [id, []]));
  let at = 0;
  for (const r of rows.rows) {
    bySupplier.get(r.supplier_id)?.push(r.metrics);
    at = Math.max(at, new Date(r.computed_at).getTime());
  }
  return {
    suppliers: [...bySupplier]
      .map(([supplierId, weeks]) => ({ supplierId, name: names.get(supplierId) ?? "", automat: automatOf.get(supplierId) ?? null, weeks }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl")),
    computedAt: at ? new Date(at).toISOString() : null,
    running: Boolean(lock.rows[0]?.running),
  };
}
