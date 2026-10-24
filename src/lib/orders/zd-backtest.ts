/**
 * Backtest automatu ZD dla jednego dostawcy (ekran /zakupy/automat → Backtest). Czyste funkcje, bez I/O —
 * dane przygotowuje `src/lib/data/zd-backtest-run.ts`.
 *
 * Każda decyzja liczy ilość tak, jak nocny przebieg (`stock-watch/worker` → `runZdOrderEngine` → lista „Do ZD”),
 * tymi samymi funkcjami:
 * - okno sprzedaży = dni zapasu dostawcy (jak Kreator i nocny przebieg), sprzedaż widziana przez system
 *   = to, co zeszło ze stanu w symulacji (nie popyt, którego nie było czym obsłużyć),
 * - korekta za dni braku (`computeStockoutSalesFactor`, dni robocze, poranny stan ≤ 0; bez par i kompletów),
 * - strategia max30_90: sprzedaż pod prośby odjęta, tempo = max(okno, 90 d), cel `effectiveDniZapasu`
 *   (cykl + czas dostawy + 25%, minimum dni celu),
 * - podążanie za sprzedażą (`computeSalesTrackedCel`, preset mocy z ustawień) i cięcia z historii ZD
 *   (`applyZdEstimateHistoryCuts`), minimum stanów i `computeManualOrderQty`, opakowania (`computeZdPackOrderQty`),
 * - czas dostawy w dniu decyzji z próbek znanych tego dnia (dostarczonych wcześniej), wybranych i liczonych
 *   jak horyzont (`selectSamplesForStats` → `quantilesFromSampleRows` → `resolveZdOrderHorizon.automatLeadDays`),
 * - decyzje w dni robocze (weekend / święto → najbliższy dzień roboczy).
 *
 * Zamówienia klientów (FS z ZK wystawionym wcześniej): rezerwacja widoczna od dnia ZK (dostępne = stan − rezerwacje,
 * jak silnik), stan trzymany dla zamówienia, a gdy go brakuje — klient czeka na dostawę (opóźnienie, nie utracona marża).
 *
 * Popyt: sprzedaż z Subiekta bez sprzedaży pod prośby (ta idzie z dostaw pod klienta, nie z zapasu) + dopisany
 * popyt z tygodni, gdy towaru naprawdę nie było (bez tego automat „nie widzi” sprzedaży utraconej przez braki
 * i wypada zbyt dobrze). Braki i zapas symulacji liczone dziennie (koniec dnia), żeby tygodniowe zdjęcie
 * nie trafiało zawsze w tę samą fazę cyklu zamówień.
 */
import { calculateBusinessDate, formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { quantilesFromSampleRows, selectSamplesForStats, type DeliveryStatsSampleRow } from "@/lib/orders/delivery-stats-samples";
import { effectiveDniZapasu, sales90FromProfile } from "@/lib/orders/zd-demand-policy";
import type { ZdSalesTrackPolicy } from "@/lib/orders/zd-estimate-boost-presets";
import { applyZdEstimateHistoryCuts } from "@/lib/orders/zd-estimate-history-track";
import { computeManualOrderQty } from "@/lib/orders/zd-estimate-manual";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";
import { computeSalesTrackedCel } from "@/lib/orders/zd-estimate-sales-track";
import {
  normalizePackagingDocumentUnitMode,
  normalizeUnitsPerPackage,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";
import { resolveZdOrderHorizon, businessToCalendarDays } from "@/lib/orders/zd-order-horizon";
import { computeStockoutSalesFactor, stockoutMetaExcludingProsba } from "@/lib/stock-watch/stock-history";
import type { StatsMode } from "@/types/database";

const DAY_MS = 86_400_000;
export const addDaysKey = (key: string, days: number) =>
  new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const dayIndex = (simStart: string, key: string) =>
  Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${simStart}T12:00:00Z`)) / DAY_MS);

/** Okno profilu do podłogi tempa (3 × 30 d) — jak `sales90FromProfile`. */
const FLOOR_DAYS = 90;
/** Okno profilu (podłoga = trzy ostatnie, prośby odejmowane w każdym osobno). */
const PROFILE_WINDOW_DAYS = 30;
/** Prośba sprzedana do tylu dni po dostawie (jak `loadDeliveredProsbaPiecesByTwId`). */
export const ZD_BACKTEST_PROSBA_SALE_DAYS = 14;
/** Roczny koszt utrzymania zapasu (kapitał, magazyn, przeterminowanie) — do kosztu w rekomendacji. */
export const ZD_BACKTEST_HOLDING_RATE = 0.2;
/** Dopisany popyt z tygodni braku najwyżej tyle × sprzedaż (jak `ZD_STOCKOUT_ADJUST.maxFactor`). */
const IMPUTE_MAX_FACTOR = 2;
/** Min. dni ze stanem, żeby szacować tempo do dopisania. */
const IMPUTE_MIN_IN_STOCK_DAYS = 28;

export type ZdBacktestPack = { unitsPerPackage: number; documentUnitMode: ZdPackagingDocumentUnitMode | null; orderMultiple: number | null };

export type ZdBacktestProduct = {
  id: number;
  /** Cena magazynowa za sztukę (wycena zapasu); null = towar pominięty w symulacji. */
  cost: number | null;
  /** Marża za sztukę (zysk ÷ ilość z raportu sprzedaży) — koszt braku; null = nieznana (0 zł). */
  margin?: number | null;
  /** Sprzedaż w 182 dniach przed startem — liczy się do braków. */
  active: boolean;
  pack: ZdBacktestPack | null;
  /** Minimum stanów w sztukach (Kreator) — cel nie niższy. */
  minStock?: number;
  /** Para paczka↔sztuka albo składnik kompletu — silnik nie stosuje korekty dni braku. */
  composite?: boolean;
};

/** Próbka czasu dostawy w kształcie `delivery_stats_samples` (wybór i kwantyle jak horyzont). */
export type ZdBacktestLeadSample = Pick<
  DeliveryStatsSampleRow,
  "placement_date" | "delivery_date" | "business_days_full" | "business_days_first" | "order_type" | "source"
>;

/** Linia sprzedaży: [data FS/PA/WZ, ilość, data ZK — gdy sprzedaż z zamówienia klienta wystawionego wcześniej]. */
export type ZdBacktestSale = readonly [string, number] | readonly [string, number, string];

export type ZdBacktestInput = {
  /** Pierwszy dzień symulacji (stan startowy = zdjęcie z dnia poprzedniego). */
  simStart: string;
  days: number;
  /** Okno sprzedaży Kreatora = dni zapasu dostawcy. */
  windowDays: number;
  products: ZdBacktestProduct[];
  /** Popyt na zapas w sztukach: [data, ilość, data ZK?] — sprzedaż bez prośb, także sprzed startu (okna). */
  demand: ReadonlyMap<number, ReadonlyArray<ZdBacktestSale>>;
  /** Sprzedaż pod prośby (nie z zapasu) — system ją widzi w oknie i sam odejmuje. */
  prosba?: ReadonlyMap<number, ReadonlyArray<readonly [string, number]>>;
  /** Tygodniowe zdjęcia stanu (remanent) okresu, od najstarszego; pierwsze = stan startowy. */
  snapshots: ReadonlyArray<{ day: string; qty: ReadonlyMap<number, number> }>;
  /** Zdjęcia sprzed startu (na dni braku w pierwszym oknie). */
  historySnapshots?: ReadonlyArray<{ day: string; qty: ReadonlyMap<number, number> }>;
  lead: ReadonlyArray<ZdBacktestLeadSample>;
  statsMode?: StatsMode;
  /** Podążanie za sprzedażą jak w Kreatorze; null = wyłączone. */
  trackPolicy?: ZdSalesTrackPolicy | null;
  /** Dopisz popyt z tygodni braku (domyślnie tak). */
  imputeLostDemand?: boolean;
};

export type ZdBacktestPolicy =
  /** Kreator dziś: cel = sprzedaż z okna × dni zapasu dostawcy, zamawiane co `cycleDays` (rytm dostawcy). */
  | { kind: "kreator"; days: number; cycleDays: number }
  /** Automat max30_90; `arrival` = kiedy przychodzi towar: z pierwszą dostawą albo dopiero z ostatnią. */
  | { kind: "automat"; targetDays: number; cycleDays: number; arrival: "first" | "full" };

export type ZdBacktestMetrics = {
  /** % dni-towarów (aktywnych) z zerowym stanem na koniec dnia. */
  zeroShare: number | null;
  /** Obsłużony popyt wartościowo (%). */
  servedShare: number | null;
  /** Średnia wartość zapasu (zł). */
  avgStock: number;
  orders: number;
  medianOrder: number;
  /** Utracona marża na brakach (zł). */
  lostMargin: number;
  /** Koszt roku: utracona marża + utrzymanie średniego zapasu. */
  cost: number;
  /** Kwartały: % zera i średni zapas. */
  quarters: Array<{ zeroShare: number | null; avgStock: number }>;
  /** Zamówienia klientów (ZK): sztuki, ile wydanych po terminie i średnie opóźnienie (dni) tych spóźnionych. */
  zk: { qty: number; lateQty: number; avgDelayDays: number | null };
  /** Szczegół per towar (opcja `detail`). */
  byProduct?: ZdBacktestProductDetail[];
};

export type ZdBacktestProductDetail = {
  id: number;
  /** Dni bez stanu (koniec dnia). */
  zeroDays: number;
  lostMargin: number;
  /** Niesprzedane sztuki. */
  lostQty: number;
  demandQty: number;
  avgStock: number;
  orders: number;
};

const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
export const nearestRank = (sorted: readonly number[], p: number) =>
  sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]! : null;

const statsRows = (lead: ReadonlyArray<ZdBacktestLeadSample>): DeliveryStatsSampleRow[] =>
  lead.map((s) => ({ ...s, supplier_id: "s", order_id: null, is_teeth: false }));

/** Czas dostawy (dni kalendarzowe) w dniu decyzji jak `automatLeadDays` — tylko z dostaw znanych tego dnia. */
export function zdBacktestLeadDays(lead: ReadonlyArray<ZdBacktestLeadSample>, dayKey: string, statsMode: StatsMode = "LACZNIE"): number {
  const now = new Date(`${dayKey}T12:00:00Z`);
  const known = statsRows(lead).filter((s) => s.delivery_date < dayKey);
  const q = quantilesFromSampleRows(selectSamplesForStats(known, now), "Glowne", statsMode, { now });
  return resolveZdOrderHorizon({
    todayKey: dayKey,
    stockDays: 30,
    onDemand: true,
    nextOrderDate: null,
    interval: null,
    lead: { p50: q.p50, p90: q.p90, nOrders: q.nOrders, p90FirstReceipt: q.firstReceiptP90 },
  }).automatLeadDays;
}

/** Kiedy przyjechałoby zamówienie złożone w `dayKey`: czas prawdziwego zamówienia złożonego najbliżej tej daty. */
export function zdBacktestRealizedLead(
  lead: ReadonlyArray<ZdBacktestLeadSample>,
  dayKey: string,
  which: "first" | "full",
  statsMode: StatsMode = "LACZNIE"
): number {
  const usable = lead.filter((s) => s.source !== "import" && (statsMode === "LACZNIE" || s.order_type === "Glowne"));
  // Jak `selectSamplesForStats`: próbki z Subiekta, gdy są; inne źródła tylko bez nich.
  const pool = usable.some((s) => s.source === "subiekt") ? usable.filter((s) => s.source === "subiekt") : usable;
  if (!pool.length) return 7;
  const t = Date.parse(dayKey);
  let best = pool[0]!;
  let bestD = Infinity;
  for (const s of pool) {
    const d = Math.abs(Date.parse(s.placement_date) - t);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  const full = best.business_days_full;
  const bd = which === "first" ? Math.min(full, best.business_days_first ?? full) : full;
  return Math.max(1, businessToCalendarDays(dayKey, bd));
}

/**
 * Sztuki, które przyjadą przy zamówieniu `pieces` — jak lista „Do ZD” (`resolveOrderQtyForLine`): pełne paczki
 * (tryb packages: 1 jednostka ZD = N sztuk), wielokrotność sztuk (pieces_multiple) albo wielokrotność paczek.
 */
export function zdBacktestPackPieces(pieces: number, pack: ZdBacktestPack | null): number {
  if (!(pieces > 1e-9)) return 0;
  return computeZdPackOrderQty(
    pieces,
    normalizeUnitsPerPackage(pack?.unitsPerPackage),
    "op.",
    normalizePackagingDocumentUnitMode(pack?.documentUnitMode),
    pack?.orderMultiple ?? null
  ).piecesArriving;
}

const isWeekday = (key: string) => {
  const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6;
};
/** Najbliższy dzień roboczy (weekendy i święta) od `key` włącznie. */
const businessOnOrAfter = (key: string) => formatDateString(calculateBusinessDate(parseDateOnly(key)!, 0));

type ProductPrep = {
  p: ZdBacktestProduct & { cost: number };
  /** Popyt „z półki” w dniach symulacji (z dopisanym) — bez zapasu stracony. */
  demand: Float64Array;
  /** Zamówienia klientów w okresie: widoczne od zkT, wydanie najwcześniej fsT. */
  zk: Array<{ zkT: number; fsT: number; qty: number }>;
  /** Nowy towar (bez sprzedaży i stanu na starcie): pierwsza dostawa jak naprawdę — wprowadzenie ręczne, nie automat. */
  intro: { t: number; qty: number } | null;
  /** Sprzedaż widziana przed startem (bez prośb), indeks i = t + H. */
  pre: Float64Array;
  /** Sprzedaż pod prośby, indeks i = t + H. */
  prosba: Float64Array;
  /** Dni braku przed startem z remanentów: 1 = brak, 0 = stan, -1 = nieznane. */
  preOut: Int8Array;
  imputed: number;
};

type Prep = {
  H: number;
  D: number;
  weekday: Uint8Array;
  products: ProductPrep[];
  imputedValue: number;
  netSalesValue: number;
  leadCache: Map<string, number>;
  realizedCache: Map<string, number>;
};

const prepCache = new WeakMap<ZdBacktestInput, Prep>();

/** Stan z ostatniego zdjęcia ≤ dzień i następnego — tydzień braku, gdy oba ≤ 0. */
function outFromSnapshots(snaps: ReadonlyArray<{ day: string; qty: ReadonlyMap<number, number> }>, id: number, key: string): -1 | 0 | 1 {
  let prev: number | null = null;
  let next: number | null = null;
  for (const s of snaps) {
    if (s.day <= key) prev = s.qty.get(id) ?? 0;
    else {
      next = s.qty.get(id) ?? 0;
      break;
    }
  }
  if (prev == null || next == null) return -1;
  return prev <= 0 && next <= 0 ? 1 : 0;
}

function prepare(input: ZdBacktestInput): Prep {
  const cached = prepCache.get(input);
  if (cached) return cached;
  const D = input.days;
  const W = Math.max(1, Math.round(input.windowDays));
  const H = Math.max(W, FLOOR_DAYS) + 1;
  const keyAt = (i: number) => addDaysKey(input.simStart, i - H);
  const weekday = new Uint8Array(H + D);
  for (let i = 0; i < H + D; i++) weekday[i] = isWeekday(keyAt(i)) ? 1 : 0;
  const snaps = input.snapshots;
  const hist = [...(input.historySnapshots ?? []), ...snaps.slice(0, 1)];
  const products: ProductPrep[] = [];
  let imputedValue = 0;
  let netSalesValue = 0;
  for (const p of input.products) {
    if (p.cost == null) continue;
    const demand = new Float64Array(D);
    const pre = new Float64Array(H + D);
    const prosba = new Float64Array(H + D);
    const zk: ProductPrep["zk"] = [];
    const sales = new Float64Array(D); // cała sprzedaż w okresie (z półki + ZK) — do tygodni braku
    for (const line of input.demand.get(p.id) ?? []) {
      const [k, v] = line;
      if (!(v > 0)) continue;
      const t = dayIndex(input.simStart, k);
      if (t >= 0 && t < D) {
        sales[t] += v;
        const zkDay = line[2];
        if (zkDay && zkDay < k) zk.push({ zkT: Math.max(0, dayIndex(input.simStart, zkDay)), fsT: t, qty: v });
        else demand[t] += v;
      } else if (t < 0 && t >= -H) pre[t + H] += v;
    }
    zk.sort((a, b) => a.zkT - b.zkT || a.fsT - b.fsT);
    for (const [k, v] of input.prosba?.get(p.id) ?? []) {
      const i = dayIndex(input.simStart, k) + H;
      if (v > 0 && i >= 0 && i < H + D) prosba[i] += v;
    }
    const preOut = new Int8Array(H).fill(-1);
    if (hist.length > 1) for (let i = 0; i < H; i++) preOut[i] = outFromSnapshots(hist, p.id, keyAt(i));
    const sold = demand.reduce((a, b) => a + b, 0);
    netSalesValue += sales.reduce((a, b) => a + b, 0) * p.cost;

    // Tygodnie, w których towaru naprawdę nie było (zdjęcie ≤ 0 na obu końcach, zero sprzedaży), a towar
    // sprzedawał się przed i po przerwie: popyt = tempo z tygodni ze stanem. Bez tego automat nie widzi
    // sprzedaży utraconej przez braki.
    let imputed = 0;
    if (input.imputeLostDemand !== false && p.active && snaps.length > 2) {
      const gaps: Array<[number, number]> = [];
      let inStockDays = 0;
      for (let s = 0; s + 1 < snaps.length; s++) {
        const a = Math.max(0, dayIndex(input.simStart, snaps[s]!.day) + 1);
        const b = Math.min(D - 1, dayIndex(input.simStart, snaps[s + 1]!.day));
        if (b < a) continue;
        let inGap = 0;
        for (let t = a; t <= b; t++) inGap += sales[t]!;
        const out = (snaps[s]!.qty.get(p.id) ?? 0) <= 0 && (snaps[s + 1]!.qty.get(p.id) ?? 0) <= 0 && inGap === 0;
        if (out) gaps.push([a, b]);
        else inStockDays += b - a + 1;
      }
      if (gaps.length && inStockDays >= IMPUTE_MIN_IN_STOCK_DAYS && sold > 0) {
        const rate = sold / inStockDays;
        const firstSale = (() => {
          for (let i = 0; i < H; i++) if (pre[i]! > 0) return i - H;
          for (let t = 0; t < D; t++) if (sales[t]! > 0) return t;
          return Infinity;
        })();
        let lastSale = -Infinity;
        for (let t = D - 1; t >= 0; t--)
          if (sales[t]! > 0) {
            lastSale = t;
            break;
          }
        const add = new Float64Array(D);
        for (const [a, b] of gaps) {
          if (!(firstSale < a && lastSale > b)) continue; // wycofany / wprowadzony w trakcie — bez dopisywania
          for (let t = a; t <= b; t++) add[t] = rate;
        }
        const total = add.reduce((x, y) => x + y, 0);
        const scale = total > sold * (IMPUTE_MAX_FACTOR - 1) ? (sold * (IMPUTE_MAX_FACTOR - 1)) / total : 1;
        for (let t = 0; t < D; t++) demand[t] += add[t]! * scale;
        imputed = total * scale;
        imputedValue += imputed * p.cost;
      }
    }
    // Towar wprowadzony w trakcie roku: automat nie zna sprzedaży towaru, którego nie było — pierwszą dostawę
    // (stan z pierwszego niezerowego zdjęcia + sprzedaż z tego tygodnia) bierzemy z rzeczywistości.
    let intro: ProductPrep["intro"] = null;
    if (!p.active && (snaps[0]?.qty.get(p.id) ?? 0) <= 0) {
      for (let s = 1; s < snaps.length; s++) {
        const q = snaps[s]!.qty.get(p.id) ?? 0;
        if (q <= 0) continue;
        const a = Math.max(0, dayIndex(input.simStart, snaps[s - 1]!.day) + 1);
        const b = Math.min(D - 1, dayIndex(input.simStart, snaps[s]!.day));
        let sold = 0;
        for (let t = a; t <= b; t++) sold += sales[t]!;
        intro = { t: a, qty: q + sold };
        break;
      }
    }
    products.push({ p: p as ZdBacktestProduct & { cost: number }, demand, zk, intro, pre, prosba, preOut, imputed });
  }
  const prep: Prep = { H, D, weekday, products, imputedValue, netSalesValue, leadCache: new Map(), realizedCache: new Map() };
  prepCache.set(input, prep);
  return prep;
}

/** Popyt dopisany za tygodnie braku — % sprzedaży wartościowo. */
export function zdBacktestImputedShare(input: ZdBacktestInput): number | null {
  const prep = prepare(input);
  return pct(prep.imputedValue, prep.netSalesValue);
}

/**
 * Jedna decyzja jak nocny przebieg, w kolejności silnika: korekta dni braku (bez prośb) → strategia: prośby
 * odjęte, podłoga 90 d (prośby odjęte z każdego z trzech okien 30 d profilu) → cel = tempo × dni zapasu →
 * podążanie za sprzedażą → cięcia z historii ZD → minimum stanów i `computeManualOrderQty` (sztuki, przed opakowaniem).
 */
export function zdBacktestDecideOrder(a: {
  strategy: "classic" | "max30_90";
  /** Okno sprzedaży (dni zapasu dostawcy). */
  windowDays: number;
  /** Dni zapasu w celu (strategia: `effectiveDniZapasu`). */
  dniZapasu: number;
  /** Sprzedaż z zapasu w oknie (bez prośb). */
  seenWindow: number;
  /** Sprzedaż pod prośby w oknie. */
  prosbaWindow: number;
  /** Trzy okna 30 d profilu do podłogi (od najstarszego): cała sprzedaż (z prośbami) i sprzedaż pod prośby. */
  floorGross: readonly number[];
  floorProsba: readonly number[];
  /** Dni robocze okna z historią stanu; null = bez korekty (para, komplet). */
  stockout: { windowDays: number; recordedDays: number; outDays: number } | null;
  /** Stan − rezerwacje. */
  dostepne: number;
  onOrder: number;
  trackPolicy: ZdSalesTrackPolicy | null;
  lastOrder: { qty: number; linkedAt: string } | null;
  nowMs: number;
  minStock: number;
}): { rate: number; cel: number; celTracked: number; pieces: number } {
  const W = Math.max(1, a.windowDays);
  let gross = a.seenWindow + a.prosbaWindow;
  if (a.stockout && gross > 0) {
    const meta = computeStockoutSalesFactor(a.stockout);
    const eff = meta ? stockoutMetaExcludingProsba(meta, gross, a.prosbaWindow) : null;
    if (eff) gross *= eff.factor;
  }
  let rate: number;
  let sales: number;
  if (a.strategy === "max30_90") {
    const prosba = Math.min(gross, a.prosbaWindow);
    sales = Math.max(0, gross - prosba);
    const sales90 = sales90FromProfile(a.floorGross, a.floorProsba) ?? 0;
    rate = Math.max(sales / W, sales90 / FLOOR_DAYS);
    sales = rate * W;
  } else {
    sales = gross;
    rate = gross / W;
  }
  const cel = rate * a.dniZapasu;
  let celTracked = a.trackPolicy
    ? computeSalesTrackedCel({
        celZapasu: cel,
        sprzedazOkres: sales,
        sprzedazDziennie: rate,
        dostepne: a.dostepne,
        otwarteZd: a.onOrder,
        dniZapasu: a.dniZapasu,
        dniOkresu: W,
        policy: a.trackPolicy,
      }).celTracked
    : cel;
  if (a.trackPolicy && a.lastOrder) {
    celTracked = applyZdEstimateHistoryCuts({
      celTracked,
      celBase: cel,
      sprzedazOkres: sales,
      sprzedazDziennie: rate,
      coverStock: a.dostepne + a.onOrder,
      dniZapasu: a.dniZapasu,
      dniOkresu: W,
      lastOrderedQty: a.lastOrder.qty,
      linkedAt: a.lastOrder.linkedAt,
      nowMs: a.nowMs,
    }).celTracked;
  }
  const pieces = computeManualOrderQty({ celZapasu: celTracked, dostepne: a.dostepne, otwarteZd: a.onOrder, minStockSzt: a.minStock });
  return { rate, cel, celTracked, pieces };
}

export function simulateZdBacktest(input: ZdBacktestInput, policy: ZdBacktestPolicy, options: { detail?: boolean } = {}): ZdBacktestMetrics {
  const prep = prepare(input);
  const { H, D, weekday } = prep;
  const W = Math.max(1, Math.round(input.windowDays));
  const R = Math.max(1, Math.round(policy.cycleDays));
  const statsMode = input.statsMode ?? "LACZNIE";
  const automat = policy.kind === "automat";

  // Decyzje: co R dni od startu, przesunięte na najbliższy dzień roboczy.
  const decisions = new Map<number, { dni: number; arrive: number; key: string }>();
  for (let t0 = 0; t0 < D; t0 += R) {
    const key = businessOnOrAfter(addDaysKey(input.simStart, t0));
    const t = dayIndex(input.simStart, key);
    if (t >= D || decisions.has(t)) continue;
    const which = automat ? policy.arrival : "first";
    const rk = `${key}|${which}`;
    let realized = prep.realizedCache.get(rk);
    if (realized == null) {
      realized = zdBacktestRealizedLead(input.lead, key, which, statsMode);
      prep.realizedCache.set(rk, realized);
    }
    let dni = Math.max(1, Math.round(policy.kind === "kreator" ? policy.days : 0));
    if (automat) {
      let lead = prep.leadCache.get(key);
      if (lead == null) {
        lead = zdBacktestLeadDays(input.lead, key, statsMode);
        prep.leadCache.set(key, lead);
      }
      dni = effectiveDniZapasu({ strategy: "max30_90", targetDays: policy.targetDays, cycleDays: R }, W, { leadDays: lead, nextOrderDays: 0 });
    }
    decisions.set(t, { dni, arrive: t + realized, key });
  }

  const q = () => ({ dV: 0, sV: 0, zero: 0, n: 0, stockV: 0, lost: 0 });
  const tot = q();
  const quarters = [q(), q(), q(), q()];
  const orders = new Map<number, number>();
  const byProduct: ZdBacktestProductDetail[] = [];
  const zkTot = { qty: 0, lateQty: 0, delayQtyDays: 0 };

  for (const pp of prep.products) {
    const det = { id: pp.p.id, zeroDays: 0, lostMargin: 0, lostQty: 0, demandQty: 0, avgStock: 0, orders: 0 };
    const { p } = pp;
    const margin = Math.max(0, p.margin ?? 0);
    // Sprzedaż widziana przez system (bez prośb): przed startem z Subiekta, w symulacji to, co zeszło ze stanu.
    const seen = new Float64Array(H + D);
    seen.set(pp.pre.subarray(0, H));
    const cumSeen = new Float64Array(H + D + 1);
    for (let i = 0; i < H; i++) cumSeen[i + 1] = cumSeen[i]! + seen[i]!;
    const cumProsba = new Float64Array(H + D + 1);
    for (let i = 0; i < H + D; i++) cumProsba[i + 1] = cumProsba[i]! + pp.prosba[i]!;
    // Poranny stan ≤ 0 (dzień roboczy) — historia dni braku; przed startem z remanentów.
    const out = new Int8Array(H + D);
    out.set(pp.preOut.subarray(0, H));
    const sum = (arr: Float64Array, a: number, b: number) => arr[Math.max(0, b)]! - arr[Math.max(0, a)]!;
    // Początki okien podłogi (dni przed decyzją), od najstarszego: [i-90, i-60), [i-60, i-30), [i-30, i).
    const floorStarts = [FLOOR_DAYS, FLOOR_DAYS - PROFILE_WINDOW_DAYS, PROFILE_WINDOW_DAYS];

    let stock = Math.max(0, input.snapshots[0]?.qty.get(p.id) ?? 0);
    const pipe = new Map<number, number>();
    let lastOrder: { qty: number; key: string } | null = null;
    // Zamówienia klientów: otwarte (zarezerwowane) od dnia ZK, przydział stanu FIFO, wydanie gdy pełne i nie przed FS.
    const open: Array<{ qty: number; alloc: number; fsT: number }> = [];
    let zkNext = 0;
    let allocated = 0;

    for (let t = 0; t < D; t++) {
      const i = t + H;
      out[i] = stock <= 0 ? 1 : 0;
      stock += pipe.get(t) ?? 0;
      pipe.delete(t);
      if (pp.intro?.t === t) stock += pp.intro.qty;
      while (zkNext < pp.zk.length && pp.zk[zkNext]!.zkT <= t) {
        const z = pp.zk[zkNext++]!;
        open.push({ qty: z.qty, alloc: 0, fsT: z.fsT });
      }
      for (const o of open) {
        const free = stock - allocated;
        if (free <= 1e-9) break;
        const take = Math.min(free, o.qty - o.alloc);
        o.alloc += take;
        allocated += take;
      }

      const dec = decisions.get(t);
      if (dec) {
        const onOrder = [...pipe.values()].reduce((a, b) => a + b, 0);
        // Jak silnik: dostępne = stan − rezerwacje (może być ujemne — dług rezerwacji zwiększa zamówienie).
        const dostepne = stock - open.reduce((a, o) => a + o.qty, 0);
        // Okno [i - W, i): sprzedaż z dni przed decyzją (nocny przebieg po zamknięciu dnia).
        let stockout: { windowDays: number; recordedDays: number; outDays: number } | null = null;
        if (!p.composite) {
          stockout = { windowDays: 0, recordedDays: 0, outDays: 0 };
          for (let k = i - W; k < i; k++) {
            if (!weekday[k]) continue;
            stockout.windowDays++;
            if (out[k]! < 0) continue;
            stockout.recordedDays++;
            if (out[k] === 1) stockout.outDays++;
          }
        }
        const { pieces } = zdBacktestDecideOrder({
          strategy: automat ? "max30_90" : "classic",
          windowDays: W,
          dniZapasu: dec.dni,
          seenWindow: sum(cumSeen, i - W, i),
          prosbaWindow: sum(cumProsba, i - W, i),
          floorGross: floorStarts.map((st) => sum(cumSeen, i - st, i - st + PROFILE_WINDOW_DAYS) + sum(cumProsba, i - st, i - st + PROFILE_WINDOW_DAYS)),
          floorProsba: floorStarts.map((st) => sum(cumProsba, i - st, i - st + PROFILE_WINDOW_DAYS)),
          stockout,
          dostepne,
          onOrder,
          trackPolicy: input.trackPolicy ?? null,
          lastOrder: lastOrder ? { qty: lastOrder.qty, linkedAt: `${lastOrder.key}T12:00:00Z` } : null,
          nowMs: Date.parse(`${dec.key}T12:00:00Z`),
          minStock: p.minStock ?? 0,
        });
        const qty = zdBacktestPackPieces(pieces, p.pack);
        if (qty > 0) {
          pipe.set(dec.arrive, (pipe.get(dec.arrive) ?? 0) + qty);
          orders.set(t, (orders.get(t) ?? 0) + qty * p.cost);
          lastOrder = { qty, key: dec.key };
          det.orders++;
        }
      }

      // Wydanie zamówień klientów: pełny przydział, nie przed datą FS.
      let zkSold = 0;
      let zkDue = 0;
      for (let k = open.length - 1; k >= 0; k--) {
        const o = open[k]!;
        if (o.fsT === t) zkDue += o.qty;
        if (t < o.fsT || o.alloc < o.qty - 1e-9) continue;
        stock -= o.qty;
        allocated -= o.qty;
        zkSold += o.qty;
        zkTot.qty += o.qty;
        if (t > o.fsT) {
          zkTot.lateQty += o.qty;
          zkTot.delayQtyDays += (t - o.fsT) * o.qty;
        }
        open.splice(k, 1);
      }
      const d = pp.demand[t]!;
      const served = Math.min(Math.max(0, stock - allocated), d);
      stock -= served;
      seen[i] = served + zkSold;
      cumSeen[i + 1] = cumSeen[i]! + served + zkSold;
      det.demandQty += d + zkDue;
      det.lostQty += d - served;
      det.lostMargin += (d - served) * margin;
      det.avgStock += (stock * p.cost) / D;
      if (stock <= 1e-9) det.zeroDays++;
      const qq = quarters[Math.min(3, Math.floor((t / D) * 4))]!;
      for (const o of [tot, qq]) {
        o.dV += (d + zkDue) * p.cost;
        o.sV += (served + zkSold) * p.cost;
        o.stockV += stock * p.cost;
        o.lost += (d - served) * margin;
        if (p.active) {
          o.n++;
          if (stock <= 1e-9) o.zero++;
        }
      }
    }
    if (options.detail) byProduct.push(det);
  }
  const ov = [...orders.values()].sort((a, b) => a - b);
  const avgStock = tot.stockV / D;
  return {
    zeroShare: pct(tot.zero, tot.n),
    servedShare: pct(tot.sV, tot.dV),
    avgStock,
    orders: orders.size,
    medianOrder: ov.length ? ov[Math.floor(ov.length / 2)]! : 0,
    lostMargin: tot.lost,
    cost: tot.lost + avgStock * ZD_BACKTEST_HOLDING_RATE * (D / 365),
    zk: { qty: zkTot.qty, lateQty: zkTot.lateQty, avgDelayDays: zkTot.lateQty > 0 ? zkTot.delayQtyDays / zkTot.lateQty : null },
    quarters: quarters.map((o) => ({ zeroShare: pct(o.zero, o.n), avgStock: o.stockV / (D / 4) })),
    ...(options.detail ? { byProduct } : {}),
  };
}

export type ZdBacktestReality = {
  zeroShare: number | null;
  avgStock: number;
  /** Marża utracona w tygodniach braku (z dopisanego popytu). */
  lostMargin: number;
  cost: number;
  quarters: Array<{ zeroShare: number | null }>;
};

/** Co było naprawdę: tygodniowe zdjęcia stanu z tego samego okresu. */
export function zdBacktestReality(input: ZdBacktestInput): ZdBacktestReality {
  const prep = prepare(input);
  let zero = 0;
  let n = 0;
  let value = 0;
  const qz = [0, 0, 0, 0];
  const qn = [0, 0, 0, 0];
  const snaps = input.snapshots;
  for (const pp of prep.products) {
    const p = pp.p;
    for (const s of snaps) {
      const v = s.qty.get(p.id) ?? 0;
      value += (v * p.cost) / Math.max(1, snaps.length);
      if (p.active) {
        const k = Math.min(3, Math.max(0, Math.floor((dayIndex(input.simStart, s.day) / input.days) * 4)));
        n++;
        qn[k]!++;
        if (v <= 0) {
          zero++;
          qz[k]!++;
        }
      }
    }
  }
  const lostMargin = prep.products.reduce((a, pp) => a + pp.imputed * Math.max(0, pp.p.margin ?? 0), 0);
  return {
    zeroShare: pct(zero, n),
    avgStock: value,
    lostMargin,
    cost: lostMargin + value * ZD_BACKTEST_HOLDING_RATE * (input.days / 365),
    quarters: qz.map((z, k) => ({ zeroShare: pct(z, qn[k]!) })),
  };
}

/** Rozchód ze stanu bez dokumentu sprzedaży (kompletacja, przeliczenia paczek, RW) — % wartości sprzedaży. */
export function zdBacktestHiddenOutflowShare(input: ZdBacktestInput): number | null {
  let hidden = 0;
  let sold = 0;
  const snaps = input.snapshots;
  for (const p of input.products) {
    if (p.cost == null) continue;
    const lines = [...(input.demand.get(p.id) ?? []), ...(input.prosba?.get(p.id) ?? [])];
    for (let i = 0; i + 1 < snaps.length; i++) {
      const a = snaps[i]!;
      const b = snaps[i + 1]!;
      let s = 0;
      for (const [k, v] of lines) if (k > a.day && k <= b.day && v > 0) s += v;
      const rec = (b.qty.get(p.id) ?? 0) - (a.qty.get(p.id) ?? 0) + s;
      sold += s * p.cost;
      if (rec < 0) hidden += -rec * p.cost;
    }
  }
  return pct(hidden, sold);
}

/**
 * Sprzedaż pod prośby: zrealizowana prośba (data dostawy, sztuki) zabiera sprzedaż towaru z 14 dni od dostawy,
 * od najwcześniejszej. Zwraca popyt na zapas (reszta) i sprzedaż pod prośby.
 */
export function zdBacktestSplitProsbaSales(
  sales: ReadonlyArray<ZdBacktestSale>,
  prosby: ReadonlyArray<readonly [string, number]>
): { stock: ZdBacktestSale[]; prosba: Array<readonly [string, number]> } {
  const left = [...sales]
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((l) => [l[0], l[1], l[2]] as [string, number, string | undefined]);
  const taken = new Map<string, number>();
  for (const [day, qty] of [...prosby].sort((a, b) => a[0].localeCompare(b[0]))) {
    let need = qty;
    const until = addDaysKey(day, ZD_BACKTEST_PROSBA_SALE_DAYS);
    for (const line of left) {
      if (need <= 0) break;
      if (line[0] < day || line[0] > until || line[1] <= 0) continue;
      const take = Math.min(line[1], need);
      line[1] -= take;
      need -= take;
      taken.set(line[0], (taken.get(line[0]) ?? 0) + take);
    }
  }
  return {
    stock: left.filter(([, v]) => v > 1e-9).map(([d, v, z]): ZdBacktestSale => (z ? [d, v, z] : [d, v])),
    prosba: [...taken].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

export type ZdBacktestVerdictKind = "works" | "tradeoff" | "fails" | "insufficient";

export type ZdBacktestVerdict = {
  kind: ZdBacktestVerdictKind;
  headline: string;
  /** Zdania uzasadnienia, od najważniejszego. */
  reasons: string[];
};

/** Zapas może być wyższy niż w rzeczywistości najwyżej o tyle, żeby schemat „działał”. */
export const ZD_BACKTEST_STOCK_TOLERANCE = 1.1;
/** Wariant pesymistyczny (towar dopiero z ostatnią dostawą) może mieć najwyżej tyle pp braków więcej niż rzeczywistość. */
export const ZD_BACKTEST_PESSIMISTIC_PP = 1;
/** Kwartał „trzyma”, gdy braki nie większe niż naprawdę w tym kwartale + tyle pp. */
export const ZD_BACKTEST_QUARTER_PP = 0.5;

const fmtPct = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")}%`;
const fmtChange = (now: number, base: number) => {
  if (!(base > 0)) return null;
  const c = Math.round(((now - base) / base) * 100);
  return c;
};

/** W ilu kwartałach braki symulacji nie przekraczają rzeczywistości (+0,5 pp). */
export function zdBacktestStableQuarters(m: Pick<ZdBacktestMetrics, "quarters">, reality: Pick<ZdBacktestReality, "quarters">): number {
  return m.quarters.filter((q, k) => {
    const r = reality.quarters[k]?.zeroShare;
    return q.zeroShare != null && r != null && q.zeroShare <= r + ZD_BACKTEST_QUARTER_PP;
  }).length;
}

export function zdBacktestVerdict(input: {
  reality: { zeroShare: number | null; avgStock: number };
  automat: ZdBacktestMetrics;
  pessimistic: ZdBacktestMetrics;
  quality: { activeSkus: number; pricedActiveShare: number; leadSamples: number };
}): ZdBacktestVerdict {
  const { reality, automat, pessimistic, quality } = input;
  const missing: string[] = [];
  if (quality.activeSkus < 5) missing.push(`tylko ${quality.activeSkus} towarów ze sprzedażą w pół roku przed okresem`);
  if (quality.pricedActiveShare < 80) missing.push(`cena magazynowa tylko dla ${fmtPct(quality.pricedActiveShare)} aktywnych towarów`);
  if (quality.leadSamples < 5) missing.push(`tylko ${quality.leadSamples} zmierzonych dostaw (czas dostawy przyjęty 7 dni)`);
  if (missing.length || reality.zeroShare == null || automat.zeroShare == null || !(reality.avgStock > 0)) {
    return {
      kind: "insufficient",
      headline: "Za mało danych na werdykt",
      reasons: missing.length ? missing : ["brak stanów albo sprzedaży w okresie backtestu"],
    };
  }
  const zeroBetter = automat.zeroShare <= reality.zeroShare;
  const stockOk = automat.avgStock <= reality.avgStock * ZD_BACKTEST_STOCK_TOLERANCE;
  const pessimisticOk = (pessimistic.zeroShare ?? Infinity) <= reality.zeroShare + ZD_BACKTEST_PESSIMISTIC_PP;
  const zeroChange = fmtChange(automat.zeroShare, reality.zeroShare);
  const stockChange = fmtChange(automat.avgStock, reality.avgStock);
  const zeroText =
    zeroChange == null
      ? `braki ${fmtPct(automat.zeroShare)} (dziś ${fmtPct(reality.zeroShare)})`
      : zeroChange <= 0
        ? `o ${Math.abs(zeroChange)}% mniej braków`
        : `o ${zeroChange}% więcej braków`;
  const stockText = stockChange == null ? "" : stockChange <= 0 ? `o ${Math.abs(stockChange)}% mniej zapasu` : `o ${stockChange}% więcej zapasu`;
  const both = [zeroText, stockText].filter(Boolean).join(" i ");
  const pessText = `Gdyby towar przychodził dopiero z ostatnią dostawą: braki ${fmtPct(pessimistic.zeroShare ?? 0)} (dziś ${fmtPct(reality.zeroShare)}).`;
  if (zeroBetter && stockOk && pessimisticOk) {
    return { kind: "works", headline: `Schemat działa: ${both} niż było naprawdę`, reasons: [pessText] };
  }
  if (zeroBetter && !stockOk) {
    return {
      kind: "tradeoff",
      headline: `Mniej braków kosztem zapasu: ${both}`,
      reasons: ["Krótszy cel dni albo dłuższy cykl może obniżyć zapas — porównaj warianty.", pessText],
    };
  }
  if (zeroBetter && stockOk && !pessimisticOk) {
    return {
      kind: "tradeoff",
      headline: `Działa przy zwykłych dostawach: ${both}`,
      reasons: [`Wrażliwe na opóźnienia dostawcy. ${pessText}`],
    };
  }
  if (!zeroBetter && stockChange != null && stockChange < 0 && automat.zeroShare - reality.zeroShare <= 2) {
    return {
      kind: "tradeoff",
      headline: `Mniej zapasu, trochę więcej braków: ${both}`,
      reasons: ["Dłuższy cel dni poprawi dostępność — porównaj warianty.", pessText],
    };
  }
  return { kind: "fails", headline: `Schemat nie poprawia wyniku: ${both}`, reasons: [pessText] };
}

export const ZD_BACKTEST_GRID_TARGETS = [15, 20, 25, 30, 35, 40, 45, 50, 60] as const;
export const ZD_BACKTEST_GRID_CYCLES = [7, 14, 21] as const;

export type ZdBacktestGridPoint = {
  targetDays: number;
  cycleDays: number;
  zeroShare: number | null;
  avgStock: number;
  orders: number;
  medianOrder: number;
  lostMargin: number;
  cost: number;
  /** Kwartały, w których braki nie większe niż naprawdę (+0,5 pp). */
  stableQuarters: number;
  /** Spełnia „działa” (braki ≤ dziś, zapas ≤ dziś + 10%, opóźnione dostawy ≤ dziś + 1 pp). */
  works: boolean;
  /** Braki ≤ dziś i zapas ≤ dziś + 10% (bez warunku opóźnionych dostaw). */
  fits?: boolean;
};

/**
 * Skąd rekomendacja: działa we wszystkim → najniższy koszt; inaczej najniższy koszt wśród ustawień, które
 * spełniają braki i zapas, ale są wrażliwe na opóźnienia; inaczej mniej braków niż dziś za cenę zapasu;
 * inaczej najniższy koszt w ogóle.
 */
export type ZdBacktestRecommendationTier = "works" | "delay_sensitive" | "more_stock" | "lowest_cost";

/**
 * Siatka ustawień automatu i rekomendacja: wśród ustawień, które „działają” (najlepiej we wszystkich
 * kwartałach, co najmniej w trzech), najniższy koszt roku = utracona marża na brakach + 20% średniego zapasu;
 * gdy żadne nie działa — najmniej braków. Wariant pesymistyczny tylko dla kandydatów po dwóch pierwszych warunkach.
 */
export function zdBacktestGrid(
  input: ZdBacktestInput,
  reality: ZdBacktestReality,
  options: { targets?: readonly number[]; cycles?: readonly number[] } = {}
): { grid: ZdBacktestGridPoint[]; recommended: (ZdBacktestGridPoint & { tier: ZdBacktestRecommendationTier }) | null } {
  const grid: ZdBacktestGridPoint[] = [];
  for (const cycleDays of options.cycles ?? ZD_BACKTEST_GRID_CYCLES) {
    for (const targetDays of options.targets ?? ZD_BACKTEST_GRID_TARGETS) {
      const m = simulateZdBacktest(input, { kind: "automat", targetDays, cycleDays, arrival: "first" });
      let works = false;
      const fits =
        reality.zeroShare != null && m.zeroShare != null && m.zeroShare <= reality.zeroShare && m.avgStock <= reality.avgStock * ZD_BACKTEST_STOCK_TOLERANCE;
      if (fits && reality.zeroShare != null) {
        const p = simulateZdBacktest(input, { kind: "automat", targetDays, cycleDays, arrival: "full" });
        works = (p.zeroShare ?? Infinity) <= reality.zeroShare + ZD_BACKTEST_PESSIMISTIC_PP;
      }
      grid.push({
        targetDays,
        cycleDays,
        zeroShare: m.zeroShare,
        avgStock: m.avgStock,
        orders: m.orders,
        medianOrder: m.medianOrder,
        lostMargin: m.lostMargin,
        cost: m.cost,
        stableQuarters: zdBacktestStableQuarters(m, reality),
        works,
        fits,
      });
    }
  }
  const byCost = (a: ZdBacktestGridPoint, b: ZdBacktestGridPoint) => a.cost - b.cost || a.avgStock - b.avgStock || b.cycleDays - a.cycleDays;
  const pick = (points: ZdBacktestGridPoint[]) => {
    const best = Math.max(0, ...points.map((g) => g.stableQuarters));
    return points.filter((g) => g.stableQuarters >= Math.min(best, 3)).sort(byCost)[0] ?? null;
  };
  const r0 = reality.zeroShare;
  const tiers: Array<[ZdBacktestRecommendationTier, ZdBacktestGridPoint[]]> = [
    ["works", grid.filter((g) => g.works)],
    ["delay_sensitive", grid.filter((g) => g.fits)],
    ["more_stock", grid.filter((g) => r0 != null && g.zeroShare != null && g.zeroShare <= r0)],
    ["lowest_cost", grid],
  ];
  for (const [tier, points] of tiers) {
    const g = pick(points);
    if (g) return { grid, recommended: { ...g, tier } };
  }
  return { grid, recommended: null };
}
