/**
 * Backtest automatu ZD dla jednego dostawcy: pobranie danych (tylko GET do Subiekta + baza OnTime), symulacja
 * (`src/lib/orders/zd-backtest.ts`) i zapis do `zd_backtest_runs` (mig. 195). Uruchamiane w tle z akcji serwera;
 * jeden przebieg na dostawcę naraz. Tylko serwer.
 *
 * Okres: 365 dni kończące się wczoraj. Sprzedaż od 190 dni przed startem (okna 30/90 d i „aktywny” = sprzedaż
 * w pół roku przed startem). Stany: tygodniowe remanenty zakresu. Wycena: cena magazynowa z remanentu.
 */
import { query } from "@/lib/db/pool";
import { mapPool } from "@/lib/async/map-pool";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import { subiektJson } from "@/lib/subiekt/client";
import { resolveSubiektOrdersConfig, type SubiektConfig } from "@/lib/subiekt/config";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import { listZdEstimateSupplierScopesFor } from "@/lib/data/zd-estimate-supplier-scopes";
import { fetchZdEstimateExclusions } from "@/lib/data/zd-estimate-exclusions";
import { fetchZdEstimateOnRequests } from "@/lib/data/zd-estimate-on-request";
import { fetchTeethProductTwIdSet } from "@/lib/data/teeth-products";
import { mergeZdEstimateExcludedTwIds } from "@/lib/orders/zd-estimate-name-exclude";
import { onRequestTwIdSet } from "@/lib/orders/zd-estimate-on-request";
import { DEFAULT_DNI_ZAPASU, stockPeriodToDniZapasu } from "@/lib/orders/zd-estimate-manual";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import {
  addDaysKey,
  simulateZdBacktest,
  zdBacktestHiddenOutflowShare,
  zdBacktestReality,
  zdBacktestGrid,
  zdBacktestVerdict,
  type ZdBacktestGridPoint,
  type ZdBacktestInput,
  type ZdBacktestLeadSample,
  type ZdBacktestMetrics,
  type ZdBacktestPack,
  type ZdBacktestProduct,
  type ZdBacktestVerdict,
} from "@/lib/orders/zd-backtest";

const SIM_DAYS = 365;
const HISTORY_BEFORE_DAYS = 190;
const CONCURRENCY = 6;
const RETRIES = 3;
const PAGE = 200;
const MAX_PAGES = 100;
const LOCK_TTL_SEC = 45 * 60;

export type ZdBacktestParams = { targetDays: number; cycleDays: number };

export type ZdBacktestVariant = {
  key: "kreator" | "automat" | "pessimistic";
  label: string;
  /** Opis ustawień wariantu („co 7 dni, cel 25 dni”). */
  settings: string;
  metrics: ZdBacktestMetrics;
};

export type ZdBacktestResult = {
  version: 1;
  period: { from: string; to: string };
  params: ZdBacktestParams;
  reality: { zeroShare: number | null; avgStock: number; cycleDays: number };
  variants: ZdBacktestVariant[];
  verdict: ZdBacktestVerdict;
  /** Siatka ustawień (cel × cykl) i rekomendacja: najmniejszy zapas wśród działających, inaczej najmniej braków. */
  grid: ZdBacktestGridPoint[];
  recommended: (ZdBacktestGridPoint & { sameAsParams: boolean }) | null;
  quality: {
    skus: number;
    activeSkus: number;
    pricedActiveShare: number;
    leadSamples: number;
    /** % wartości sprzedaży, który zniknął ze stanu bez dokumentu sprzedaży (kompletacja, paczki, RW). */
    hiddenOutflowShare: number | null;
    /** Pary paczka↔sztuka liczone razem w sztukach (jak silnik). */
    pairs: number;
    /** Komplety „rozpisz na składniki” — popyt kompletu doliczony do składników. */
    explodedBoms: number;
    /** Pominięte jak w silniku: wykluczone (lista, nazwa, zęby) i „tylko na prośbę” (zamawiane pod prośbę, nie na stan). */
    excluded: number;
    onRequest: number;
  };
  notes: string[];
};

export type ZdBacktestProgress = { phase: "products" | "sales" | "stock" | "simulate"; done: number; total: number };

export type ZdBacktestRun = {
  id: string;
  supplierId: string;
  status: "queued" | "running" | "done" | "error";
  params: ZdBacktestParams;
  progress: Partial<ZdBacktestProgress>;
  result: ZdBacktestResult | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

type RunRow = {
  id: string;
  supplier_id: string;
  status: ZdBacktestRun["status"];
  params: ZdBacktestParams;
  progress: Partial<ZdBacktestProgress> | null;
  result: ZdBacktestResult | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
};

const mapRun = (r: RunRow): ZdBacktestRun => ({
  id: r.id,
  supplierId: r.supplier_id,
  status: r.status,
  params: r.params,
  progress: r.progress ?? {},
  result: r.result,
  error: r.error,
  createdAt: new Date(r.created_at).toISOString(),
  finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
});

const lockKey = (supplierId: string) => `job_zd_backtest_${supplierId}`;

export async function fetchLatestZdBacktestRun(supplierId: string): Promise<ZdBacktestRun | null> {
  const res = await query<RunRow>(
    `SELECT id, supplier_id, status, params, progress, result, error, created_at, finished_at
       FROM zd_backtest_runs WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [supplierId]
  );
  return res.rows[0] ? mapRun(res.rows[0]) : null;
}

/** Ostatni zakończony werdykt na dostawcę — lista na /zakupy/automat. Brak tabeli (mig. 195) → pusta mapa. */
export async function listLatestZdBacktestVerdicts(): Promise<
  Map<string, { status: ZdBacktestRun["status"]; verdict: ZdBacktestVerdict["kind"] | null; headline: string | null; at: string; params: ZdBacktestParams }>
> {
  try {
    const res = await query<{ supplier_id: string; status: ZdBacktestRun["status"]; result: ZdBacktestResult | null; created_at: Date; params: ZdBacktestParams }>(
      `SELECT DISTINCT ON (supplier_id) supplier_id, status, result, created_at, params
         FROM zd_backtest_runs ORDER BY supplier_id, created_at DESC`
    );
    return new Map(
      res.rows.map((r) => [
        r.supplier_id,
        {
          status: r.status,
          verdict: r.result?.verdict.kind ?? null,
          headline: r.result?.verdict.headline ?? null,
          at: new Date(r.created_at).toISOString(),
          params: r.params,
        },
      ])
    );
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "42P01") return new Map();
    throw e;
  }
}

/** Nowy przebieg; zwraca null, gdy dla dostawcy już coś się liczy (blokada w bazie). */
export async function createZdBacktestRun(input: { supplierId: string; params: ZdBacktestParams; userId: string | null }): Promise<string | null> {
  if (!(await tryAcquireLock(lockKey(input.supplierId), LOCK_TTL_SEC, "zd_backtest"))) return null;
  try {
    const res = await query<{ id: string }>(
      `INSERT INTO zd_backtest_runs (supplier_id, status, params, created_by) VALUES ($1, 'queued', $2::jsonb, $3) RETURNING id`,
      [input.supplierId, JSON.stringify(input.params), input.userId]
    );
    return res.rows[0]!.id;
  } catch (e) {
    await releaseLock(lockKey(input.supplierId));
    throw e;
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i + 1 >= RETRIES) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function paged<T>(cfg: SubiektConfig, path: string, params: Record<string, string | number | boolean>, pick: (j: unknown) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1, total = 1; page <= total; page++) {
    if (page > MAX_PAGES) throw new Error(`Subiekt: ponad ${MAX_PAGES} stron (${path})`);
    const j = await withRetry(() => subiektJson<{ pagination?: { totalPages?: number } }>(`${path}${subiektQueryString({ ...params, page, pageSize: PAGE })}`, {}, cfg));
    out.push(...pick(j));
    total = Math.max(1, Math.trunc(Number(j.pagination?.totalPages)) || 1);
  }
  return out;
}

const scopeParam = (s: { mode: string; grupaId: number | null; cechaId: number | null }): Record<string, number> =>
  s.mode === "cecha" ? { cechaId: s.cechaId ?? 0 } : { grupaId: s.grupaId ?? 0 };

async function setProgress(runId: string, progress: ZdBacktestProgress) {
  await query(`UPDATE zd_backtest_runs SET progress = $2::jsonb WHERE id = $1`, [runId, JSON.stringify(progress)]);
}

const weeklyDays = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysKey(d, 7)) out.push(d);
  return out;
};

/** Przebieg w tle: dane → warianty → werdykt → zapis. Błąd zapisuje się w wierszu, blokada zawsze puszcza. */
export async function runZdBacktest(runId: string): Promise<void> {
  const run = await query<RunRow>(`SELECT id, supplier_id, status, params, progress, result, error, created_at, finished_at FROM zd_backtest_runs WHERE id = $1`, [runId]);
  const row = run.rows[0];
  if (!row) return;
  const supplierId = row.supplier_id;
  try {
    await query(`UPDATE zd_backtest_runs SET status = 'running', started_at = now() WHERE id = $1`, [runId]);
    const result = await computeZdBacktest(supplierId, row.params, (p) => setProgress(runId, p));
    await query(`UPDATE zd_backtest_runs SET status = 'done', result = $2::jsonb, finished_at = now() WHERE id = $1`, [runId, JSON.stringify(result)]);
  } catch (e) {
    console.error("[zd-backtest]", supplierId, e);
    await query(`UPDATE zd_backtest_runs SET status = 'error', error = $2, finished_at = now() WHERE id = $1`, [
      runId,
      (e instanceof Error ? e.message : String(e)).slice(0, 500),
    ]).catch(() => undefined);
  } finally {
    await releaseLock(lockKey(supplierId));
  }
}

export async function computeZdBacktest(
  supplierId: string,
  params: ZdBacktestParams,
  onProgress: (p: ZdBacktestProgress) => Promise<void> = async () => undefined
): Promise<ZdBacktestResult> {
  const resolved = resolveSubiektOrdersConfig();
  if (!resolved.ok) throw new Error(resolved.message);
  const cfg = resolved.config;
  const supRes = await query<{ name: string; interval_weeks: string | null; stock_raw: string | null; stock: unknown }>(
    `SELECT name, interval_weeks, stock_raw, stock FROM suppliers WHERE id = $1`,
    [supplierId]
  );
  const sup = supRes.rows[0];
  if (!sup) throw new Error("Nie ma takiego dostawcy.");
  const scopes = await listZdEstimateSupplierScopesFor(supplierId);
  if (!scopes.length) throw new Error("Dostawca nie ma zakresu (grupy/cechy) w Kreatorze ZD.");

  const today = todayDateKeyInWarsaw();
  const simEnd = addDaysKey(today, -1);
  const simStart = addDaysKey(simEnd, -(SIM_DAYS - 1));
  const salesFrom = addDaysKey(simStart, -HISTORY_BEFORE_DAYS);

  await onProgress({ phase: "products", done: 0, total: scopes.length });
  const ids = new Set<number>();
  const names: Array<{ tw_Id: number; tw_Nazwa: string }> = [];
  for (const s of scopes) {
    const rows = await paged(cfg, SUBIEKT_PATHS.products, scopeParam(s), (j) => ((j as { data?: Array<{ tw_Id: number; tw_Nazwa?: string }> }).data ?? []));
    for (const r of rows) {
      const tw = Math.trunc(Number(r.tw_Id));
      if (ids.has(tw)) continue;
      ids.add(tw);
      names.push({ tw_Id: tw, tw_Nazwa: String(r.tw_Nazwa ?? "") });
    }
  }
  // Jak silnik zamówień: wykluczone (lista z Kreatora, automatycznie po nazwie, zęby) i „tylko na prośbę”
  // nie są zamawiane na stan — nie symulujemy ich i nie liczymy ich zerowego stanu jako braku.
  const [exclusions, onRequests, teeth, pairsAll] = await Promise.all([
    fetchZdEstimateExclusions(),
    fetchZdEstimateOnRequests(),
    fetchTeethProductTwIdSet().catch(() => new Set<number>()),
    query<{ pack_tw_id: number; piece_tw_id: number }>(`SELECT pack_tw_id, piece_tw_id FROM zd_product_pairs`).then((r) =>
      r.rows.map((x) => ({ packTwId: Number(x.pack_tw_id), pieceTwId: Number(x.piece_tw_id) }))
    ),
  ]);
  const excludedIds = mergeZdEstimateExcludedTwIds(names, exclusions.map((e) => e.subiektTwId), { teethTwIds: teeth });
  const onRequestIds = onRequestTwIdSet(onRequests, pairsAll);
  const skipped = { excluded: 0, onRequest: 0 };
  for (const id of [...ids]) {
    if (excludedIds.has(id)) skipped.excluded++;
    else if (onRequestIds.has(id)) skipped.onRequest++;
    else continue;
    ids.delete(id);
  }

  // Komplety „rozpisz na składniki”: sprzedaż kompletu × ilość składnika; kompletu nie zamawiamy.
  const bomRes = await query<{ parent: number; component: number; qty: string }>(
    `SELECT b.parent_tw_id AS parent, c.component_tw_id AS component, c.qty_per_parent AS qty
       FROM zd_product_boms b JOIN zd_product_bom_components c ON c.bom_id = b.id
      WHERE b.purchase_target = 'components' AND (b.parent_tw_id = ANY($1::int[]) OR c.component_tw_id = ANY($1::int[]))`,
    [[...ids]]
  );
  const explodeParents = new Set(bomRes.rows.map((r) => Number(r.parent)));
  // Pary paczka ↔ sztuka jak silnik (Kreator „Pary”): jedna pozycja w sztukach na karcie paczki —
  // popyt = sprzedaż sztuk + sprzedaż paczek × przelicznik, stan = sztuki + paczki × przelicznik, zamówienie w paczkach.
  const pairRows = (
    await query<{ pack: number; piece: number; units: number }>(
      `SELECT pack_tw_id AS pack, piece_tw_id AS piece, units_per_pack AS units FROM zd_product_pairs
        WHERE (pack_tw_id = ANY($1::int[]) OR piece_tw_id = ANY($1::int[])) AND units_per_pack > 1`,
      [[...ids]]
    )
  ).rows
    .map((r) => ({ pack: Number(r.pack), piece: Number(r.piece), units: Number(r.units) }))
    .filter((r) => !excludedIds.has(r.pack) && !excludedIds.has(r.piece));
  const pairByPack = new Map<number, { piece: number; units: number }>();
  const pieceOfPair = new Set<number>();
  for (const r of pairRows) {
    if (pairByPack.has(r.pack) || pieceOfPair.has(r.piece) || pieceOfPair.has(r.pack) || pairByPack.has(r.piece)) continue;
    pairByPack.set(r.pack, { piece: r.piece, units: r.units });
    pieceOfPair.add(r.piece);
    ids.add(r.pack);
    ids.delete(r.piece);
  }
  const salesIds = new Set([...ids, ...explodeParents, ...pieceOfPair]);

  const sales = new Map<number, Array<[string, number]>>();
  let done = 0;
  const all = [...salesIds];
  await onProgress({ phase: "sales", done: 0, total: all.length });
  await mapPool(all, CONCURRENCY, async (tw) => {
    const docs = await paged(cfg, SUBIEKT_PATHS.ordersZdEstimateTowar(tw), { dataOd: salesFrom, dataDo: simEnd }, (j) => (j as { data?: { dokumenty?: Array<Record<string, unknown>> } }).data?.dokumenty ?? []);
    const lines: Array<[string, number]> = [];
    for (const d of docs) {
      if (d.wSkladnik !== "sprzedazOkres") continue;
      const day = String(d.dok_DataWyst ?? "").slice(0, 10);
      const qty = Number(d.ob_Ilosc);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && qty > 0) lines.push([day, qty]);
    }
    sales.set(tw, lines);
    done++;
    if (done % 20 === 0 || done === all.length) await onProgress({ phase: "sales", done, total: all.length });
  });
  const demand = new Map<number, Array<readonly [string, number]>>();
  for (const id of ids) if (!explodeParents.has(id)) demand.set(id, [...(sales.get(id) ?? [])]);
  for (const [packId, { piece, units }] of pairByPack) {
    demand.set(packId, [
      ...(sales.get(packId) ?? []).map(([d, q]) => [d, q * units] as const),
      ...(sales.get(piece) ?? []),
    ]);
  }
  for (const r of bomRes.rows) {
    const list = demand.get(Number(r.component));
    if (!list) continue;
    for (const [day, q] of sales.get(Number(r.parent)) ?? []) list.push([day, q * (Number(r.qty) || 1)]);
  }

  const dates = weeklyDays(addDaysKey(simStart, -1), simEnd);
  await onProgress({ phase: "stock", done: 0, total: dates.length });
  const snapshots: Array<{ day: string; qty: Map<number, number> }> = [];
  const cost = new Map<number, number>();
  for (const [i, day] of dates.entries()) {
    const qty = new Map<number, number>();
    for (const s of scopes) {
      const rows = await paged(cfg, SUBIEKT_PATHS.productsRemanent, { ...scopeParam(s), naDzien: day }, (j) => (j as { data?: { pozycje?: Array<{ tw_Id: number; ilosc: number; cenaMag: number }> } }).data?.pozycje ?? []);
      for (const r of rows) {
        const tw = Math.trunc(Number(r.tw_Id));
        qty.set(tw, (qty.get(tw) ?? 0) + (Number(r.ilosc) || 0));
        if (!cost.has(tw) && Number(r.cenaMag) > 0) cost.set(tw, Number(r.cenaMag));
      }
    }
    snapshots.push({ day, qty });
    if ((i + 1) % 5 === 0 || i + 1 === dates.length) await onProgress({ phase: "stock", done: i + 1, total: dates.length });
  }

  const pieceCost = new Map<number, number>();
  for (const [packId, { piece, units }] of pairByPack) {
    for (const s of snapshots) s.qty.set(packId, (s.qty.get(packId) ?? 0) * units + (s.qty.get(piece) ?? 0));
    const c = cost.get(piece) ?? (cost.has(packId) ? cost.get(packId)! / units : undefined);
    if (c != null) pieceCost.set(packId, c);
  }

  // Towar, którego cały okres nie było na stanie, nie ma ceny w remanencie — bez niej wypadłby z porównania
  // (a to właśnie towary z brakami). Zapasowo koszt sprzedaży ÷ ilość z raportu asortymentowego za rok przed końcem.
  for (const s of scopes) {
    const rows = await paged(cfg, "/reports/sprzedaz/asortyment", { ...scopeParam(s), dataOd: salesFrom, dataDo: simEnd, zDetalem: true }, (j) =>
      ((j as { data?: { items?: Array<{ towarId: number; ilosc: number; koszt: number }> } }).data?.items ?? [])
    );
    for (const r of rows) {
      const tw = Math.trunc(Number(r.towarId));
      if (!cost.has(tw) && Number(r.ilosc) > 0 && Number(r.koszt) > 0) cost.set(tw, Number(r.koszt) / Number(r.ilosc));
    }
  }
  // Para: wycena i zamówienie w sztukach karty paczki (cena sztuki, paczka = przelicznik sztuk).
  for (const [packId, { piece, units }] of pairByPack) {
    const c = pieceCost.get(packId) ?? cost.get(piece) ?? (cost.has(packId) ? cost.get(packId)! / units : undefined);
    if (c != null) cost.set(packId, c);
  }

  await onProgress({ phase: "simulate", done: 0, total: 1 });
  const [packRes, leadRes] = await Promise.all([
    query<{ tw: number; units: number; mode: string | null; mult: number | null }>(
      `SELECT subiekt_tw_id AS tw, units_per_package AS units, document_unit_mode AS mode, order_multiple AS mult
         FROM zd_estimate_packaging WHERE subiekt_tw_id = ANY($1::int[])`,
      [[...ids]]
    ),
    query<{ d: string; full: number; first: number | null }>(
      `SELECT to_char(placement_date, 'YYYY-MM-DD') AS d, business_days_full AS full, business_days_first AS first
         FROM delivery_stats_samples
        WHERE supplier_id = $1 AND deleted_at IS NULL AND NOT is_teeth AND source <> 'import'`,
      [supplierId]
    ),
  ]);
  const pack = new Map<number, ZdBacktestPack>(
    packRes.rows.map((r) => [
      Number(r.tw),
      { unitsPerPackage: Number(r.units), documentUnitMode: r.mode === "pieces_multiple" ? "pieces_multiple" : "packages", orderMultiple: r.mult },
    ])
  );
  const lead: ZdBacktestLeadSample[] = leadRes.rows.map((r) => ({ placementDate: r.d, fullDays: Number(r.full), firstDays: r.first == null ? null : Number(r.first) }));
  const activeFrom = addDaysKey(simStart, -182);
  const products: ZdBacktestProduct[] = [...demand.keys()].map((id) => ({
    id,
    cost: cost.get(id) ?? null,
    active: (demand.get(id) ?? []).some(([d]) => d >= activeFrom && d < simStart),
    pack: pairByPack.has(id)
      ? { unitsPerPackage: pairByPack.get(id)!.units, documentUnitMode: "packages", orderMultiple: pack.get(id)?.orderMultiple ?? null }
      : (pack.get(id) ?? null),
  }));
  const input: ZdBacktestInput = { simStart, days: SIM_DAYS, products, demand, snapshots, lead };

  const supplierCycle = Math.max(1, Math.round((Number(sup.interval_weeks) || 1) * 7));
  const kreatorDays = (() => {
    const d = stockPeriodToDniZapasu(sup.stock_raw, sup.stock != null ? Number(sup.stock) : null);
    return d != null && d > 0 ? d : DEFAULT_DNI_ZAPASU;
  })();
  const variants: ZdBacktestVariant[] = [
    {
      key: "kreator",
      label: "Kreator dziś",
      settings: `${kreatorDays} dni sprzedaży, co ${supplierCycle} dni`,
      metrics: simulateZdBacktest(input, { kind: "kreator", days: kreatorDays, cycleDays: supplierCycle }),
    },
    {
      key: "automat",
      label: "Automat",
      settings: `co ${params.cycleDays} dni, cel ${params.targetDays} dni`,
      metrics: simulateZdBacktest(input, { kind: "automat", targetDays: params.targetDays, cycleDays: params.cycleDays, arrival: "first" }),
    },
    {
      key: "pessimistic",
      label: "Automat, opóźnione dostawy",
      settings: "towar dopiero z ostatnią dostawą zamówienia",
      metrics: simulateZdBacktest(input, { kind: "automat", targetDays: params.targetDays, cycleDays: params.cycleDays, arrival: "full" }),
    },
  ];
  const reality = zdBacktestReality(input);
  const { grid, recommended } = zdBacktestGrid(input, reality);
  const active = products.filter((p) => p.active);
  const pricedActiveShare = active.length ? (100 * active.filter((p) => p.cost != null).length) / active.length : 0;
  const hiddenOutflowShare = zdBacktestHiddenOutflowShare(input);
  const verdict = zdBacktestVerdict({
    reality,
    automat: variants[1]!.metrics,
    pessimistic: variants[2]!.metrics,
    quality: { activeSkus: active.length, pricedActiveShare, leadSamples: lead.length },
  });
  const notes: string[] = [];
  if (hiddenOutflowShare != null && hiddenOutflowShare >= 10) {
    notes.push(
      `${Math.round(hiddenOutflowShare)}% wartości sprzedaży znika ze stanu bez dokumentu sprzedaży (kompletacja, rozbijanie kartonów, RW). Backtest nie liczy tego jako popytu — wynik może być zbyt optymistyczny.`
    );
  }
  if (pairByPack.size) notes.push(`${pairByPack.size} par paczka ↔ sztuka liczonych razem w sztukach, jak w silniku.`);
  if (explodeParents.size) notes.push(`${explodeParents.size} kompletów rozpisanych na składniki — ich sprzedaż doliczona do składników.`);

  return {
    version: 1,
    period: { from: simStart, to: simEnd },
    params,
    reality: { ...reality, cycleDays: supplierCycle },
    variants,
    verdict,
    grid,
    recommended: recommended
      ? { ...recommended, sameAsParams: recommended.targetDays === params.targetDays && recommended.cycleDays === params.cycleDays }
      : null,
    quality: {
      skus: products.length,
      activeSkus: active.length,
      pricedActiveShare: Math.round(pricedActiveShare * 10) / 10,
      leadSamples: lead.length,
      hiddenOutflowShare: hiddenOutflowShare == null ? null : Math.round(hiddenOutflowShare * 10) / 10,
      pairs: pairByPack.size,
      explodedBoms: explodeParents.size,
      excluded: skipped.excluded,
      onRequest: skipped.onRequest,
    },
    notes,
  };
}
