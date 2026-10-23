/**
 * Backtest automatu ZD dla jednego dostawcy (ekran /zakupy/automat → Backtest). Czyste funkcje, bez I/O —
 * dane przygotowuje `src/lib/data/zd-backtest-run.ts`. Przeniesione ze skryptu `scripts/backtest-zd-pl/sim1y.mjs`
 * (spec §8–10) i liczone tymi samymi funkcjami co silnik zamówień:
 * - cel `max30_90` = tempo max(30 d, 90 d) × `effectiveDniZapasu` (cykl + czas dostawy + 25%, minimum dni celu),
 * - czas dostawy = p90 do PIERWSZEJ dostawy z próbek z 24 mies. przed dniem decyzji (jak `automatLeadDays`),
 *   dni robocze → kalendarzowe ze świętami (`businessToCalendarDays`),
 * - ilość zaokrąglona do opakowań i wielokrotności z Kreatora (`computeZdPackOrderQty`).
 * Dzień: przyjęcie dostaw → sprzedaż (czego nie ma na stanie — brak). Popyt = prawdziwa sprzedaż (FS+PA+WZ
 * niepowiązane) + sprzedaż kompletów „rozpisz na składniki” × ilość składnika.
 */
import { effectiveDniZapasu } from "@/lib/orders/zd-demand-policy";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";
import type { ZdPackagingDocumentUnitMode } from "@/lib/orders/zd-estimate-units";
import { businessToCalendarDays } from "@/lib/orders/zd-order-horizon";

const DAY_MS = 86_400_000;
export const addDaysKey = (key: string, days: number) =>
  new Date(Date.parse(`${key}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const dayIndex = (simStart: string, key: string) =>
  Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${simStart}T12:00:00Z`)) / DAY_MS);

export type ZdBacktestPack = { unitsPerPackage: number; documentUnitMode: ZdPackagingDocumentUnitMode | null; orderMultiple: number | null };

export type ZdBacktestProduct = {
  id: number;
  /** Cena magazynowa za sztukę (wycena zapasu); null = towar pominięty w symulacji. */
  cost: number | null;
  /** Sprzedaż w 182 dniach przed startem — liczy się do braków. */
  active: boolean;
  pack: ZdBacktestPack | null;
};

/** Próbka czasu dostawy: data złożenia, dni robocze do pełnej i do pierwszej dostawy. */
export type ZdBacktestLeadSample = { placementDate: string; fullDays: number; firstDays: number | null };

export type ZdBacktestInput = {
  /** Pierwszy dzień symulacji (stan startowy = zdjęcie z dnia poprzedniego). */
  simStart: string;
  days: number;
  products: ZdBacktestProduct[];
  /** Popyt w sztukach: [data yyyy-mm-dd, ilość] — także sprzed startu (okna 30/90 d). */
  demand: ReadonlyMap<number, ReadonlyArray<readonly [string, number]>>;
  /** Tygodniowe zdjęcia stanu (remanent), od najstarszego; pierwsze = stan startowy. */
  snapshots: ReadonlyArray<{ day: string; qty: ReadonlyMap<number, number> }>;
  lead: ReadonlyArray<ZdBacktestLeadSample>;
};

export type ZdBacktestPolicy =
  /** Kreator dziś: cel = sprzedaż z ostatnich `days` dni, zamawiane co `cycleDays` (rytm dostawcy). */
  | { kind: "kreator"; days: number; cycleDays: number }
  /** Automat max30_90; `arrival` = kiedy przychodzi towar: z pierwszą dostawą albo dopiero z ostatnią. */
  | { kind: "automat"; targetDays: number; cycleDays: number; arrival: "first" | "full" };

export type ZdBacktestMetrics = {
  /** % aktywnych towarów z zerowym stanem na tygodniowym zdjęciu (jak remanent). */
  zeroShare: number | null;
  /** Obsłużona sprzedaż wartościowo (%). */
  servedShare: number | null;
  /** Średnia wartość zapasu (zł). */
  avgStock: number;
  orders: number;
  medianOrder: number;
  /** Kwartały: % zera i średni zapas. */
  quarters: Array<{ zeroShare: number | null; avgStock: number }>;
};

const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
export const nearestRank = (sorted: readonly number[], p: number) =>
  sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]! : null;

/** Czas dostawy w dniu decyzji jak silnik: p90 (≥ 5 próbek) albo p50 z 24 mies. wstecz (min. 5 najnowszych); brak → 7 dni. */
export function zdBacktestLeadDays(samples: ReadonlyArray<ZdBacktestLeadSample>, dayKey: string, which: "first" | "full"): number {
  const before = samples.filter((s) => s.placementDate < dayKey).sort((a, b) => b.placementDate.localeCompare(a.placementDate));
  const cut = new Date(`${dayKey}T12:00:00Z`);
  cut.setUTCMonth(cut.getUTCMonth() - 24);
  const cutKey = cut.toISOString().slice(0, 10);
  let win = before.filter((s) => s.placementDate >= cutKey);
  if (win.length < 5) win = before.slice(0, 5);
  const days = win
    .map((s) => (which === "first" ? Math.min(s.fullDays, s.firstDays ?? s.fullDays) : s.fullDays))
    .sort((a, b) => a - b);
  const bd = days.length >= 5 ? nearestRank(days, 0.9) : days.length ? nearestRank(days, 0.5) : null;
  return bd == null ? 7 : Math.max(1, businessToCalendarDays(dayKey, bd));
}

/** Kiedy przyjechałoby zamówienie złożone w `dayKey`: czas prawdziwego zamówienia złożonego najbliżej tej daty. */
export function zdBacktestRealizedLead(samples: ReadonlyArray<ZdBacktestLeadSample>, dayKey: string, which: "first" | "full"): number {
  if (!samples.length) return 7;
  const t = Date.parse(dayKey);
  let best = samples[0]!;
  let bestD = Infinity;
  for (const s of samples) {
    const d = Math.abs(Date.parse(s.placementDate) - t);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  const bd = which === "first" ? Math.min(best.fullDays, best.firstDays ?? best.fullDays) : best.fullDays;
  return Math.max(1, businessToCalendarDays(dayKey, bd));
}

function packRound(pieces: number, pack: ZdBacktestPack | null): number {
  if (!(pieces > 1e-9)) return 0;
  return computeZdPackOrderQty(pieces, pack?.unitsPerPackage ?? null, "op.", pack?.documentUnitMode ?? "packages", pack?.orderMultiple ?? null)
    .piecesArriving;
}

export function simulateZdBacktest(input: ZdBacktestInput, policy: ZdBacktestPolicy): ZdBacktestMetrics {
  const { simStart, days: D } = input;
  const R = Math.max(1, Math.round(policy.cycleDays));
  const start = input.snapshots[0]?.qty ?? new Map<number, number>();
  const snapDays = new Set(input.snapshots.slice(1).map((s) => dayIndex(simStart, s.day)).filter((i) => i >= 0 && i < D));
  snapDays.add(0);
  const decisions = new Map<number, { target: number; arrive: number }>();
  for (let t = 0; t < D; t += R) {
    const key = addDaysKey(simStart, t);
    const arrive = t + zdBacktestRealizedLead(input.lead, key, policy.kind === "automat" ? policy.arrival : "first");
    let targetDays = 0;
    if (policy.kind === "automat") {
      const lead = zdBacktestLeadDays(input.lead, key, "first");
      targetDays = effectiveDniZapasu({ strategy: "max30_90", targetDays: policy.targetDays, cycleDays: R }, 30, { leadDays: lead, nextOrderDays: 0 });
    }
    decisions.set(t, { target: targetDays, arrive });
  }
  const q = () => ({ dV: 0, sV: 0, zero: 0, snapN: 0, stockV: 0 });
  const tot = q();
  const quarters = [q(), q(), q(), q()];
  const orders = new Map<number, number>();
  for (const p of input.products) {
    if (p.cost == null) continue;
    const lines = (input.demand.get(p.id) ?? []).map(([k, v]) => [dayIndex(simStart, k), v] as const).filter(([, v]) => v > 0);
    const daily = new Array<number>(D).fill(0);
    for (const [i, v] of lines) if (i >= 0 && i < D) daily[i] += v;
    const sumWin = (t: number, n: number) => lines.reduce((a, [i, v]) => (i < t && i >= t - n ? a + v : a), 0);
    let stock = Math.max(0, start.get(p.id) ?? 0);
    const pipe = new Map<number, number>();
    for (let t = 0; t < D; t++) {
      stock += pipe.get(t) ?? 0;
      pipe.delete(t);
      const qq = quarters[Math.min(3, Math.floor((t / D) * 4))]!;
      if (snapDays.has(t) && p.active) {
        for (const o of [tot, qq]) {
          o.snapN++;
          if (stock <= 0) o.zero++;
        }
      }
      const dec = decisions.get(t);
      if (dec) {
        const onOrder = [...pipe.values()].reduce((a, b) => a + b, 0);
        const target =
          policy.kind === "kreator"
            ? sumWin(t, policy.days)
            : Math.max(sumWin(t, 30) / 30, sumWin(t, 90) / 90) * dec.target;
        const qty = packRound(target - stock - onOrder, p.pack);
        if (qty > 0) {
          pipe.set(dec.arrive, (pipe.get(dec.arrive) ?? 0) + qty);
          orders.set(t, (orders.get(t) ?? 0) + qty * p.cost);
        }
      }
      const d = daily[t]!;
      const served = Math.min(stock, d);
      stock -= served;
      for (const o of [tot, qq]) {
        o.dV += d * p.cost;
        o.sV += served * p.cost;
        o.stockV += stock * p.cost;
      }
    }
  }
  const ov = [...orders.values()].sort((a, b) => a - b);
  return {
    zeroShare: pct(tot.zero, tot.snapN),
    servedShare: pct(tot.sV, tot.dV),
    avgStock: tot.stockV / D,
    orders: orders.size,
    medianOrder: ov.length ? ov[Math.floor(ov.length / 2)]! : 0,
    quarters: quarters.map((o) => ({ zeroShare: pct(o.zero, o.snapN), avgStock: o.stockV / (D / 4) })),
  };
}

/** Co było naprawdę: tygodniowe zdjęcia stanu z tego samego okresu. */
export function zdBacktestReality(input: ZdBacktestInput): { zeroShare: number | null; avgStock: number } {
  let zero = 0;
  let n = 0;
  let value = 0;
  const snaps = input.snapshots;
  for (const p of input.products) {
    if (p.cost == null) continue;
    for (const s of snaps) {
      const v = s.qty.get(p.id) ?? 0;
      value += (v * p.cost) / Math.max(1, snaps.length);
      if (p.active) {
        n++;
        if (v <= 0) zero++;
      }
    }
  }
  return { zeroShare: pct(zero, n), avgStock: value };
}

/** Rozchód ze stanu bez dokumentu sprzedaży (kompletacja, przeliczenia paczek, RW) — % wartości sprzedaży. */
export function zdBacktestHiddenOutflowShare(input: ZdBacktestInput): number | null {
  let hidden = 0;
  let sold = 0;
  const snaps = input.snapshots;
  for (const p of input.products) {
    if (p.cost == null) continue;
    const lines = input.demand.get(p.id) ?? [];
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

const fmtPct = (v: number) => `${String(Math.round(v * 10) / 10).replace(".", ",")}%`;
const fmtChange = (now: number, base: number) => {
  if (!(base > 0)) return null;
  const c = Math.round(((now - base) / base) * 100);
  return c;
};

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

export const ZD_BACKTEST_GRID_TARGETS = [20, 25, 30, 35, 40, 50, 60] as const;
export const ZD_BACKTEST_GRID_CYCLES = [7, 14, 21] as const;

export type ZdBacktestGridPoint = {
  targetDays: number;
  cycleDays: number;
  zeroShare: number | null;
  avgStock: number;
  orders: number;
  medianOrder: number;
  /** Spełnia „działa” (braki ≤ dziś, zapas ≤ dziś + 10%, opóźnione dostawy ≤ dziś + 1 pp). */
  works: boolean;
};

/**
 * Siatka ustawień automatu i rekomendacja: najmniejszy zapas wśród ustawień, które „działają”; gdy żadne —
 * najmniej braków. Wariant pesymistyczny liczony tylko dla kandydatów, którzy przeszli dwa pierwsze warunki.
 */
export function zdBacktestGrid(
  input: ZdBacktestInput,
  reality: { zeroShare: number | null; avgStock: number },
  options: { targets?: readonly number[]; cycles?: readonly number[] } = {}
): { grid: ZdBacktestGridPoint[]; recommended: ZdBacktestGridPoint | null } {
  const grid: ZdBacktestGridPoint[] = [];
  for (const cycleDays of options.cycles ?? ZD_BACKTEST_GRID_CYCLES) {
    for (const targetDays of options.targets ?? ZD_BACKTEST_GRID_TARGETS) {
      const m = simulateZdBacktest(input, { kind: "automat", targetDays, cycleDays, arrival: "first" });
      let works = false;
      if (reality.zeroShare != null && m.zeroShare != null && m.zeroShare <= reality.zeroShare && m.avgStock <= reality.avgStock * ZD_BACKTEST_STOCK_TOLERANCE) {
        const p = simulateZdBacktest(input, { kind: "automat", targetDays, cycleDays, arrival: "full" });
        works = (p.zeroShare ?? Infinity) <= reality.zeroShare + ZD_BACKTEST_PESSIMISTIC_PP;
      }
      grid.push({ targetDays, cycleDays, zeroShare: m.zeroShare, avgStock: m.avgStock, orders: m.orders, medianOrder: m.medianOrder, works });
    }
  }
  const ok = grid.filter((g) => g.works).sort((a, b) => a.avgStock - b.avgStock || b.cycleDays - a.cycleDays);
  const recommended = ok[0] ?? [...grid].sort((a, b) => (a.zeroShare ?? Infinity) - (b.zeroShare ?? Infinity) || a.avgStock - b.avgStock)[0] ?? null;
  return { grid, recommended };
}
