/** Helpery podsumowania miesięcznego — bezpieczne dla klienta (bez Supabase). */

import { warsawNowParts } from "@/lib/time/warsaw";

const MONTH_LABELS_PL = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

/** Metryki próśb/zamówień liczone według daty akcji w systemie (`action_at`). */
export const MONTHLY_STATS_ACTION_AT_HINT =
  "Według daty akcji w systemie (moment rejestracji / zmiany w panelu).";

export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelFromKey(key: string): string {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return key;
  return `${MONTH_LABELS_PL[monthIdx]} ${year}`;
}

export function previousMonthKeyFromDate(at: Date = new Date()): string {
  const dateKey = warsawNowParts(at).dateKey;
  const [yearStr, monthStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const fallback = new Date(at.getFullYear(), at.getMonth() - 1, 1);
    return monthKeyFromDate(fallback);
  }
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function currentMonthKeyFromDate(at: Date = new Date()): string {
  const dateKey = warsawNowParts(at).dateKey;
  const [yearStr, monthStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKeyFromDate(at);
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isCompletedMonthlySummaryMonth(monthKey: string, at: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return false;
  return monthKey < currentMonthKeyFromDate(at);
}

export function resolveCompletedMonthlySummaryMonthKey(
  requested: string | null | undefined,
  at: Date = new Date()
): string {
  if (requested && isCompletedMonthlySummaryMonth(requested, at)) {
    return requested;
  }
  return defaultMonthlySummaryMonthKey(at);
}

export function defaultMonthlySummaryMonthKey(at: Date = new Date()): string {
  return previousMonthKeyFromDate(at);
}

export function previousMonthKeyFromMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function nextMonthKeyFromMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function isMonthlySummaryAvailable(at: Date = new Date()): boolean {
  const day = Number(warsawNowParts(at).dateKey.split("-")[2]);
  return Number.isFinite(day) && day >= 1 && day <= 7;
}

export type MonthlySummaryTab = "handlowcy" | "dostawy" | "zakupy" | "zeby";

export type SalesRankingSort = "requests" | "successRate" | "zkClosed";

export type MomChange = {
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
};

export function momChange(current: number, previous: number): MomChange {
  const delta = current - previous;
  if (previous === 0) {
    return { current, previous, delta, pct: current === 0 ? 0 : null };
  }
  return {
    current,
    previous,
    delta,
    pct: Math.round((delta / previous) * 100),
  };
}

export type MonthlyMomComparison = {
  previousMonthKey: string;
  previousMonthLabel: string;
  sales: {
    requestsCreated: MomChange;
    requestsCompleted: MomChange;
    successRate: MomChange;
    zkClosed: MomChange;
    zkOpen: MomChange;
  };
  delivery: {
    totalReceipts: MomChange;
    totalPackages: MomChange;
    totalPallets: MomChange;
  };
  procurement: {
    totalOrders: MomChange;
    completedOrders: MomChange;
    successRate: MomChange;
    avgDeliveryDays: MomChange | null;
  };
  teeth: {
    requestsCreated: MomChange;
    ordered: MomChange;
    completed: MomChange;
    successRate: MomChange;
  };
};

export type MonthlyStatCard = {
  label: string;
  value: string | number;
  hint?: string;
  tone: "indigo" | "emerald" | "amber" | "sky" | "violet" | "slate";
};

export type SalesPersonMonthlyStat = {
  salesPersonId: string;
  salesPersonName: string;
  requestsCreated: number;
  requestsCompleted: number;
  requestsCancelled: number;
  /** ZK zamknięte w tym miesiącu. */
  zkClosed: number;
  /** ZK otwarte na koniec miesiąca (zaległość / backlog). */
  zkOpen: number;
};

export type DeliveryShipmentFormStat = {
  form: "paczki" | "palety" | "paczki_i_palety" | "inne";
  label: string;
  count: number;
};

export type DeliveryMonthlyStat = {
  totalReceipts: number;
  totalPackages: number;
  totalPallets: number;
  byCarrier: { carrier: string; count: number; packages: number; pallets: number }[];
  byShipmentForm: DeliveryShipmentFormStat[];
};

export type ProcurementSupplierStat = {
  supplierId: string;
  supplierName: string;
  orders: number;
  completed: number;
  /** Wiersz zbiorczy „Pozostałe dostawcy”. */
  isRemainder?: boolean;
};

export type ProcurementMonthlyStat = {
  totalOrders: number;
  mainOrders: number;
  sideOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  informacjaCount: number;
  avgDeliveryDays: number | null;
  /** Ile zrealizowanych weszło do średniego czasu. */
  avgDeliverySampleSize: number;
  bySupplier: ProcurementSupplierStat[];
};

export type TeethMonthlyStat = {
  requestsCreated: number;
  ordered: number;
  completed: number;
  cancelled: number;
  avgLeadDays: number | null;
  avgLeadSampleSize: number;
  bySupplier: ProcurementSupplierStat[];
};

export type MonthlyStats = {
  monthKey: string;
  monthLabel: string;
  sales: SalesPersonMonthlyStat[];
  delivery: DeliveryMonthlyStat;
  procurement: ProcurementMonthlyStat;
  teeth: TeethMonthlyStat;
  availableMonths: { key: string; label: string }[];
  mom: MonthlyMomComparison;
};

export function salesTotalsFromStats(sales: SalesPersonMonthlyStat[]): {
  requestsCreated: number;
  requestsCompleted: number;
  requestsCancelled: number;
  zkClosed: number;
  zkOpen: number;
  successRate: number;
} {
  const requestsCreated = sales.reduce((sum, s) => sum + s.requestsCreated, 0);
  const requestsCompleted = sales.reduce((sum, s) => sum + s.requestsCompleted, 0);
  const requestsCancelled = sales.reduce((sum, s) => sum + s.requestsCancelled, 0);
  const zkClosed = sales.reduce((sum, s) => sum + s.zkClosed, 0);
  const zkOpen = sales.reduce((sum, s) => sum + s.zkOpen, 0);
  const successRate =
    requestsCreated > 0 ? Math.round((requestsCompleted / requestsCreated) * 100) : 0;
  return {
    requestsCreated,
    requestsCompleted,
    requestsCancelled,
    zkClosed,
    zkOpen,
    successRate,
  };
}

export function salesPersonSuccessRate(s: SalesPersonMonthlyStat): number {
  return s.requestsCreated > 0
    ? Math.round((s.requestsCompleted / s.requestsCreated) * 100)
    : 0;
}

/** Ranking: prośby lub zamknięte ZK — bez osób tylko z otwartymi ZK (te wchodzą w sumy KPI). */
export function salesPersonRanksInList(s: SalesPersonMonthlyStat): boolean {
  return s.requestsCreated > 0 || s.zkClosed > 0;
}

export function sortSalesRanking(
  sales: SalesPersonMonthlyStat[],
  sort: SalesRankingSort
): SalesPersonMonthlyStat[] {
  const copy = sales.filter(salesPersonRanksInList);
  copy.sort((a, b) => {
    if (sort === "successRate") {
      const d = salesPersonSuccessRate(b) - salesPersonSuccessRate(a);
      if (d !== 0) return d;
      return b.requestsCreated - a.requestsCreated;
    }
    if (sort === "zkClosed") {
      const d = b.zkClosed - a.zkClosed;
      if (d !== 0) return d;
      return b.requestsCreated - a.requestsCreated;
    }
    const d = b.requestsCreated - a.requestsCreated;
    if (d !== 0) return d;
    return salesPersonSuccessRate(b) - salesPersonSuccessRate(a);
  });
  return copy;
}

export type MonthDepartmentTotals = {
  salesRequestsCreated: number;
  salesRequestsCompleted: number;
  salesSuccessRate: number;
  zkClosed: number;
  zkOpen: number;
  deliveryReceipts: number;
  deliveryPackages: number;
  deliveryPallets: number;
  procurementOrders: number;
  procurementCompleted: number;
  procurementSuccessRate: number;
  procurementAvgDeliveryDays: number | null;
  teethRequestsCreated: number;
  teethOrdered: number;
  teethCompleted: number;
  teethSuccessRate: number;
};

export function totalsFromDepartments(d: {
  sales: SalesPersonMonthlyStat[];
  delivery: DeliveryMonthlyStat;
  procurement: ProcurementMonthlyStat;
  teeth: TeethMonthlyStat;
}): MonthDepartmentTotals {
  const sales = salesTotalsFromStats(d.sales);
  const procurementSuccessRate =
    d.procurement.totalOrders > 0
      ? Math.round((d.procurement.completedOrders / d.procurement.totalOrders) * 100)
      : 0;
  const teethSuccessRate =
    d.teeth.requestsCreated > 0
      ? Math.round((d.teeth.completed / d.teeth.requestsCreated) * 100)
      : 0;
  return {
    salesRequestsCreated: sales.requestsCreated,
    salesRequestsCompleted: sales.requestsCompleted,
    salesSuccessRate: sales.successRate,
    zkClosed: sales.zkClosed,
    zkOpen: sales.zkOpen,
    deliveryReceipts: d.delivery.totalReceipts,
    deliveryPackages: d.delivery.totalPackages,
    deliveryPallets: d.delivery.totalPallets,
    procurementOrders: d.procurement.totalOrders,
    procurementCompleted: d.procurement.completedOrders,
    procurementSuccessRate,
    procurementAvgDeliveryDays: d.procurement.avgDeliveryDays,
    teethRequestsCreated: d.teeth.requestsCreated,
    teethOrdered: d.teeth.ordered,
    teethCompleted: d.teeth.completed,
    teethSuccessRate,
  };
}

export function buildMonthlyMomComparison(
  monthKey: string,
  current: MonthDepartmentTotals,
  previous: MonthDepartmentTotals
): MonthlyMomComparison {
  const previousMonthKey = previousMonthKeyFromMonthKey(monthKey);

  let avgDeliveryDays: MomChange | null = null;
  if (
    current.procurementAvgDeliveryDays != null &&
    previous.procurementAvgDeliveryDays != null
  ) {
    avgDeliveryDays = momChange(
      current.procurementAvgDeliveryDays,
      previous.procurementAvgDeliveryDays
    );
  }

  return {
    previousMonthKey,
    previousMonthLabel: monthLabelFromKey(previousMonthKey),
    sales: {
      requestsCreated: momChange(
        current.salesRequestsCreated,
        previous.salesRequestsCreated
      ),
      requestsCompleted: momChange(
        current.salesRequestsCompleted,
        previous.salesRequestsCompleted
      ),
      successRate: momChange(current.salesSuccessRate, previous.salesSuccessRate),
      zkClosed: momChange(current.zkClosed, previous.zkClosed),
      zkOpen: momChange(current.zkOpen, previous.zkOpen),
    },
    delivery: {
      totalReceipts: momChange(current.deliveryReceipts, previous.deliveryReceipts),
      totalPackages: momChange(current.deliveryPackages, previous.deliveryPackages),
      totalPallets: momChange(current.deliveryPallets, previous.deliveryPallets),
    },
    procurement: {
      totalOrders: momChange(current.procurementOrders, previous.procurementOrders),
      completedOrders: momChange(
        current.procurementCompleted,
        previous.procurementCompleted
      ),
      successRate: momChange(
        current.procurementSuccessRate,
        previous.procurementSuccessRate
      ),
      avgDeliveryDays,
    },
    teeth: {
      requestsCreated: momChange(
        current.teethRequestsCreated,
        previous.teethRequestsCreated
      ),
      ordered: momChange(current.teethOrdered, previous.teethOrdered),
      completed: momChange(current.teethCompleted, previous.teethCompleted),
      successRate: momChange(current.teethSuccessRate, previous.teethSuccessRate),
    },
  };
}

/** Udział w sumie (0–100); nie względem lidera. */
export function shareOfTotal(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Udziały % sumujące się dokładnie do 100 (metoda największej reszty).
 * Zwraca tablicę równoległą do `values`.
 */
export function allocatePercentageShares(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (Math.max(0, v) / total) * 100);
  const floored = exact.map((e) => Math.floor(e));
  const remainder = 100 - floored.reduce((sum, n) => sum + n, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floored];
  for (let k = 0; k < remainder; k++) {
    const idx = order[k]?.i;
    if (idx == null) break;
    result[idx] = (result[idx] ?? 0) + 1;
  }
  return result;
}

export const EMPTY_TEETH_STATS: TeethMonthlyStat = {
  requestsCreated: 0,
  ordered: 0,
  completed: 0,
  cancelled: 0,
  avgLeadDays: null,
  avgLeadSampleSize: 0,
  bySupplier: [],
};

export const EMPTY_DELIVERY_STATS: DeliveryMonthlyStat = {
  totalReceipts: 0,
  totalPackages: 0,
  totalPallets: 0,
  byCarrier: [],
  byShipmentForm: [],
};

export const EMPTY_PROCUREMENT_STATS: ProcurementMonthlyStat = {
  totalOrders: 0,
  mainOrders: 0,
  sideOrders: 0,
  completedOrders: 0,
  cancelledOrders: 0,
  informacjaCount: 0,
  avgDeliveryDays: null,
  avgDeliverySampleSize: 0,
  bySupplier: [],
};
