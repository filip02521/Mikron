/** Helpery podsumowania miesięcznego — bezpieczne dla klienta (bez Supabase). */

const MONTH_LABELS_PL = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

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

export function isMonthlySummaryAvailable(): boolean {
  const now = new Date();
  return now.getDate() <= 7;
}

export type MonthlySummaryTab = "handlowcy" | "dostawy" | "zakupy";

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
  zkClosed: number;
  zkOpen: number;
};

export type DeliveryMonthlyStat = {
  totalReceipts: number;
  totalPackages: number;
  totalPallets: number;
  byCarrier: { carrier: string; count: number; packages: number; pallets: number }[];
};

export type ProcurementMonthlyStat = {
  totalOrders: number;
  mainOrders: number;
  sideOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  informacjaCount: number;
  avgDeliveryDays: number | null;
  bySupplier: { supplierId: string; supplierName: string; orders: number; completed: number }[];
};

export type MonthlyStats = {
  monthKey: string;
  monthLabel: string;
  sales: SalesPersonMonthlyStat[];
  delivery: DeliveryMonthlyStat;
  procurement: ProcurementMonthlyStat;
  availableMonths: { key: string; label: string }[];
};
