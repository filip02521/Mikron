import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

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

function startOfMonthISO(key: string): string {
  return `${key}-01T00:00:00.000Z`;
}

function endOfMonthISO(key: string): string {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (isNaN(year) || isNaN(month)) return new Date().toISOString();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;
}

function warsawMonthStart(key: string): string {
  return `${key}-01T00:00:00+02:00`;
}

function warsawMonthEnd(key: string): string {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (isNaN(year) || isNaN(month)) return new Date().toISOString();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+02:00`;
}

export async function fetchAvailableMonths(limit = 12): Promise<{ key: string; label: string }[]> {
  if (!hasSupabaseConfig()) {
    const now = new Date();
    return Array.from({ length: Math.min(limit, 6) }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKeyFromDate(d);
      return { key, label: monthLabelFromKey(key) };
    });
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("individual_orders")
    .select("action_at")
    .order("action_at", { ascending: false })
    .limit(500);

  const months = new Set<string>();
  for (const row of data ?? []) {
    const iso = (row as { action_at: string }).action_at;
    if (!iso) continue;
    const d = new Date(iso);
    months.add(monthKeyFromDate(d));
    if (months.size >= limit) break;
  }

  const now = new Date();
  months.add(monthKeyFromDate(now));

  const sorted = [...months].sort((a, b) => b.localeCompare(a)).slice(0, limit);
  return sorted.map((key) => ({ key, label: monthLabelFromKey(key) }));
}

export async function fetchMonthlyStats(monthKey: string): Promise<MonthlyStats> {
  const availableMonths = await fetchAvailableMonths();

  if (!hasSupabaseConfig()) {
    return {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      sales: [],
      delivery: { totalReceipts: 0, totalPackages: 0, totalPallets: 0, byCarrier: [] },
      procurement: {
        totalOrders: 0,
        mainOrders: 0,
        sideOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        informacjaCount: 0,
        avgDeliveryDays: null,
        bySupplier: [],
      },
      availableMonths,
    };
  }

  const supabase = createAdminClient();
  const monthStart = startOfMonthISO(monthKey);
  const monthEnd = endOfMonthISO(monthKey);
  const wawStart = warsawMonthStart(monthKey);
  const wawEnd = warsawMonthEnd(monthKey);

  const [ordersRes, zkRes, receiptsRes, salesPeopleRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("id, sales_person_id, request_kind, status, order_type, action_at, delivery_at, ordered_at, supplier_id, supplier:suppliers(name)")
      .gte("action_at", monthStart)
      .lt("action_at", monthEnd),
    supabase
      .from("sales_zk_watches")
      .select("id, sales_person_id, closed_at, archived_at, created_at")
      .or(`and(closed_at.gte.${wawStart},closed_at.lt.${wawEnd}),and(created_at.gte.${wawStart},created_at.lt.${wawEnd})`),
    supabase
      .from("warehouse_delivery_receipts")
      .select("id, carrier, shipment_form, package_count, pallet_count, received_date, supplier_id, supplier:suppliers(name)")
      .gte("received_date", `${monthKey}-01`)
      .lte("received_date", `${monthKey}-31`),
    supabase
      .from("sales_people")
      .select("id, name, email")
      .order("name"),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as Array<{
    id: string;
    sales_person_id: string;
    request_kind: string;
    status: string;
    order_type: string | null;
    action_at: string;
    delivery_at: string | null;
    ordered_at: string | null;
    supplier_id: string | null;
    supplier: { name: string } | null;
  }>;

  const zkWatches = (zkRes.data ?? []) as Array<{
    id: string;
    sales_person_id: string;
    closed_at: string | null;
    archived_at: string | null;
    created_at: string;
  }>;

  const receipts = (receiptsRes.data ?? []) as unknown as Array<{
    id: string;
    carrier: string;
    shipment_form: string;
    package_count: number;
    pallet_count: number;
    received_date: string;
    supplier_id: string | null;
    supplier: { name: string } | null;
  }>;

  const salesPeople = (salesPeopleRes.data ?? []) as Array<{
    id: string;
    name: string;
    email: string;
  }>;

  const zkClosedByPerson = new Map<string, number>();
  const zkOpenByPerson = new Map<string, number>();
  for (const zk of zkWatches) {
    if (zk.closed_at) {
      zkClosedByPerson.set(zk.sales_person_id, (zkClosedByPerson.get(zk.sales_person_id) ?? 0) + 1);
    } else if (!zk.archived_at) {
      zkOpenByPerson.set(zk.sales_person_id, (zkOpenByPerson.get(zk.sales_person_id) ?? 0) + 1);
    }
  }

  const salesMap = new Map<string, SalesPersonMonthlyStat>();
  for (const sp of salesPeople) {
    salesMap.set(sp.id, {
      salesPersonId: sp.id,
      salesPersonName: sp.name,
      requestsCreated: 0,
      requestsCompleted: 0,
      requestsCancelled: 0,
      zkClosed: zkClosedByPerson.get(sp.id) ?? 0,
      zkOpen: zkOpenByPerson.get(sp.id) ?? 0,
    });
  }

  for (const order of orders) {
    const stat = salesMap.get(order.sales_person_id);
    if (!stat) {
      const fallback: SalesPersonMonthlyStat = {
        salesPersonId: order.sales_person_id,
        salesPersonName: "Nieznany handlowiec",
        requestsCreated: 0,
        requestsCompleted: 0,
        requestsCancelled: 0,
        zkClosed: 0,
        zkOpen: 0,
      };
      salesMap.set(order.sales_person_id, fallback);
      continue;
    }
    stat.requestsCreated++;
    if (order.status === "Zrealizowane") stat.requestsCompleted++;
    if (order.status === "Anulowane") stat.requestsCancelled++;
  }

  const sales = [...salesMap.values()]
    .filter((s) => s.requestsCreated > 0 || s.zkClosed > 0 || s.zkOpen > 0)
    .sort((a, b) => b.requestsCreated - a.requestsCreated);

  const delivery: DeliveryMonthlyStat = {
    totalReceipts: receipts.length,
    totalPackages: 0,
    totalPallets: 0,
    byCarrier: [],
  };
  const carrierMap = new Map<string, { count: number; packages: number; pallets: number }>();
  for (const r of receipts) {
    delivery.totalPackages += r.package_count;
    delivery.totalPallets += r.pallet_count;
    const existing = carrierMap.get(r.carrier) ?? { count: 0, packages: 0, pallets: 0 };
    existing.count++;
    existing.packages += r.package_count;
    existing.pallets += r.pallet_count;
    carrierMap.set(r.carrier, existing);
  }
  delivery.byCarrier = [...carrierMap.entries()]
    .map(([carrier, v]) => ({ carrier, ...v }))
    .sort((a, b) => b.count - a.count);

  const zamowienia = orders.filter((o) => o.request_kind === "zamowienie");
  const completed = zamowienia.filter((o) => o.status === "Zrealizowane");
  const cancelled = zamowienia.filter((o) => o.status === "Anulowane");
  const informacja = orders.filter((o) => o.request_kind === "informacja");

  let avgDeliveryDays: number | null = null;
  if (completed.length > 0) {
    let totalDays = 0;
    let validCount = 0;
    for (const o of completed) {
      if (!o.ordered_at || !o.delivery_at) continue;
      const ordered = new Date(o.ordered_at);
      const delivered = new Date(o.delivery_at);
      const diff = Math.round((delivered.getTime() - ordered.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0) {
        totalDays += diff;
        validCount++;
      }
    }
    if (validCount > 0) avgDeliveryDays = Math.round(totalDays / validCount);
  }

  const supplierMap = new Map<string, { name: string; orders: number; completed: number }>();
  for (const o of zamowienia) {
    if (!o.supplier_id) continue;
    const name = o.supplier?.name ?? "Nieznany dostawca";
    const existing = supplierMap.get(o.supplier_id) ?? { name, orders: 0, completed: 0 };
    existing.orders++;
    if (o.status === "Zrealizowane") existing.completed++;
    supplierMap.set(o.supplier_id, existing);
  }

  const procurement: ProcurementMonthlyStat = {
    totalOrders: zamowienia.length,
    mainOrders: zamowienia.filter((o) => o.order_type === "Glowne").length,
    sideOrders: zamowienia.filter((o) => o.order_type === "Poboczne").length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    informacjaCount: informacja.length,
    avgDeliveryDays,
    bySupplier: [...supplierMap.entries()]
      .map(([supplierId, v]) => ({ supplierId, supplierName: v.name, orders: v.orders, completed: v.completed }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 15),
  };

  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    sales,
    delivery,
    procurement,
    availableMonths,
  };
}

export function isMonthlySummaryAvailable(): boolean {
  const now = new Date();
  return now.getDate() <= 7;
}
