/**
 * Backtest automatu ZD dla jednego dostawcy (ekran /zakupy/automat → Backtest). Czyste funkcje, bez I/O —
 * dane przygotowuje `src/lib/data/zd-backtest-run.ts`.
 *
 * Każda decyzja liczy ilość tak, jak nocny przebieg (`stock-watch/worker` → `runZdOrderEngine` → lista „Do ZD”),
 * tymi samymi funkcjami:
 * - okno sprzedaży = dni zapasu dostawcy (jak Kreator i nocny przebieg), sprzedaż widziana przez system
 *   = to, co zeszło ze stanu w symulacji (nie popyt, którego nie było czym obsłużyć),
 * - korekta za dni braku (`computeStockoutSalesFactor`, dni robocze, poranny stan ≤ 0; bez par i kompletów),
 * - strategia max30_90: sprzedaż pod prośby odjęta, jednorazowy skok jak typowy miesiąc (profil 12 × 30 d),
 *   tempo = max(okno, 90 d), cel `effectiveDniZapasu` (cykl + czas dostawy + 25%, minimum dni celu),
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
import { effectiveDniZapasu } from "@/lib/orders/zd-demand-policy";
import type { ZdSalesTrackPolicy } from "@/lib/orders/zd-estimate-boost-presets";
import { applyZdEstimateHistoryCuts } from "@/lib/orders/zd-estimate-history-track";
import { computeManualOrderQty } from "@/lib/orders/zd-estimate-manual";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";
import { computeSalesTrackedCel } from "@/lib/orders/zd-estimate-sales-track";
import { resolveZdSalesProfile, sales90CappedFromProfile, ZD_SALES_PROFILE } from "@/lib/orders/zd-sales-profile";
import {
  normalizePackagingDocumentUnitMode,
  normalizeUnitsPerPackage,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";
import { resolveZdOrderHorizon, businessToCalendarDays } from "@/lib/orders/zd-order-horizon";
import { computeStockoutSalesFactor, stockoutMetaExcludingProsba } from "@/lib/stock-watch/stock-history";
import { zdBacktestCycleText } from "@/lib/orders/zd-automat-status";
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
/** Koszt jednego ZD (obsługa, przyjęcie, wysyłka poza progiem) — bez niego częstsze zamawianie zawsze „wygrywa”. */
export const ZD_BACKTEST_ORDER_COST = 20;
/** Jak `ZD_TOP_UP_MAX_GAP_SHARE`: dopełnienie do darmowej dostawy, gdy brakuje najwyżej tyle progu. */
const ZD_TOP_UP_MAX_GAP_SHARE = 0.15;
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
  /** Klasa ABC (`zd_sku_class`, z korektą) — dopełnienie do progu tylko A/B. */
  abc?: "A" | "B" | "C" | null;
};

/** Minimum zamówienia (zł) i próg darmowej dostawy dostawcy; null = brak reguły. */
export type ZdBacktestOrderTerms = { minOrderValue: number | null; freeShippingThreshold: number | null };

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
  /** Minimum i próg dostawcy — automat odkłada / dopełnia ZD jak nocny przebieg. */
  orderTerms?: ZdBacktestOrderTerms | null;
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
  /** Koszt roku: utracona marża + utrzymanie średniego zapasu + obsługa ZD. */
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

/**
 * Dzień braku jak historia stanów silnika: poranny stan ≤ 0 = stan na koniec dnia poprzedniego. Ze stanów dziennych
 * wprost; z rzadszych zdjęć (tydzień) — brak tylko, gdy zdjęcie przed i po dniu ≤ 0.
 */
function outFromSnapshots(snaps: ReadonlyArray<{ day: string; qty: ReadonlyMap<number, number> }>, id: number, key: string): -1 | 0 | 1 {
  const before = addDaysKey(key, -1);
  let prev: { day: string; v: number } | null = null;
  let next: number | null = null;
  for (const s of snaps) {
    if (s.day <= before) prev = { day: s.day, v: s.qty.get(id) ?? 0 };
    else {
      next = s.qty.get(id) ?? 0;
      break;
    }
  }
  if (prev == null) return -1;
  if (prev.day === before) return prev.v <= 0 ? 1 : 0;
  if (next == null) return -1;
  return prev.v <= 0 && next <= 0 ? 1 : 0;
}

function prepare(input: ZdBacktestInput): Prep {
  const cached = prepCache.get(input);
  if (cached) return cached;
  const D = input.days;
  const W = Math.max(1, Math.round(input.windowDays));
  // Pełny profil 12 × 30 d przed decyzją (skok jak w silniku); starsze niż wczytana historia — zera.
  const H = Math.max(W, ZD_SALES_PROFILE.windows * PROFILE_WINDOW_DAYS) + 1;
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
  /** Wcześniejsze okna 30 d profilu (od najstarszego, przed oknami podłogi) — do rozpoznania skoku jak silnik. */
  profileHistory?: readonly number[];
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
  // Sprzedaż sprzed mnożnika braków — profil klasyfikuje skok na niej (jak silnik).
  const grossPre = gross;
  let stockoutApplied = false;
  if (a.stockout && gross > 0) {
    const meta = computeStockoutSalesFactor(a.stockout);
    const eff = meta ? stockoutMetaExcludingProsba(meta, gross, a.prosbaWindow) : null;
    if (eff) {
      gross *= eff.factor;
      stockoutApplied = true;
    }
  }
  let rate: number;
  let sales: number;
  if (a.strategy === "max30_90") {
    const profile = [...(a.profileHistory ?? []), ...a.floorGross];
    const pm = resolveZdSalesProfile({
      windows: profile,
      sprzedazOkres: grossPre,
      dniOkresu: W,
      prosbaPieces: a.prosbaWindow,
      smoothing: true,
      smoothKinds: ["spike"],
    });
    sales = gross > 0 ? gross * pm.factor : 0;
    const sales90 = sales90CappedFromProfile(profile, a.floorProsba) ?? 0;
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
        // Jak silnik: po mnożniku braków bez thin_cover / sell_through (zapasMin w backteście = 0).
        stockoutApplied,
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
  const decisions = new Map<number, { dni: number; lead: number; arrive: number; key: string }>();
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
    let lead = prep.leadCache.get(key);
    if (lead == null) {
      lead = zdBacktestLeadDays(input.lead, key, statsMode);
      prep.leadCache.set(key, lead);
    }
    const dni = automat
      ? effectiveDniZapasu({ strategy: "max30_90", targetDays: policy.targetDays, cycleDays: R }, W, { leadDays: lead, nextOrderDays: 0 })
      : Math.max(1, Math.round(policy.days));
    decisions.set(t, { dni, lead, arrive: t + realized, key });
  }

  const q = () => ({ dV: 0, sV: 0, zero: 0, n: 0, stockV: 0, lost: 0 });
  const tot = q();
  const quarters = [q(), q(), q(), q()];
  const orders = new Map<number, number>();
  const zkTot = { qty: 0, lateQty: 0, delayQtyDays: 0 };
  const sum = (arr: Float64Array, a: number, b: number) => arr[Math.max(0, b)]! - arr[Math.max(0, a)]!;
  // Początki okien podłogi (dni przed decyzją), od najstarszego: [i-90, i-60), [i-60, i-30), [i-30, i).
  const floorStarts = [FLOOR_DAYS, FLOOR_DAYS - PROFILE_WINDOW_DAYS, PROFILE_WINDOW_DAYS];
  const historyStarts = Array.from(
    { length: ZD_SALES_PROFILE.windows - floorStarts.length },
    (_, k) => (ZD_SALES_PROFILE.windows - k) * PROFILE_WINDOW_DAYS
  );

  // Stan każdego towaru; dzień po dniu dla całego dostawcy — reguły minimum i progu działają na całe ZD.
  const states = prep.products.map((pp) => {
    const seen = new Float64Array(H + D);
    seen.set(pp.pre.subarray(0, H));
    const cumSeen = new Float64Array(H + D + 1);
    for (let i = 0; i < H; i++) cumSeen[i + 1] = cumSeen[i]! + seen[i]!;
    const cumProsba = new Float64Array(H + D + 1);
    for (let i = 0; i < H + D; i++) cumProsba[i + 1] = cumProsba[i]! + pp.prosba[i]!;
    // Poranny stan ≤ 0 (dzień roboczy) — historia dni braku; przed startem z remanentów.
    const out = new Int8Array(H + D);
    out.set(pp.preOut.subarray(0, H));
    return {
      pp,
      p: pp.p,
      margin: Math.max(0, pp.p.margin ?? 0),
      seen,
      cumSeen,
      cumProsba,
      out,
      stock: Math.max(0, input.snapshots[0]?.qty.get(pp.p.id) ?? 0),
      pipe: new Map<number, number>(),
      lastOrder: null as { qty: number; key: string } | null,
      // Zamówienia klientów: otwarte (zarezerwowane) od dnia ZK, przydział stanu FIFO, wydanie gdy pełne i nie przed FS.
      open: [] as Array<{ qty: number; alloc: number; fsT: number }>,
      zkNext: 0,
      allocated: 0,
      det: { id: pp.p.id, zeroDays: 0, lostMargin: 0, lostQty: 0, demandQty: 0, avgStock: 0, orders: 0 } as ZdBacktestProductDetail,
    };
  });
  type State = (typeof states)[number];
  const terms = automat ? input.orderTerms ?? null : null;
  const hasAbc = prep.products.some((pp) => pp.p.abc != null);

  for (let t = 0; t < D; t++) {
    const i = t + H;
    for (const s of states) {
      s.out[i] = s.stock <= 0 ? 1 : 0;
      s.stock += s.pipe.get(t) ?? 0;
      s.pipe.delete(t);
      if (s.pp.intro?.t === t) s.stock += s.pp.intro.qty;
      while (s.zkNext < s.pp.zk.length && s.pp.zk[s.zkNext]!.zkT <= t) {
        const z = s.pp.zk[s.zkNext++]!;
        s.open.push({ qty: z.qty, alloc: 0, fsT: z.fsT });
      }
      for (const o of s.open) {
        const free = s.stock - s.allocated;
        if (free <= 1e-9) break;
        const take = Math.min(free, o.qty - o.alloc);
        o.alloc += take;
        s.allocated += take;
      }
    }

    const dec = decisions.get(t);
    if (dec) {
      const cand: Array<{ s: State; qty: number; rate: number; celTracked: number; position: number }> = [];
      for (const s of states) {
        const onOrder = [...s.pipe.values()].reduce((a, b) => a + b, 0);
        // Jak silnik: dostępne = stan − rezerwacje (może być ujemne — dług rezerwacji zwiększa zamówienie).
        const dostepne = s.stock - s.open.reduce((a, o) => a + o.qty, 0);
        // Okno [i - W, i): sprzedaż z dni przed decyzją (nocny przebieg po zamknięciu dnia).
        let stockout: { windowDays: number; recordedDays: number; outDays: number } | null = null;
        if (!s.p.composite) {
          stockout = { windowDays: 0, recordedDays: 0, outDays: 0 };
          for (let k = i - W; k < i; k++) {
            if (!weekday[k]) continue;
            stockout.windowDays++;
            if (s.out[k]! < 0) continue;
            stockout.recordedDays++;
            if (s.out[k] === 1) stockout.outDays++;
          }
        }
        const d = zdBacktestDecideOrder({
          strategy: automat ? "max30_90" : "classic",
          windowDays: W,
          dniZapasu: dec.dni,
          seenWindow: sum(s.cumSeen, i - W, i),
          prosbaWindow: sum(s.cumProsba, i - W, i),
          floorGross: floorStarts.map((st) => sum(s.cumSeen, i - st, i - st + PROFILE_WINDOW_DAYS) + sum(s.cumProsba, i - st, i - st + PROFILE_WINDOW_DAYS)),
          floorProsba: floorStarts.map((st) => sum(s.cumProsba, i - st, i - st + PROFILE_WINDOW_DAYS)),
          profileHistory: historyStarts.map((st) => sum(s.cumSeen, i - st, i - st + PROFILE_WINDOW_DAYS) + sum(s.cumProsba, i - st, i - st + PROFILE_WINDOW_DAYS)),
          stockout,
          dostepne,
          onOrder,
          trackPolicy: input.trackPolicy ?? null,
          lastOrder: s.lastOrder ? { qty: s.lastOrder.qty, linkedAt: `${s.lastOrder.key}T12:00:00Z` } : null,
          nowMs: Date.parse(`${dec.key}T12:00:00Z`),
          minStock: s.p.minStock ?? 0,
        });
        cand.push({ s, qty: zdBacktestPackPieces(d.pieces, s.p.pack), rate: d.rate, celTracked: d.celTracked, position: dostepne + onOrder });
      }
      const qtyByState = zdBacktestApplyOrderTerms(cand, { terms, cycleDays: R, leadDays: dec.lead, hasAbc });
      for (const c of cand) {
        const qty = qtyByState.get(c) ?? 0;
        if (!(qty > 0)) continue;
        const s = c.s;
        s.pipe.set(dec.arrive, (s.pipe.get(dec.arrive) ?? 0) + qty);
        orders.set(t, (orders.get(t) ?? 0) + qty * s.p.cost);
        s.lastOrder = { qty, key: dec.key };
        s.det.orders++;
      }
    }

    for (const s of states) {
      const { p, det } = s;
      // Wydanie zamówień klientów: pełny przydział, nie przed datą FS.
      let zkSold = 0;
      let zkDue = 0;
      for (let k = s.open.length - 1; k >= 0; k--) {
        const o = s.open[k]!;
        if (o.fsT === t) zkDue += o.qty;
        if (t < o.fsT || o.alloc < o.qty - 1e-9) continue;
        s.stock -= o.qty;
        s.allocated -= o.qty;
        zkSold += o.qty;
        zkTot.qty += o.qty;
        if (t > o.fsT) {
          zkTot.lateQty += o.qty;
          zkTot.delayQtyDays += (t - o.fsT) * o.qty;
        }
        s.open.splice(k, 1);
      }
      const d = s.pp.demand[t]!;
      const served = Math.min(Math.max(0, s.stock - s.allocated), d);
      s.stock -= served;
      s.seen[i] = served + zkSold;
      s.cumSeen[i + 1] = s.cumSeen[i]! + served + zkSold;
      det.demandQty += d + zkDue;
      det.lostQty += d - served;
      det.lostMargin += (d - served) * s.margin;
      det.avgStock += (s.stock * p.cost) / D;
      if (s.stock <= 1e-9) det.zeroDays++;
      const qq = quarters[Math.min(3, Math.floor((t / D) * 4))]!;
      for (const o of [tot, qq]) {
        o.dV += (d + zkDue) * p.cost;
        o.sV += (served + zkSold) * p.cost;
        o.stockV += s.stock * p.cost;
        o.lost += (d - served) * s.margin;
        if (p.active) {
          o.n++;
          if (s.stock <= 1e-9) o.zero++;
        }
      }
    }
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
    cost: tot.lost + avgStock * ZD_BACKTEST_HOLDING_RATE * (D / 365) + orders.size * ZD_BACKTEST_ORDER_COST,
    zk: { qty: zkTot.qty, lateQty: zkTot.lateQty, avgDelayDays: zkTot.lateQty > 0 ? zkTot.delayQtyDays / zkTot.lateQty : null },
    quarters: quarters.map((o) => ({ zeroShare: pct(o.zero, o.n), avgStock: o.stockV / (D / 4) })),
    ...(options.detail ? { byProduct: states.map((s) => s.det) } : {}),
  };
}

/**
 * Minimum zamówienia i próg darmowej dostawy jak `decideZdProposalMinimum` (spec §3.4): linia pilna =
 * (dostępne + w drodze) / tempo < cykl + czas dostawy. Poniżej minimum bez pilnych → ZD odłożone (cały cykl).
 * Poniżej progu: brakuje ≤ 15% → dopełnienie towarami (A/B, gdy są klasy) od najmniej dni pokrycia, każdy najwyżej
 * do celu + tempo × cykl; nie da się dojść do progu → nic nie dodajemy; nadal poniżej i bez pilnych → odłożone.
 * Wartość = sztuki × cena magazynowa (silnik: kartotekowa).
 */
export function zdBacktestApplyOrderTerms<C extends { qty: number; rate: number; celTracked: number; position: number; s: { p: ZdBacktestProduct & { cost: number } } }>(
  cand: readonly C[],
  ctx: { terms: ZdBacktestOrderTerms | null; cycleDays: number; leadDays: number; hasAbc: boolean }
): Map<C, number> {
  const qty = new Map(cand.map((c) => [c, c.qty]));
  const terms = ctx.terms;
  const min = terms?.minOrderValue != null && terms.minOrderValue > 0 ? terms.minOrderValue : null;
  const thr = terms?.freeShippingThreshold != null && terms.freeShippingThreshold > 0 ? terms.freeShippingThreshold : null;
  const value = () => cand.reduce((a, c) => a + (qty.get(c) ?? 0) * c.s.p.cost, 0);
  const v0 = value();
  if (!(v0 > 0) || (min == null && thr == null)) return qty;
  const cover = (c: C) => (c.rate > 0 ? c.position / c.rate : Number.POSITIVE_INFINITY);
  const urgent = cand.some((c) => c.qty > 0 && cover(c) < ctx.cycleDays + ctx.leadDays);
  const none = () => new Map(cand.map((c) => [c, 0]));
  if (min != null && v0 < min && !urgent) return none();
  if (thr != null && v0 < thr) {
    let gap = thr - v0;
    if (gap <= thr * ZD_TOP_UP_MAX_GAP_SHARE + 1e-9) {
      const add = new Map<C, number>();
      const pool = cand
        .filter((c) => c.rate > 0 && (!ctx.hasAbc || c.s.p.abc === "A" || c.s.p.abc === "B"))
        .sort((a, b) => cover(a) - cover(b) || a.s.p.id - b.s.p.id);
      for (const c of pool) {
        if (gap <= 1e-9) break;
        const price = c.s.p.cost;
        if (!(price > 0)) continue;
        const cur = qty.get(c) ?? 0;
        const cap = Math.ceil(c.celTracked + c.rate * ctx.cycleDays - c.position - 1e-9);
        const want = Math.min(cap, cur + Math.ceil(gap / price - 1e-9));
        if (want <= cur) continue;
        const next = zdBacktestPackPieces(want, c.s.p.pack);
        if (next <= cur) continue;
        gap -= (next - cur) * price;
        add.set(c, next);
      }
      if (gap <= 1e-9) {
        for (const [c, n] of add) qty.set(c, n);
        return qty;
      }
    }
    if (!urgent) return none();
  }
  return qty;
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

/** `tradeoff` — tylko w wynikach starszych wersji (ustawienia wybierane ręcznie); nowe przebiegi go nie dają. */
export type ZdBacktestVerdictKind = "works" | "tradeoff" | "fails" | "insufficient";

export type ZdBacktestVerdict = {
  kind: ZdBacktestVerdictKind;
  headline: string;
  /** Zdania uzasadnienia, od najważniejszego. */
  reasons: string[];
};

/** Wariant pesymistyczny (towar dopiero z ostatnią dostawą) może mieć najwyżej tyle pp braków więcej niż rzeczywistość. */
export const ZD_BACKTEST_PESSIMISTIC_PP = 1;
/** Kwartał „trzyma”, gdy braki nie większe niż naprawdę w tym kwartale + tyle pp. */
export const ZD_BACKTEST_QUARTER_PP = 0.5;
/** Ustawienia droższe od najtańszego najwyżej o tyle (+1 zł) to remis w granicach szumu — wygrywa mniej braków. */
export const ZD_BACKTEST_COST_TIE = 0.01;

const fmtPct = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")}%`;
const nfZl = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const fmtZl = (v: number) => (Math.abs(v) >= 10_000 ? `${nfZl.format(v / 1000)} tys. zł` : `${nfZl.format(v)} zł`);

/** W ilu kwartałach braki symulacji nie przekraczają rzeczywistości (+0,5 pp). */
export function zdBacktestStableQuarters(m: Pick<ZdBacktestMetrics, "quarters">, reality: Pick<ZdBacktestReality, "quarters">): number {
  return m.quarters.filter((q, k) => {
    const r = reality.quarters[k]?.zeroShare;
    return q.zeroShare != null && r != null && q.zeroShare <= r + ZD_BACKTEST_QUARTER_PP;
  }).length;
}

/** Braki danych, przy których backtest nie może dobrać ustawień (puste = dane wystarczą). */
export function zdBacktestMissingData(quality: { activeSkus: number; pricedActiveShare: number; leadSamples: number }): string[] {
  const missing: string[] = [];
  if (quality.activeSkus < 5) missing.push(`tylko ${quality.activeSkus} towarów ze sprzedażą w pół roku przed okresem`);
  if (quality.pricedActiveShare < 80) missing.push(`cena magazynowa tylko dla ${fmtPct(quality.pricedActiveShare)} aktywnych towarów`);
  if (quality.leadSamples < 5) missing.push(`tylko ${quality.leadSamples} zmierzonych dostaw (czas dostawy przyjęty 7 dni)`);
  return missing;
}

/** Więcej braków niż naprawdę przyjmujemy tylko wtedy, gdy marżę (koszt braku) znamy co najmniej dla tylu % aktywnych. */
export const ZD_BACKTEST_MIN_MARGIN_KNOWN_PCT = 80;

/**
 * Wynik szukania: najlepsze ustawienia opisane liczbami. Gdy nawet najlepsze ustawienia mają więcej braków niż naprawdę:
 * „fails”, jeśli nie są tańsze od dzisiejszego Kreatora (automat nie ma czego poprawić); „insufficient”, jeśli marża
 * jest znana dla zbyt małej części towarów, żeby koszt braków był wiarygodny.
 */
export function zdBacktestBestVerdict(input: {
  reality: { zeroShare: number | null; avgStock: number };
  best: Pick<ZdBacktestGridPoint, "targetDays" | "cycleDays"> | null;
  automat: ZdBacktestMetrics | null;
  pessimistic: ZdBacktestMetrics | null;
  kreator: ZdBacktestMetrics;
  quality: { activeSkus: number; pricedActiveShare: number; leadSamples: number; marginActiveShare?: number };
}): ZdBacktestVerdict {
  const { reality, best, automat, pessimistic, kreator } = input;
  const missing = zdBacktestMissingData(input.quality);
  if (missing.length || !best || !automat || reality.zeroShare == null || automat.zeroShare == null || !(reality.avgStock > 0)) {
    return {
      kind: "insufficient",
      headline: "Za mało danych, żeby dobrać ustawienia",
      reasons: missing.length ? missing : ["brak stanów albo sprzedaży w okresie backtestu"],
    };
  }
  const settings = `ZD ${zdBacktestCycleText(best.cycleDays)}, cel ${best.targetDays} dni`;
  const reasons = [
    `Towary z zerowym stanem: ${fmtPct(automat.zeroShare)} (naprawdę ${fmtPct(reality.zeroShare)}).`,
    `Średni zapas: ${fmtZl(automat.avgStock)} (naprawdę ${fmtZl(reality.avgStock)}).`,
    `Koszt roku: ${fmtZl(automat.cost)} (Kreator dziś ${fmtZl(kreator.cost)}).`,
  ];
  const pz = pessimistic?.zeroShare;
  if (pz != null && pz > reality.zeroShare + ZD_BACKTEST_PESSIMISTIC_PP) {
    reasons.push(`Gdy dostawca się spóźnia (towar dopiero z ostatnią dostawą), braki rosną do ${fmtPct(pz)}.`);
  }
  if (automat.zeroShare > reality.zeroShare && automat.cost >= kreator.cost) {
    return { kind: "fails", headline: `Automat nie poprawi wyniku — nawet najlepsze ustawienia (${settings}) wypadają gorzej`, reasons };
  }
  const margin = input.quality.marginActiveShare;
  if (automat.zeroShare > reality.zeroShare && margin != null && margin < ZD_BACKTEST_MIN_MARGIN_KNOWN_PCT) {
    return {
      kind: "insufficient",
      headline: "Za mało danych, żeby dobrać ustawienia",
      reasons: [
        `żadne ustawienie nie trzyma dzisiejszych braków, a marża znana tylko dla ${fmtPct(margin)} aktywnych towarów — nie da się policzyć, czy mniejszy zapas wyrównuje dodatkowe braki`,
      ],
    };
  }
  return { kind: "works", headline: `Najlepiej: ${settings}`, reasons };
}

/** Siatka szukania: od zamawiania codziennie (dzień roboczy) do co 4 tygodnie… */
export const ZD_BACKTEST_SEARCH_CYCLES = [1, 2, 3, 4, 5, 7, 10, 14, 21, 28] as const;
/** … i cel od 10 do 90 dni (cel to minimum — silnik podnosi go do cyklu + dostawy + 25%). */
export const ZD_BACKTEST_SEARCH_TARGETS = [10, 14, 18, 21, 25, 30, 35, 40, 45, 50, 60, 75, 90] as const;
/** Dalej, gdy najlepsze wypada na brzegu siatki — do granic zapisu ustawień (cel 180, cykl 60 dni). */
export const ZD_BACKTEST_SEARCH_TARGETS_BEYOND = [105, 120, 150, 180] as const;
export const ZD_BACKTEST_SEARCH_CYCLES_BEYOND = [35, 42, 60] as const;

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
  /** Braki przy opóźnionych dostawach — liczone tylko dla ustawień z brakami nie większymi niż naprawdę. */
  pessimisticZeroShare: number | null;
};

/**
 * Skąd wybór: `works` — braki nie większe niż naprawdę także przy opóźnionych dostawach; `delay_sensitive` — braki
 * nie większe niż naprawdę przy zwykłych dostawach; `lowest_cost` — żadne ustawienie nie trzyma dzisiejszych braków.
 */
export type ZdBacktestRecommendationTier = "works" | "delay_sensitive" | "lowest_cost";

/**
 * Najlepsze ustawienia z siatki: w najwyższym progu, który ma kandydatów (`ZdBacktestRecommendationTier`), wśród
 * stabilnych (najlepiej we wszystkich kwartałach, co najmniej w trzech) najniższy koszt roku = utracona marża
 * + 20% średniego zapasu + koszt każdego ZD. Remis kosztu (`ZD_BACKTEST_COST_TIE`) rozstrzygają mniej braków,
 * mniej zapasu, a przy identycznym wyniku wyższy cel (bliżej tego, co silnik naprawdę trzyma) i rzadsze ZD.
 */
export function zdBacktestPickBest(
  grid: readonly ZdBacktestGridPoint[],
  reality: Pick<ZdBacktestReality, "zeroShare">
): (ZdBacktestGridPoint & { tier: ZdBacktestRecommendationTier }) | null {
  const r0 = reality.zeroShare;
  const noWorse = (g: ZdBacktestGridPoint) => r0 != null && g.zeroShare != null && g.zeroShare <= r0;
  const tiers: Array<[ZdBacktestRecommendationTier, ZdBacktestGridPoint[]]> = [
    ["works", grid.filter((g) => noWorse(g) && g.pessimisticZeroShare != null && g.pessimisticZeroShare <= r0! + ZD_BACKTEST_PESSIMISTIC_PP)],
    ["delay_sensitive", grid.filter(noWorse)],
    ["lowest_cost", [...grid]],
  ];
  for (const [tier, points] of tiers) {
    const stable = Math.min(3, Math.max(0, ...points.map((g) => g.stableQuarters)));
    const pool = points.filter((g) => g.stableQuarters >= stable);
    if (!pool.length) continue;
    const min = Math.min(...pool.map((g) => g.cost));
    const z = (g: ZdBacktestGridPoint) => g.zeroShare ?? Infinity;
    const best = pool
      .filter((g) => g.cost <= min * (1 + ZD_BACKTEST_COST_TIE) + 1)
      .sort((a, b) => z(a) - z(b) || a.avgStock - b.avgStock || b.targetDays - a.targetDays || b.cycleDays - a.cycleDays)[0]!;
    return { ...best, tier };
  }
  return null;
}

/**
 * Szukanie najlepszych ustawień automatu: siatka `ZD_BACKTEST_SEARCH_CYCLES` × `ZD_BACKTEST_SEARCH_TARGETS` (dalej
 * `…_BEYOND`, gdy najlepsze wypada na brzegu), potem dopracowanie celu co 1 dzień (cykl zostaje z listy), dopóki
 * najlepsze się przesuwa. Każde ustawienie to pełny rok symulacji; wariant z opóźnionymi dostawami tylko dla ustawień z brakami nie większymi niż naprawdę.
 * Asynchroniczne — oddaje pętlę zdarzeń między symulacjami i raportuje postęp (`onStep`).
 */
export async function zdBacktestSearch(
  input: ZdBacktestInput,
  reality: ZdBacktestReality,
  options: {
    cycles?: readonly number[];
    targets?: readonly number[];
    onStep?: (done: number, total: number) => void | Promise<void>;
  } = {}
): Promise<{ grid: ZdBacktestGridPoint[]; best: (ZdBacktestGridPoint & { tier: ZdBacktestRecommendationTier }) | null }> {
  const cycles = [...(options.cycles ?? ZD_BACKTEST_SEARCH_CYCLES)].sort((a, b) => a - b);
  const targets = [...(options.targets ?? ZD_BACKTEST_SEARCH_TARGETS)].sort((a, b) => a - b);
  const grid: ZdBacktestGridPoint[] = [];
  const seen = new Set<string>();
  let done = 0;
  let total = 0;
  const step = async () => {
    done++;
    await options.onStep?.(done, total);
    await new Promise((r) => setTimeout(r, 0));
  };
  const evaluate = async (points: Array<[number, number]>) => {
    // Bez powtórek: ani sprawdzonych wcześniej, ani dwa razy w tej samej liście (rogi przy rozszerzeniu siatki).
    const keys = new Set<string>();
    const fresh = points.filter(([c, t]) => {
      const k = `${c}/${t}`;
      if (seen.has(k) || keys.has(k)) return false;
      keys.add(k);
      return true;
    });
    total += fresh.length;
    for (const [cycleDays, targetDays] of fresh) {
      seen.add(`${cycleDays}/${targetDays}`);
      const m = simulateZdBacktest(input, { kind: "automat", targetDays, cycleDays, arrival: "first" });
      await step();
      let pessimisticZeroShare: number | null = null;
      if (reality.zeroShare != null && m.zeroShare != null && m.zeroShare <= reality.zeroShare) {
        total++;
        pessimisticZeroShare = simulateZdBacktest(input, { kind: "automat", targetDays, cycleDays, arrival: "full" }).zeroShare;
        await step();
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
        pessimisticZeroShare,
      });
    }
  };
  await evaluate(cycles.flatMap((c) => targets.map((t): [number, number] => [c, t])));
  let best = zdBacktestPickBest(grid, reality);
  // Najlepsze na brzegu siatki — optimum może leżeć dalej: siatka rośnie do granic zapisu (cel 180, cykl 60).
  const moreTargets = best && best.targetDays === targets.at(-1) ? ZD_BACKTEST_SEARCH_TARGETS_BEYOND.filter((t) => t > best!.targetDays) : [];
  const moreCycles = best && best.cycleDays === cycles.at(-1) ? ZD_BACKTEST_SEARCH_CYCLES_BEYOND.filter((c) => c > best!.cycleDays) : [];
  if (moreTargets.length || moreCycles.length) {
    targets.push(...moreTargets);
    cycles.push(...moreCycles);
    await evaluate([
      ...cycles.flatMap((c) => moreTargets.map((t): [number, number] => [c, t])),
      ...moreCycles.flatMap((c) => targets.map((t): [number, number] => [c, t])),
    ]);
    best = zdBacktestPickBest(grid, reality);
  }
  if (best) {
    // Dopracowanie celu co 1 dzień: wszystko między sąsiadami najlepszego celu z siatki, potem kroki (cel ±1/±2, cykl na
    // sąsiedni z listy), dopóki najlepsze się przesuwa. Cykl tylko z listy: koszt skacze między sąsiednimi dniami cyklu
    // (fazy tygodnia, dni robocze), więc „co 13 dni” wygrywałoby przypadkiem jednego roku, nie regułą.
    const b0 = best;
    const below = targets.filter((x) => x < b0.targetDays).at(-1) ?? Math.max(0, 2 * b0.targetDays - (targets.find((x) => x > b0.targetDays) ?? b0.targetDays));
    const above = targets.find((x) => x > b0.targetDays) ?? b0.targetDays;
    const fine: Array<[number, number]> = [];
    for (let t = Math.max(1, below + 1); t < Math.min(181, above); t++) if (t !== b0.targetDays) fine.push([b0.cycleDays, t]);
    await evaluate(fine);
    best = zdBacktestPickBest(grid, reality);
    for (let round = 0; best && round < 8; round++) {
      const at = best;
      const i = cycles.indexOf(at.cycleDays);
      const next: Array<[number, number]> = [
        ...[-2, -1, 1, 2].map((dt): [number, number] => [at.cycleDays, at.targetDays + dt]),
        ...[cycles[i - 1], cycles[i + 1]].filter((c): c is number => c != null).map((c): [number, number] => [c, at.targetDays]),
      ].filter(([, t]) => t >= 1 && t <= 180);
      const before = grid.length;
      await evaluate(next);
      if (grid.length === before) break;
      best = zdBacktestPickBest(grid, reality);
      if (best && best.cycleDays === at.cycleDays && best.targetDays === at.targetDays) break;
    }
  }
  return { grid, best: zdBacktestPickBest(grid, reality) };
}
