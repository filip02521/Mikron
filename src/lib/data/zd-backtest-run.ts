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
import { fetchZdEstimateMinStock } from "@/lib/data/zd-estimate-min-stock";
import { minStockRowsToMap, withPairMinStock } from "@/lib/orders/zd-estimate-min-stock-lookup";
import { fetchZdBoostPowerPreset } from "@/lib/data/zd-estimate-boost-preset";
import { boostPresetDef, policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { isPlnCurrency } from "@/lib/orders/zd-proposal-minimum-notice";
import { loadSubiektLeadRowsBySupplier } from "@/lib/data/subiekt-automat-lead";
import type { StatsMode } from "@/types/database";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import {
  addDaysKey,
  simulateZdBacktest,
  zdBacktestHiddenOutflowShare,
  zdBacktestImputedShare,
  zdBacktestReality,
  zdBacktestGrid,
  zdBacktestSplitProsbaSales,
  zdBacktestStableQuarters,
  zdBacktestVerdict,
  ZD_BACKTEST_HOLDING_RATE,
  ZD_BACKTEST_ORDER_COST,
  ZD_BACKTEST_PROSBA_SALE_DAYS,
  type ZdBacktestGridPoint,
  type ZdBacktestInput,
  type ZdBacktestLeadSample,
  type ZdBacktestMetrics,
  type ZdBacktestPack,
  type ZdBacktestProduct,
  type ZdBacktestReality,
  type ZdBacktestRecommendationTier,
  type ZdBacktestSale,
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
  /** 2: silnik 1:1 z nocnym przebiegiem (okno dni zapasu, korekta braków, prośby, podążanie, minimum), koszt w rekomendacji. */
  version: 1 | 2;
  period: { from: string; to: string };
  params: ZdBacktestParams;
  reality: { zeroShare: number | null; avgStock: number; cycleDays: number } & Partial<Omit<ZdBacktestReality, "zeroShare" | "avgStock">>;
  variants: ZdBacktestVariant[];
  /** Ustawienia modelu (v2). */
  model?: {
    windowDays: number;
    holdingRate: number;
    trackPreset: string | null;
    statsMode: StatsMode;
    automatStableQuarters: number;
    /** v3: koszt jednego ZD w koszcie roku, minimum i próg dostawcy (zł), stany dzienne. */
    orderCost?: number;
    minOrderValue?: number | null;
    freeShippingThreshold?: number | null;
    dailyStock?: boolean;
  };
  verdict: ZdBacktestVerdict;
  /** Siatka ustawień (cel × cykl) i rekomendacja: najmniejszy zapas wśród działających, inaczej najmniej braków. */
  grid: ZdBacktestGridPoint[];
  recommended: (ZdBacktestGridPoint & { sameAsParams: boolean; tier?: ZdBacktestRecommendationTier }) | null;
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
    /** v2: popyt dopisany za tygodnie braku (% sprzedaży wartościowo). */
    imputedShare?: number | null;
    /** v2: sprzedaż pod prośby wyłączona z popytu na zapas (% sprzedaży wartościowo). */
    prosbaShare?: number | null;
    /** v2: towary z minimum stanów. */
    minStockSkus?: number;
    /** v2: % aktywnych z marżą (koszt braku). */
    marginActiveShare?: number;
    /** v2: sprzedaż z zamówień klientów (FS z wcześniejszego ZK) — % sprzedaży wartościowo. */
    zkShare?: number | null;
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

/** Najwyżej tyle przebiegów naraz (każdy pyta Subiekt kilkoma zapytaniami równolegle). */
const MAX_RUNNING = 3;

/** Nowy przebieg; null = ten dostawca już się liczy, "busy" = liczy się już MAX_RUNNING przebiegów. */
export async function createZdBacktestRun(input: { supplierId: string; params: ZdBacktestParams; userId: string | null }): Promise<string | null | "busy"> {
  // Przebieg starszy niż blokada uznajemy za porzucony (restart serwera w trakcie).
  const busy = await query<{ n: string }>(
    `SELECT count(*) AS n FROM zd_backtest_runs WHERE status IN ('queued', 'running') AND created_at > now() - make_interval(secs => $1)`,
    [LOCK_TTL_SEC]
  );
  if (Number(busy.rows[0]?.n ?? 0) >= MAX_RUNNING) return "busy";
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
  const { input, ctx } = await loadZdBacktestData(supplierId, onProgress);
  return evaluateZdBacktest(input, ctx, params);
}

/** Wszystko, czego ocena potrzebuje poza wejściem symulacji. */
export type ZdBacktestContext = {
  simStart: string;
  simEnd: string;
  kreatorDays: number;
  supplierCycle: number;
  statsMode: StatsMode;
  trackPreset: string;
  names: Map<number, string>;
  pairs: number;
  explodedBoms: number;
  skipped: { excluded: number; onRequest: number };
};

/** Dane dostawcy z Subiekta i OnTime → wejście symulacji (tylko odczyt). */
export async function loadZdBacktestData(
  supplierId: string,
  onProgress: (p: ZdBacktestProgress) => Promise<void> = async () => undefined
): Promise<{ input: ZdBacktestInput; ctx: ZdBacktestContext }> {
  const resolved = resolveSubiektOrdersConfig();
  if (!resolved.ok) throw new Error(resolved.message);
  const cfg = resolved.config;
  const supRes = await query<{
    name: string;
    interval_weeks: string | null;
    stock_raw: string | null;
    stock: unknown;
    stats_mode: string | null;
    min_order_value: string | null;
    min_order_currency: string | null;
    free_shipping_threshold: string | null;
  }>(
    `SELECT name, interval_weeks, stock_raw, stock, stats_mode, min_order_value, min_order_currency,
            to_jsonb(s.*) ->> 'free_shipping_threshold' AS free_shipping_threshold
       FROM suppliers s WHERE id = $1`,
    [supplierId]
  );
  const sup = supRes.rows[0];
  if (!sup) throw new Error("Nie ma takiego dostawcy.");
  const statsMode: StatsMode = sup.stats_mode === "OSOBNO" ? "OSOBNO" : "LACZNIE";
  const scopes = await listZdEstimateSupplierScopesFor(supplierId);
  if (!scopes.length) throw new Error("Dostawca nie ma zakresu (grupy/cechy) w Kreatorze ZD.");

  // Okno sprzedaży i dni zapasu jak nocny przebieg (`supplierStockDays` w stock-watch/worker).
  const kreatorDays = (() => {
    const d = stockPeriodToDniZapasu(sup.stock_raw, sup.stock != null ? Number(sup.stock) : null);
    return d != null && d > 0 ? d : DEFAULT_DNI_ZAPASU;
  })();
  const today = todayDateKeyInWarsaw();
  const simEnd = addDaysKey(today, -1);
  const simStart = addDaysKey(simEnd, -(SIM_DAYS - 1));
  // Historia: okno sprzedaży / 90 d przed pierwszą decyzją i „aktywny” = sprzedaż w pół roku przed startem.
  const historyDays = Math.max(HISTORY_BEFORE_DAYS, Math.max(kreatorDays, 90) + ZD_BACKTEST_PROSBA_SALE_DAYS + 7);
  const salesFrom = addDaysKey(simStart, -historyDays);

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
  const [exclusions, onRequests, teeth, pairsAll, minStockRows, boostPreset] = await Promise.all([
    fetchZdEstimateExclusions(),
    fetchZdEstimateOnRequests(),
    fetchTeethProductTwIdSet().catch(() => new Set<number>()),
    query<{ pack_tw_id: number; piece_tw_id: number }>(`SELECT pack_tw_id, piece_tw_id FROM zd_product_pairs`).then((r) =>
      r.rows.map((x) => ({ packTwId: Number(x.pack_tw_id), pieceTwId: Number(x.piece_tw_id) }))
    ),
    fetchZdEstimateMinStock(),
    fetchZdBoostPowerPreset(),
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
  const bomComponents = new Set(bomRes.rows.map((r) => Number(r.component)));
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

  const packRes = await query<{ tw: number; units: number; mode: string | null; mult: number | null }>(
    `SELECT subiekt_tw_id AS tw, units_per_package AS units, document_unit_mode AS mode, order_multiple AS mult
       FROM zd_estimate_packaging WHERE subiekt_tw_id = ANY($1::int[])`,
    [[...ids]]
  );
  const pack = new Map<number, ZdBacktestPack>(
    packRes.rows.map((r) => [
      Number(r.tw),
      { unitsPerPackage: Number(r.units), documentUnitMode: r.mode === "pieces_multiple" ? "pieces_multiple" : "packages", orderMultiple: r.mult },
    ])
  );

  const sales = new Map<number, ZdBacktestSale[]>();
  const fsIdsOfLine = new Map<number, Array<number | null>>();
  let done = 0;
  const all = [...salesIds];
  await onProgress({ phase: "sales", done: 0, total: all.length });
  await mapPool(all, CONCURRENCY, async (tw) => {
    const docs = await paged(cfg, SUBIEKT_PATHS.ordersZdEstimateTowar(tw), { dataOd: salesFrom, dataDo: simEnd }, (j) => (j as { data?: { dokumenty?: Array<Record<string, unknown>> } }).data?.dokumenty ?? []);
    const lines: ZdBacktestSale[] = [];
    const fsIds: Array<number | null> = [];
    for (const d of docs) {
      if (d.wSkladnik !== "sprzedazOkres") continue;
      const day = String(d.dok_DataWyst ?? "").slice(0, 10);
      const qty = Number(d.ob_Ilosc);
      if (!(/^\d{4}-\d{2}-\d{2}$/.test(day) && qty > 0)) continue;
      lines.push([day, qty]);
      fsIds.push(d.rola === "fs" && day >= simStart ? Math.trunc(Number(d.dok_Id)) || null : null);
    }
    sales.set(tw, lines);
    fsIdsOfLine.set(tw, fsIds);
    done++;
    if (done % 20 === 0 || done === all.length) await onProgress({ phase: "sales", done, total: all.length });
  });

  // Zamówienia klientów: FS wystawiona z ZK (`dok_DoDokId`) wcześniejszego niż FS — klient czekał na towar, a
  // rezerwacja była widoczna od dnia ZK. Lista FS z okresu, po miesiącu (API zwraca najwyżej 200 wierszy na stronę).
  const zkDayByFs = new Map<number, string>();
  {
    const months: Array<[string, string]> = [];
    for (let m = simStart.slice(0, 7); m <= simEnd.slice(0, 7); ) {
      const from = m === simStart.slice(0, 7) ? simStart : `${m}-01`;
      const next = addDaysKey(`${m}-28`, 4).slice(0, 7);
      const to = next > simEnd.slice(0, 7) ? simEnd : addDaysKey(`${next}-01`, -1);
      months.push([from, to]);
      m = next;
    }
    await mapPool(months, CONCURRENCY, async ([from, to]) => {
      const docs = await paged(cfg, SUBIEKT_PATHS.documentsFs, { dataOd: from, dataDo: to }, (j) => (j as { data?: Array<Record<string, unknown>> }).data ?? []);
      for (const d of docs) {
        const fsDay = String(d.dok_DataWyst ?? "").slice(0, 10);
        const zkDay = String(d.dok_DoDokDataWyst ?? "").slice(0, 10);
        const nr = String(d.dok_DoDokNrPelny ?? "");
        if (/^ZK/.test(nr) && /^\d{4}-\d{2}-\d{2}$/.test(zkDay) && zkDay < fsDay) zkDayByFs.set(Math.trunc(Number(d.dok_Id)), zkDay);
      }
    });
    for (const [tw, lines] of sales) {
      const ids = fsIdsOfLine.get(tw) ?? [];
      sales.set(
        tw,
        lines.map((l, k) => {
          const zk = ids[k] != null ? zkDayByFs.get(ids[k]!) : undefined;
          return zk ? [l[0], l[1], zk] : l;
        })
      );
    }
  }

  // Sprzedaż pod prośby (zrealizowane prośby) — z dostaw pod klienta, nie z zapasu. Jak silnik: tylko towary
  // w sztukach, poza parami i kompletami (tam prośba jest w innych jednostkach niż sprzedaż karty).
  const prosbaEligible = [...ids].filter(
    (id) => !pairByPack.has(id) && !bomComponents.has(id) && !explodeParents.has(id) && !((pack.get(id)?.unitsPerPackage ?? 1) > 1)
  );
  const prosbyByTw = new Map<number, Array<[string, number]>>();
  if (prosbaEligible.length) {
    const pr = await query<{ tw: number; day: string; status: string; quantity: string | null; delivered_quantity: string | null }>(
      `SELECT subiekt_tw_id AS tw, to_char((delivery_at AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS day,
              status, quantity, delivered_quantity
         FROM individual_orders
        WHERE subiekt_tw_id = ANY($1::int[])
          AND status IN ('Zrealizowane', 'Czesciowo_zrealizowane')
          AND delivery_at IS NOT NULL
          AND (delivery_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN $2::date AND $3::date`,
      [prosbaEligible, addDaysKey(salesFrom, -ZD_BACKTEST_PROSBA_SALE_DAYS), simEnd]
    );
    for (const r of pr.rows) {
      const qty =
        parseOrderQuantity(r.delivered_quantity ?? "") ?? (r.status === "Zrealizowane" ? parseOrderQuantity(r.quantity ?? "") : null) ?? 0;
      if (!(qty > 0)) continue;
      const list = prosbyByTw.get(Number(r.tw)) ?? [];
      list.push([r.day, qty]);
      prosbyByTw.set(Number(r.tw), list);
    }
  }
  const prosba = new Map<number, Array<readonly [string, number]>>();
  const demand = new Map<number, ZdBacktestSale[]>();
  const scaled = (l: ZdBacktestSale, f: number): ZdBacktestSale => (l[2] ? [l[0], l[1] * f, l[2]] : [l[0], l[1] * f]);
  for (const id of ids) {
    if (explodeParents.has(id)) continue;
    const own = sales.get(id) ?? [];
    const pr = prosbyByTw.get(id);
    if (pr?.length) {
      const split = zdBacktestSplitProsbaSales(own, pr);
      demand.set(id, split.stock);
      if (split.prosba.length) prosba.set(id, split.prosba);
    } else demand.set(id, [...own]);
  }
  for (const [packId, { piece, units }] of pairByPack) {
    demand.set(packId, [
      ...(sales.get(packId) ?? []).map((l) => scaled(l, units)),
      ...(sales.get(piece) ?? []),
    ]);
  }
  for (const r of bomRes.rows) {
    const list = demand.get(Number(r.component));
    if (!list) continue;
    for (const l of sales.get(Number(r.parent)) ?? []) list.push(scaled(l, Number(r.qty) || 1));
  }

  // Stany dzienne (remanent na każdy dzień): okres + historia na dni braku w pierwszym oknie. Przy dostawcach
  // zamawianych kilka razy w tygodniu tygodniowe zdjęcie gubi braki z dni pomiędzy.
  const historyFrom = addDaysKey(simStart, -(Math.max(kreatorDays, 90) + 2));
  const allDates: string[] = [];
  for (let d = historyFrom; d <= simEnd; d = addDaysKey(d, 1)) allDates.push(d);
  const dates = allDates.filter((d) => d >= addDaysKey(simStart, -1));
  await onProgress({ phase: "stock", done: 0, total: allDates.length });
  const snapshotsAll: Array<{ day: string; qty: Map<number, number>; price: Map<number, number> }> = [];
  let stockDone = 0;
  await mapPool(allDates, CONCURRENCY, async (day) => {
    const qty = new Map<number, number>();
    const price = new Map<number, number>();
    for (const s of scopes) {
      const rows = await paged(cfg, SUBIEKT_PATHS.productsRemanent, { ...scopeParam(s), naDzien: day }, (j) => (j as { data?: { pozycje?: Array<{ tw_Id: number; ilosc: number; cenaMag: number }> } }).data?.pozycje ?? []);
      for (const r of rows) {
        const tw = Math.trunc(Number(r.tw_Id));
        qty.set(tw, (qty.get(tw) ?? 0) + (Number(r.ilosc) || 0));
        if (Number(r.cenaMag) > 0 && !price.has(tw)) price.set(tw, Number(r.cenaMag));
      }
    }
    snapshotsAll.push({ day, qty, price });
    stockDone++;
    if (stockDone % 20 === 0 || stockDone === allDates.length) await onProgress({ phase: "stock", done: stockDone, total: allDates.length });
  });
  snapshotsAll.sort((a, b) => a.day.localeCompare(b.day));
  // Wycena: pierwsza cena magazynowa w okresie (jak wcześniej, od najstarszego dnia).
  const cost = new Map<number, number>();
  for (const sn of snapshotsAll) {
    if (sn.day < dates[0]!) continue;
    for (const [tw, c] of sn.price) if (!cost.has(tw)) cost.set(tw, c);
  }

  const pieceCost = new Map<number, number>();
  for (const [packId, { piece, units }] of pairByPack) {
    for (const s of snapshotsAll) s.qty.set(packId, (s.qty.get(packId) ?? 0) * units + (s.qty.get(piece) ?? 0));
    const c = cost.get(piece) ?? (cost.has(packId) ? cost.get(packId)! / units : undefined);
    if (c != null) pieceCost.set(packId, c);
  }
  const historySnapshots = snapshotsAll.filter((s) => s.day < dates[0]!);
  const snapshots = snapshotsAll.filter((s) => s.day >= dates[0]!);

  // Towar, którego cały okres nie było na stanie, nie ma ceny w remanencie — bez niej wypadłby z porównania
  // (a to właśnie towary z brakami). Zapasowo koszt sprzedaży ÷ ilość z raportu asortymentowego. Z tego
  // samego raportu marża za sztukę (koszt braku).
  const margin = new Map<number, number>();
  const asort = new Map<number, { qty: number; zysk: number }>();
  for (const s of scopes) {
    const rows = await paged(cfg, "/reports/sprzedaz/asortyment", { ...scopeParam(s), dataOd: salesFrom, dataDo: simEnd, zDetalem: true }, (j) =>
      ((j as { data?: { items?: Array<{ towarId: number; ilosc: number; koszt: number; zysk?: number }> } }).data?.items ?? [])
    );
    for (const r of rows) {
      const tw = Math.trunc(Number(r.towarId));
      if (!cost.has(tw) && Number(r.ilosc) > 0 && Number(r.koszt) > 0) cost.set(tw, Number(r.koszt) / Number(r.ilosc));
      if (!asort.has(tw) && Number(r.ilosc) > 0) asort.set(tw, { qty: Number(r.ilosc), zysk: Number(r.zysk) || 0 });
    }
  }
  for (const [tw, a] of asort) margin.set(tw, Math.max(0, a.zysk / a.qty));
  // Para: wycena, marża i zamówienie w sztukach karty paczki (cena sztuki, paczka = przelicznik sztuk).
  for (const [packId, { piece, units }] of pairByPack) {
    const c = pieceCost.get(packId) ?? cost.get(piece) ?? (cost.has(packId) ? cost.get(packId)! / units : undefined);
    if (c != null) cost.set(packId, c);
    const a = asort.get(packId);
    const b = asort.get(piece);
    const q = (a?.qty ?? 0) * units + (b?.qty ?? 0);
    if (q > 0) margin.set(packId, Math.max(0, ((a?.zysk ?? 0) + (b?.zysk ?? 0)) / q));
  }

  await onProgress({ phase: "simulate", done: 0, total: 1 });
  const leadRes = await query<ZdBacktestLeadSample>(
    `SELECT to_char(placement_date, 'YYYY-MM-DD') AS placement_date, to_char(delivery_date, 'YYYY-MM-DD') AS delivery_date,
            business_days_full, business_days_first, order_type, source
       FROM delivery_stats_samples
      WHERE supplier_id = $1 AND deleted_at IS NULL AND NOT is_teeth`,
    [supplierId]
  );
  // Dostawca „OSOBNO”: automat liczy czas dostawy ze wszystkich ZD → FZ z Subiekta (jak `loadZdOrderHorizons`).
  const osobnoRows = statsMode === "OSOBNO" ? (await loadSubiektLeadRowsBySupplier([supplierId])).get(supplierId) ?? [] : [];
  const lead: ZdBacktestLeadSample[] = osobnoRows.length
    ? osobnoRows
    : leadRes.rows.map((r) => ({
        ...r,
        business_days_full: Number(r.business_days_full),
        business_days_first: r.business_days_first == null ? null : Number(r.business_days_first),
      }));
  const leadStatsMode: StatsMode = osobnoRows.length ? "LACZNIE" : statsMode;
  const minStock = withPairMinStock(minStockRowsToMap(minStockRows), [...pairByPack].map(([packTwId, v]) => ({ packTwId, pieceTwId: v.piece })));
  const activeFrom = addDaysKey(simStart, -182);
  const products: ZdBacktestProduct[] = [...demand.keys()].map((id) => ({
    id,
    cost: cost.get(id) ?? null,
    margin: margin.get(id) ?? null,
    // „Aktywny” po całej sprzedaży (z prośbami) — towar sprzedawany tylko pod prośby i tak jest w ofercie.
    active: [...(demand.get(id) ?? []), ...(prosba.get(id) ?? [])].some(([d]) => d >= activeFrom && d < simStart),
    pack: pairByPack.has(id)
      ? { unitsPerPackage: pairByPack.get(id)!.units, documentUnitMode: "packages", orderMultiple: pack.get(id)?.orderMultiple ?? null }
      : (pack.get(id) ?? null),
    minStock: minStock.get(id) ?? 0,
    composite: pairByPack.has(id) || bomComponents.has(id),
  }));
  const trackPolicy = policyForBoostPreset(boostPreset);
  // Minimum i próg jak `applyZdProposalMinimum`: minimum tylko w zł; klasy ABC do dopełnienia.
  const minValue = Number(sup.min_order_value) > 0 ? Number(sup.min_order_value) : null;
  const minPln = minValue != null && isPlnCurrency(sup.min_order_currency);
  const orderTerms = {
    minOrderValue: minPln ? minValue : null,
    freeShippingThreshold: Number(sup.free_shipping_threshold) > 0 ? Number(sup.free_shipping_threshold) : null,
  };
  const abcRes = await query<{ tw: number; abc: "A" | "B" | "C" }>(
    `SELECT subiekt_tw_id AS tw, coalesce(override_abc, abc) AS abc FROM zd_sku_class WHERE subiekt_tw_id = ANY($1::int[])`,
    [products.map((p) => p.id)]
  ).catch(() => ({ rows: [] as Array<{ tw: number; abc: "A" | "B" | "C" }> }));
  const abcByTw = new Map(abcRes.rows.map((r) => [Number(r.tw), r.abc]));
  for (const p of products) p.abc = abcByTw.get(p.id) ?? null;
  const input: ZdBacktestInput = {
    simStart,
    days: SIM_DAYS,
    windowDays: kreatorDays,
    products,
    demand,
    prosba,
    snapshots,
    historySnapshots,
    lead,
    statsMode: leadStatsMode,
    trackPolicy,
    orderTerms,
  };
  const ctx: ZdBacktestContext = {
    simStart,
    simEnd,
    kreatorDays,
    supplierCycle: Math.max(1, Math.round((Number(sup.interval_weeks) || 1) * 7)),
    statsMode,
    trackPreset: boostPresetDef(boostPreset).label,
    names: new Map(names.map((n) => [n.tw_Id, n.tw_Nazwa])),
    pairs: pairByPack.size,
    explodedBoms: explodeParents.size,
    skipped,
  };
  return { input, ctx };
}

/** Warianty, siatka, werdykt i jakość danych — czyste liczenie na wejściu z `loadZdBacktestData`. */
export function evaluateZdBacktest(input: ZdBacktestInput, ctx: ZdBacktestContext, params: ZdBacktestParams): ZdBacktestResult {
  const { simStart, simEnd, kreatorDays, supplierCycle, statsMode } = ctx;
  const { products, lead } = input;
  const prosba = input.prosba ?? new Map<number, ReadonlyArray<readonly [string, number]>>();
  const demand = input.demand;
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
  const marginActiveShare = active.length ? (100 * active.filter((p) => p.margin != null && p.margin > 0).length) / active.length : 0;
  const hiddenOutflowShare = zdBacktestHiddenOutflowShare(input);
  const imputedShare = zdBacktestImputedShare(input);
  const zkShare = (() => {
    let zv = 0;
    let all = 0;
    for (const p of products) {
      if (p.cost == null) continue;
      for (const l of demand.get(p.id) ?? []) {
        if (l[0] < simStart) continue;
        all += l[1] * p.cost;
        if (l[2]) zv += l[1] * p.cost;
      }
    }
    return all > 0 ? (100 * zv) / all : null;
  })();
  const prosbaShare = (() => {
    let pv = 0;
    let all = 0;
    for (const p of products) {
      if (p.cost == null) continue;
      const inPeriod = (lines: ReadonlyArray<ZdBacktestSale> | undefined) =>
        (lines ?? []).reduce((a, [d, q]) => (d >= simStart ? a + q : a), 0);
      const pq = inPeriod(prosba.get(p.id));
      pv += pq * p.cost;
      all += (pq + inPeriod(demand.get(p.id))) * p.cost;
    }
    return all > 0 ? (100 * pv) / all : null;
  })();
  const verdict = zdBacktestVerdict({
    reality,
    automat: variants[1]!.metrics,
    pessimistic: variants[2]!.metrics,
    quality: { activeSkus: active.length, pricedActiveShare, leadSamples: lead.filter((l) => l.source !== "import").length },
  });
  const notes: string[] = [];
  if (hiddenOutflowShare != null && hiddenOutflowShare >= 10) {
    notes.push(
      `${Math.round(hiddenOutflowShare)}% wartości sprzedaży znika ze stanu bez dokumentu sprzedaży (kompletacja, rozbijanie kartonów, RW). Backtest nie liczy tego jako popytu — wynik może być zbyt optymistyczny.`
    );
  }
  if (imputedShare != null && imputedShare >= 1) {
    notes.push(
      `W tygodniach, gdy towaru nie było, dopisano popyt ${Math.round(imputedShare)}% sprzedaży (tempo z tygodni ze stanem) — automat musi go obsłużyć, „naprawdę” go stracono.`
    );
  }
  if (marginActiveShare < 80) notes.push(`Marża znana tylko dla ${Math.round(marginActiveShare)}% aktywnych towarów — koszt braków w rekomendacji jest zaniżony.`);
  if (ctx.pairs) notes.push(`${ctx.pairs} par paczka ↔ sztuka liczonych razem w sztukach, jak w silniku.`);
  if (ctx.explodedBoms) notes.push(`${ctx.explodedBoms} kompletów rozpisanych na składniki — ich sprzedaż doliczona do składników.`);

  const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
  return {
    version: 2,
    period: { from: simStart, to: simEnd },
    params,
    reality: { ...reality, cycleDays: supplierCycle },
    variants,
    verdict,
    grid,
    recommended: recommended
      ? { ...recommended, sameAsParams: recommended.targetDays === params.targetDays && recommended.cycleDays === params.cycleDays }
      : null,
    model: {
      windowDays: kreatorDays,
      holdingRate: ZD_BACKTEST_HOLDING_RATE,
      trackPreset: ctx.trackPreset,
      statsMode,
      automatStableQuarters: zdBacktestStableQuarters(variants[1]!.metrics, reality),
      orderCost: ZD_BACKTEST_ORDER_COST,
      minOrderValue: input.orderTerms?.minOrderValue ?? null,
      freeShippingThreshold: input.orderTerms?.freeShippingThreshold ?? null,
      dailyStock: input.snapshots.length > 300,
    },
    quality: {
      skus: products.length,
      activeSkus: active.length,
      pricedActiveShare: Math.round(pricedActiveShare * 10) / 10,
      leadSamples: lead.filter((l) => l.source !== "import").length,
      hiddenOutflowShare: round1(hiddenOutflowShare),
      pairs: ctx.pairs,
      explodedBoms: ctx.explodedBoms,
      excluded: ctx.skipped.excluded,
      onRequest: ctx.skipped.onRequest,
      imputedShare: round1(imputedShare),
      prosbaShare: round1(prosbaShare),
      zkShare: round1(zkShare),
      minStockSkus: products.filter((p) => (p.minStock ?? 0) > 0).length,
      marginActiveShare: Math.round(marginActiveShare * 10) / 10,
    },
    notes,
  };
}
