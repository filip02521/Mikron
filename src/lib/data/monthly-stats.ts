import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  buildMonthlyMomComparison,
  defaultMonthlySummaryMonthKey,
  EMPTY_DELIVERY_STATS,
  EMPTY_PROCUREMENT_STATS,
  EMPTY_TEETH_STATS,
  isCompletedMonthlySummaryMonth,
  monthKeyFromDate,
  monthLabelFromKey,
  previousMonthKeyFromMonthKey,
  totalsFromDepartments,
  type DeliveryMonthlyStat,
  type DeliveryShipmentFormStat,
  type MonthlyStats,
  type ProcurementMonthlyStat,
  type ProcurementSupplierStat,
  type SalesPersonMonthlyStat,
  type TeethMonthlyStat,
} from "@/lib/data/monthly-stats-shared";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";
import { warehouseShipmentFormLabel } from "@/lib/warehouse/delivery-carriers";

export {
  isMonthlySummaryAvailable,
  monthKeyFromDate,
  monthLabelFromKey,
  previousMonthKeyFromDate,
  previousMonthKeyFromMonthKey,
  nextMonthKeyFromMonthKey,
  defaultMonthlySummaryMonthKey,
  currentMonthKeyFromDate,
  isCompletedMonthlySummaryMonth,
  resolveCompletedMonthlySummaryMonthKey,
  momChange,
  shareOfTotal,
  allocatePercentageShares,
  salesTotalsFromStats,
  salesPersonSuccessRate,
  sortSalesRanking,
  buildMonthlyMomComparison,
  MONTHLY_STATS_ACTION_AT_HINT,
} from "@/lib/data/monthly-stats-shared";
export type {
  DeliveryMonthlyStat,
  DeliveryShipmentFormStat,
  MomChange,
  MonthlyMomComparison,
  MonthlyStatCard,
  MonthlyStats,
  MonthlySummaryTab,
  ProcurementMonthlyStat,
  ProcurementSupplierStat,
  SalesPersonMonthlyStat,
  SalesRankingSort,
  TeethMonthlyStat,
} from "@/lib/data/monthly-stats-shared";

function monthEndDateString(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}

function warsawOffsetForMonth(key: string): string {
  const [, monthStr] = key.split("-");
  const month = Number(monthStr);
  const isDST = month >= 4 && month <= 9;
  if (month === 10) return "+02:00";
  if (month === 3) return "+01:00";
  return isDST ? "+02:00" : "+01:00";
}

function warsawMonthStart(key: string): string {
  return `${key}-01T00:00:00${warsawOffsetForMonth(key)}`;
}

/** Klucz miesiąca YYYY-MM w Europe/Warsaw (DST-aware). */
function warsawMonthKeyFromISO(iso: string): string {
  return warsawDateKeyFromIso(iso).slice(0, 7);
}

function warsawMonthEnd(key: string): string {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (isNaN(year) || isNaN(month)) return new Date().toISOString();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  return `${nextKey}-01T00:00:00${warsawOffsetForMonth(nextKey)}`;
}

function assertNoError(label: string, error: { message: string } | null): void {
  if (error) {
    throw new Error(`Podsumowanie miesiąca — ${label}: ${error.message}`);
  }
}

/** Limit strony PostgREST / Supabase — bez .range wyniki są ucinane po cichu. */
const SUPABASE_PAGE = 1000;

/**
 * Pobiera wszystkie wiersze zapytania stronicując po {@link SUPABASE_PAGE}.
 * `build` musi zwracać świeży builder z tymi samymi filtrami (range dokładany tutaj).
 */
async function fetchAllPaged<T>(
  label: string,
  // PostgREST builder jest thenable po .range — typ generyczny z joinów jest zbyt wąski.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => { range: (from: number, to: number) => any }
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const res = await build().range(offset, offset + SUPABASE_PAGE - 1);
    assertNoError(label, res.error ?? null);
    const batch = (res.data ?? []) as T[];
    out.push(...batch);
    if (batch.length < SUPABASE_PAGE) break;
    offset += SUPABASE_PAGE;
  }
  return out;
}

function emptyDepartments(): {
  sales: SalesPersonMonthlyStat[];
  delivery: DeliveryMonthlyStat;
  procurement: ProcurementMonthlyStat;
  teeth: TeethMonthlyStat;
} {
  return {
    sales: [],
    delivery: { ...EMPTY_DELIVERY_STATS },
    procurement: { ...EMPTY_PROCUREMENT_STATS },
    teeth: { ...EMPTY_TEETH_STATS },
  };
}

const SUPPLIER_RANK_LIMIT = 15;

function bucketSuppliers(
  entries: { supplierId: string; supplierName: string; orders: number; completed: number }[]
): ProcurementSupplierStat[] {
  const sorted = [...entries].sort((a, b) => b.orders - a.orders);
  if (sorted.length <= SUPPLIER_RANK_LIMIT) return sorted;
  const head = sorted.slice(0, SUPPLIER_RANK_LIMIT);
  const rest = sorted.slice(SUPPLIER_RANK_LIMIT);
  const remainder: ProcurementSupplierStat = {
    supplierId: "__remainder__",
    supplierName: `Pozostałe dostawcy (${rest.length})`,
    orders: rest.reduce((sum, s) => sum + s.orders, 0),
    completed: rest.reduce((sum, s) => sum + s.completed, 0),
    isRemainder: true,
  };
  return [...head, remainder];
}

function shipmentFormBucket(form: string): DeliveryShipmentFormStat["form"] {
  if (form === "paczki" || form === "palety" || form === "paczki_i_palety") return form;
  return "inne";
}

export async function fetchAvailableMonths(limit = 12): Promise<{ key: string; label: string }[]> {
  if (!hasSupabaseConfig()) {
    const now = new Date();
    return Array.from({ length: Math.min(limit, 6) }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
      const key = monthKeyFromDate(d);
      return { key, label: monthLabelFromKey(key) };
    });
  }
  const supabase = createAdminClient();
  const months = new Set<string>();
  // Najnowsze najpierw — stronicuj aż zbierzemy `limit` ukończonych miesięcy (lub koniec danych).
  const maxPages = 20;
  for (let page = 0; page < maxPages; page++) {
    const offset = page * SUPABASE_PAGE;
    const ordersRes = await supabase
      .from("individual_orders")
      .select("action_at")
      .order("action_at", { ascending: false })
      .range(offset, offset + SUPABASE_PAGE - 1);
    assertNoError("lista miesięcy (prośby)", ordersRes.error);
    const batch = ordersRes.data ?? [];
    for (const row of batch) {
      const iso = (row as { action_at: string }).action_at;
      if (!iso) continue;
      const key = warsawMonthKeyFromISO(iso);
      if (!isCompletedMonthlySummaryMonth(key)) continue;
      months.add(key);
    }
    if (batch.length < SUPABASE_PAGE) break;
    if (months.size >= limit) break;
  }
  for (let page = 0; page < maxPages; page++) {
    const offset = page * SUPABASE_PAGE;
    const receiptsRes = await supabase
      .from("warehouse_delivery_receipts")
      .select("received_date")
      .order("received_date", { ascending: false })
      .range(offset, offset + SUPABASE_PAGE - 1);
    assertNoError("lista miesięcy (przyjęcia)", receiptsRes.error);
    const batch = receiptsRes.data ?? [];
    for (const row of batch) {
      const date = (row as { received_date: string }).received_date;
      if (!date || date.length < 7) continue;
      const key = date.slice(0, 7);
      if (!isCompletedMonthlySummaryMonth(key)) continue;
      months.add(key);
    }
    if (batch.length < SUPABASE_PAGE) break;
    if (months.size >= limit) break;
  }

  months.add(defaultMonthlySummaryMonthKey());

  const sorted = [...months]
    .filter((key) => isCompletedMonthlySummaryMonth(key))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);
  return sorted.map((key) => ({ key, label: monthLabelFromKey(key) }));
}

async function fetchMonthDepartments(monthKey: string): Promise<{
  sales: SalesPersonMonthlyStat[];
  delivery: DeliveryMonthlyStat;
  procurement: ProcurementMonthlyStat;
  teeth: TeethMonthlyStat;
}> {
  if (!hasSupabaseConfig()) return emptyDepartments();

  const supabase = createAdminClient();
  const wawStart = warsawMonthStart(monthKey);
  const wawEnd = warsawMonthEnd(monthKey);

  type OrderRow = {
    id: string;
    sales_person_id: string;
    request_kind: string;
    status: string;
    order_type: string | null;
    action_at: string;
    delivery_at: string | null;
    ordered_at: string | null;
    teeth_ordered_at: string | null;
    supplier_id: string | null;
    is_teeth: boolean | null;
    supplier: { name: string } | null;
  };
  type ReceiptRow = {
    id: string;
    carrier: string;
    shipment_form: string;
    package_count: number;
    pallet_count: number;
    received_date: string;
    supplier_id: string | null;
    supplier: { name: string } | null;
  };
  type ZkRow = { id: string; sales_person_id: string };

  const [orders, zkClosedRows, zkOpenRows, receipts, salesPeopleRes, teethOrderedRes] =
    await Promise.all([
      fetchAllPaged<OrderRow>("prośby", () =>
        supabase
          .from("individual_orders")
          .select(
            "id, sales_person_id, request_kind, status, order_type, action_at, delivery_at, ordered_at, teeth_ordered_at, supplier_id, is_teeth, supplier:suppliers(name)"
          )
          .gte("action_at", wawStart)
          .lt("action_at", wawEnd)
      ),
      fetchAllPaged<ZkRow>("ZK zamknięte", () =>
        supabase
          .from("sales_zk_watches")
          .select("id, sales_person_id")
          .gte("closed_at", wawStart)
          .lt("closed_at", wawEnd)
      ),
      fetchAllPaged<ZkRow>("ZK otwarte", () =>
        supabase
          .from("sales_zk_watches")
          .select("id, sales_person_id")
          .lt("created_at", wawEnd)
          .or(`closed_at.is.null,closed_at.gte.${wawEnd}`)
          .or(`archived_at.is.null,archived_at.gte.${wawEnd}`)
      ),
      fetchAllPaged<ReceiptRow>("przyjęcia", () =>
        supabase
          .from("warehouse_delivery_receipts")
          .select(
            "id, carrier, shipment_form, package_count, pallet_count, received_date, supplier_id, supplier:suppliers(name)"
          )
          .gte("received_date", `${monthKey}-01`)
          .lte("received_date", monthEndDateString(monthKey))
      ),
      supabase.from("sales_people").select("id, name, email").order("name"),
      supabase
        .from("individual_orders")
        .select("id", { count: "exact", head: true })
        .eq("is_teeth", true)
        .neq("request_kind", "informacja")
        .gte("teeth_ordered_at", wawStart)
        .lt("teeth_ordered_at", wawEnd),
    ]);

  assertNoError("handlowcy", salesPeopleRes.error);
  assertNoError("zęby zamówione", teethOrderedRes.error);

  const salesPeople = (salesPeopleRes.data ?? []) as Array<{
    id: string;
    name: string;
    email: string;
  }>;

  const zkClosedByPerson = new Map<string, number>();
  for (const zk of zkClosedRows) {
    zkClosedByPerson.set(zk.sales_person_id, (zkClosedByPerson.get(zk.sales_person_id) ?? 0) + 1);
  }
  const zkOpenByPerson = new Map<string, number>();
  for (const zk of zkOpenRows) {
    zkOpenByPerson.set(zk.sales_person_id, (zkOpenByPerson.get(zk.sales_person_id) ?? 0) + 1);
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

  function ensureSalesPerson(id: string): SalesPersonMonthlyStat {
    let stat = salesMap.get(id);
    if (!stat) {
      stat = {
        salesPersonId: id,
        salesPersonName: "Nieznany handlowiec",
        requestsCreated: 0,
        requestsCompleted: 0,
        requestsCancelled: 0,
        zkClosed: zkClosedByPerson.get(id) ?? 0,
        zkOpen: zkOpenByPerson.get(id) ?? 0,
      };
      salesMap.set(id, stat);
    }
    return stat;
  }

  const nonTeethOrders = orders.filter((o) => !o.is_teeth);
  const teethOrders = orders.filter((o) => Boolean(o.is_teeth));

  for (const order of nonTeethOrders) {
    if (order.request_kind === "informacja") continue;
    const stat = ensureSalesPerson(order.sales_person_id);
    stat.requestsCreated++;
    if (order.status === "Zrealizowane") stat.requestsCompleted++;
    if (order.status === "Anulowane") stat.requestsCancelled++;
  }

  // Handlowcy tylko z ZK, bez próśb w miesiącu
  for (const [id, closed] of zkClosedByPerson) {
    if (closed > 0) ensureSalesPerson(id);
  }
  for (const [id, open] of zkOpenByPerson) {
    if (open > 0) ensureSalesPerson(id);
  }

  const sales = [...salesMap.values()]
    .filter((s) => s.salesPersonName !== "STAN")
    .filter((s) => s.requestsCreated > 0 || s.zkClosed > 0 || s.zkOpen > 0)
    .sort((a, b) => b.requestsCreated - a.requestsCreated);

  const delivery: DeliveryMonthlyStat = {
    totalReceipts: receipts.length,
    totalPackages: 0,
    totalPallets: 0,
    byCarrier: [],
    byShipmentForm: [],
  };
  const carrierMap = new Map<string, { count: number; packages: number; pallets: number }>();
  const formMap = new Map<DeliveryShipmentFormStat["form"], number>();
  for (const r of receipts) {
    delivery.totalPackages += r.package_count;
    delivery.totalPallets += r.pallet_count;
    const existing = carrierMap.get(r.carrier) ?? { count: 0, packages: 0, pallets: 0 };
    existing.count++;
    existing.packages += r.package_count;
    existing.pallets += r.pallet_count;
    carrierMap.set(r.carrier, existing);
    const form = shipmentFormBucket(r.shipment_form);
    formMap.set(form, (formMap.get(form) ?? 0) + 1);
  }
  delivery.byCarrier = [...carrierMap.entries()]
    .map(([carrier, v]) => ({ carrier, ...v }))
    .sort((a, b) => b.count - a.count);
  delivery.byShipmentForm = (
    ["paczki", "palety", "paczki_i_palety", "inne"] as const
  )
    .filter((form) => (formMap.get(form) ?? 0) > 0)
    .map((form) => ({
      form,
      label: form === "inne" ? "Inne" : warehouseShipmentFormLabel(form),
      count: formMap.get(form) ?? 0,
    }));

  const zamowienia = nonTeethOrders.filter((o) => o.request_kind === "zamowienie");
  const completed = zamowienia.filter((o) => o.status === "Zrealizowane");
  const cancelled = zamowienia.filter((o) => o.status === "Anulowane");
  const informacja = nonTeethOrders.filter((o) => o.request_kind === "informacja");

  let avgDeliveryDays: number | null = null;
  let avgDeliverySampleSize = 0;
  if (completed.length > 0) {
    let totalDays = 0;
    for (const o of completed) {
      if (!o.ordered_at || !o.delivery_at) continue;
      const ordered = new Date(o.ordered_at);
      const delivered = new Date(o.delivery_at);
      const diff = Math.round(
        (delivered.getTime() - ordered.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff >= 0) {
        totalDays += diff;
        avgDeliverySampleSize++;
      }
    }
    if (avgDeliverySampleSize > 0) {
      avgDeliveryDays = Math.round(totalDays / avgDeliverySampleSize);
    }
  }

  const supplierMap = new Map<string, { name: string; orders: number; completed: number }>();
  let ordersWithoutSupplier = 0;
  let completedWithoutSupplier = 0;
  for (const o of zamowienia) {
    if (!o.supplier_id) {
      ordersWithoutSupplier++;
      if (o.status === "Zrealizowane") completedWithoutSupplier++;
      continue;
    }
    const name = o.supplier?.name ?? "Nieznany dostawca";
    const existing = supplierMap.get(o.supplier_id) ?? { name, orders: 0, completed: 0 };
    existing.orders++;
    if (o.status === "Zrealizowane") existing.completed++;
    supplierMap.set(o.supplier_id, existing);
  }
  const supplierEntries = [...supplierMap.entries()].map(([supplierId, v]) => ({
    supplierId,
    supplierName: v.name,
    orders: v.orders,
    completed: v.completed,
  }));
  if (ordersWithoutSupplier > 0) {
    supplierEntries.push({
      supplierId: "__no_supplier__",
      supplierName: "Bez przypisanego dostawcy",
      orders: ordersWithoutSupplier,
      completed: completedWithoutSupplier,
    });
  }

  const procurement: ProcurementMonthlyStat = {
    totalOrders: zamowienia.length,
    mainOrders: zamowienia.filter((o) => o.order_type === "Glowne").length,
    sideOrders: zamowienia.filter((o) => o.order_type === "Poboczne").length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    informacjaCount: informacja.length,
    avgDeliveryDays,
    avgDeliverySampleSize,
    bySupplier: bucketSuppliers(supplierEntries),
  };

  const teethCreated = teethOrders.filter((o) => o.request_kind !== "informacja");
  const teethCompleted = teethCreated.filter((o) => o.status === "Zrealizowane");
  const teethCancelled = teethCreated.filter((o) => o.status === "Anulowane");

  // Zamówione do dostawcy w tym miesiącu (nawet jeśli action_at było wcześniej)
  const teethOrderedCount = teethOrderedRes.count ?? 0;

  let avgLeadDays: number | null = null;
  let avgLeadSampleSize = 0;
  let leadSum = 0;
  for (const o of teethCompleted) {
    const start = o.teeth_ordered_at ?? o.ordered_at;
    if (!start || !o.delivery_at) continue;
    const diff = Math.round(
      (new Date(o.delivery_at).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff >= 0) {
      leadSum += diff;
      avgLeadSampleSize++;
    }
  }
  if (avgLeadSampleSize > 0) avgLeadDays = Math.round(leadSum / avgLeadSampleSize);

  const teethSupplierMap = new Map<string, { name: string; orders: number; completed: number }>();
  let teethOrdersWithoutSupplier = 0;
  let teethCompletedWithoutSupplier = 0;
  for (const o of teethCreated) {
    if (!o.supplier_id) {
      teethOrdersWithoutSupplier++;
      if (o.status === "Zrealizowane") teethCompletedWithoutSupplier++;
      continue;
    }
    const name = o.supplier?.name ?? "Nieznany dostawca";
    const existing = teethSupplierMap.get(o.supplier_id) ?? { name, orders: 0, completed: 0 };
    existing.orders++;
    if (o.status === "Zrealizowane") existing.completed++;
    teethSupplierMap.set(o.supplier_id, existing);
  }

  const teethSupplierEntries = [...teethSupplierMap.entries()].map(([supplierId, v]) => ({
    supplierId,
    supplierName: v.name,
    orders: v.orders,
    completed: v.completed,
  }));
  if (teethOrdersWithoutSupplier > 0) {
    teethSupplierEntries.push({
      supplierId: "__no_supplier__",
      supplierName: "Bez przypisanego dostawcy",
      orders: teethOrdersWithoutSupplier,
      completed: teethCompletedWithoutSupplier,
    });
  }

  const teeth: TeethMonthlyStat = {
    requestsCreated: teethCreated.length,
    ordered: teethOrderedCount,
    completed: teethCompleted.length,
    cancelled: teethCancelled.length,
    avgLeadDays,
    avgLeadSampleSize,
    bySupplier: bucketSuppliers(teethSupplierEntries),
  };

  return { sales, delivery, procurement, teeth };
}

/**
 * Lekkie agregaty poprzedniego miesiąca pod MoM — bez handlowców, kurierów i dostawców.
 * Mniej joinów i bez budowy rankingów (wystarczą sumy do badge’y Δ).
 * ZK i prośby sprzedaży bez STAN — spójnie z totalsFromDepartments(current).
 */
async function fetchMonthTotalsOnly(monthKey: string) {
  if (!hasSupabaseConfig()) {
    return totalsFromDepartments(emptyDepartments());
  }

  const supabase = createAdminClient();
  const wawStart = warsawMonthStart(monthKey);
  const wawEnd = warsawMonthEnd(monthKey);

  type OrderMomRow = {
    request_kind: string;
    status: string;
    ordered_at: string | null;
    delivery_at: string | null;
    teeth_ordered_at: string | null;
    is_teeth: boolean | null;
    sales_person_id: string;
  };
  type ZkMomRow = { sales_person_id: string };
  type ReceiptMomRow = { package_count: number; pallet_count: number };

  const [orders, zkClosedRows, zkOpenRows, receipts, salesPeopleRes, teethOrderedRes] =
    await Promise.all([
      fetchAllPaged<OrderMomRow>("MoM prośby", () =>
        supabase
          .from("individual_orders")
          .select(
            "request_kind, status, ordered_at, delivery_at, teeth_ordered_at, is_teeth, sales_person_id"
          )
          .gte("action_at", wawStart)
          .lt("action_at", wawEnd)
      ),
      fetchAllPaged<ZkMomRow>("MoM ZK zamknięte", () =>
        supabase
          .from("sales_zk_watches")
          .select("sales_person_id")
          .gte("closed_at", wawStart)
          .lt("closed_at", wawEnd)
      ),
      fetchAllPaged<ZkMomRow>("MoM ZK otwarte", () =>
        supabase
          .from("sales_zk_watches")
          .select("sales_person_id")
          .lt("created_at", wawEnd)
          .or(`closed_at.is.null,closed_at.gte.${wawEnd}`)
          .or(`archived_at.is.null,archived_at.gte.${wawEnd}`)
      ),
      fetchAllPaged<ReceiptMomRow>("MoM przyjęcia", () =>
        supabase
          .from("warehouse_delivery_receipts")
          .select("package_count, pallet_count")
          .gte("received_date", `${monthKey}-01`)
          .lte("received_date", monthEndDateString(monthKey))
      ),
      supabase.from("sales_people").select("id, name"),
      supabase
        .from("individual_orders")
        .select("id", { count: "exact", head: true })
        .eq("is_teeth", true)
        .neq("request_kind", "informacja")
        .gte("teeth_ordered_at", wawStart)
        .lt("teeth_ordered_at", wawEnd),
    ]);

  assertNoError("MoM handlowcy", salesPeopleRes.error);
  assertNoError("MoM zęby zamówione", teethOrderedRes.error);

  const stanIds = new Set(
    ((salesPeopleRes.data ?? []) as Array<{ id: string; name: string }>)
      .filter((sp) => sp.name === "STAN")
      .map((sp) => sp.id)
  );

  let salesRequestsCreated = 0;
  let salesRequestsCompleted = 0;
  let procurementOrders = 0;
  let procurementCompleted = 0;
  let teethRequestsCreated = 0;
  let teethCompleted = 0;
  let avgSum = 0;
  let avgSample = 0;

  for (const o of orders) {
    if (o.is_teeth) {
      if (o.request_kind === "informacja") continue;
      teethRequestsCreated++;
      if (o.status === "Zrealizowane") teethCompleted++;
      continue;
    }
    if (o.request_kind === "informacja") continue;
    if (!stanIds.has(o.sales_person_id)) {
      salesRequestsCreated++;
      if (o.status === "Zrealizowane") salesRequestsCompleted++;
    }
    if (o.request_kind === "zamowienie") {
      procurementOrders++;
      if (o.status === "Zrealizowane") {
        procurementCompleted++;
        if (o.ordered_at && o.delivery_at) {
          const diff = Math.round(
            (new Date(o.delivery_at).getTime() - new Date(o.ordered_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (diff >= 0) {
            avgSum += diff;
            avgSample++;
          }
        }
      }
    }
  }

  const zkClosed = zkClosedRows.filter((r) => !stanIds.has(r.sales_person_id)).length;
  const zkOpen = zkOpenRows.filter((r) => !stanIds.has(r.sales_person_id)).length;

  return {
    salesRequestsCreated,
    salesRequestsCompleted,
    salesSuccessRate:
      salesRequestsCreated > 0
        ? Math.round((salesRequestsCompleted / salesRequestsCreated) * 100)
        : 0,
    zkClosed,
    zkOpen,
    deliveryReceipts: receipts.length,
    deliveryPackages: receipts.reduce((s, r) => s + r.package_count, 0),
    deliveryPallets: receipts.reduce((s, r) => s + r.pallet_count, 0),
    procurementOrders,
    procurementCompleted,
    procurementSuccessRate:
      procurementOrders > 0
        ? Math.round((procurementCompleted / procurementOrders) * 100)
        : 0,
    procurementAvgDeliveryDays:
      avgSample > 0 ? Math.round(avgSum / avgSample) : null,
    teethRequestsCreated,
    teethOrdered: teethOrderedRes.count ?? 0,
    teethCompleted,
    teethSuccessRate:
      teethRequestsCreated > 0
        ? Math.round((teethCompleted / teethRequestsCreated) * 100)
        : 0,
  };
}

export async function fetchMonthlyStats(monthKey: string): Promise<MonthlyStats> {
  const previousKey = previousMonthKeyFromMonthKey(monthKey);

  const [availableMonths, current, previousTotals] = await Promise.all([
    fetchAvailableMonths(),
    fetchMonthDepartments(monthKey),
    fetchMonthTotalsOnly(previousKey),
  ]);

  const currentTotals = totalsFromDepartments(current);

  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    sales: current.sales,
    delivery: current.delivery,
    procurement: current.procurement,
    teeth: current.teeth,
    availableMonths,
    mom: buildMonthlyMomComparison(monthKey, currentTotals, previousTotals),
  };
}
