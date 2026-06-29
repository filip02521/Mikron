import { startOfWeek, addDays } from "date-fns";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  fetchCarrierHintsForSuppliers,
  type WarehouseCarrierHint,
} from "@/lib/warehouse/delivery-receipts";
import {
  warehouseCarrierLabel,
} from "@/lib/warehouse/delivery-carriers";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import type { IndividualOrder } from "@/types/database";

export type UpcomingDeliveryRangePreset = "week" | "7days" | "14days";

export type UpcomingDeliverySalesPerson = {
  id: string;
  name: string;
  orderCount: number;
};

export type UpcomingDeliverySupplier = {
  supplierId: string;
  supplierName: string;
  zdDocNumber: string | null;
  positionCount: number;
  totalQuantity: number;
  totalDelivered: number;
  salesPeople: UpcomingDeliverySalesPerson[];
  carrierHint: WarehouseCarrierHint | null;
  carrierLabel: string | null;
  orders: IndividualOrder[];
  /** ZD z indeksu bez dopasowanego zamówienia (tylko z Subiekta). */
  zdOnlyDocNumbers: string[];
};

export type UpcomingDeliveryDay = {
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string;
  isToday: boolean;
  isOverdue: boolean;
  suppliers: UpcomingDeliverySupplier[];
};

export type UpcomingDeliverySummary = {
  dayCount: number;
  supplierCount: number;
  positionCount: number;
  estimatedPackages: number;
  estimatedPallets: number;
};

export function upcomingDeliveryPresetRange(
  preset: UpcomingDeliveryRangePreset,
  at: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const today = todayInWarsaw(at);
  switch (preset) {
    case "week": {
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      const sunday = addDays(monday, 6);
      return { dateFrom: formatDateString(monday), dateTo: formatDateString(sunday) };
    }
    case "7days": {
      const end = addDays(today, 6);
      return { dateFrom: formatDateString(today), dateTo: formatDateString(end) };
    }
    case "14days": {
      const end = addDays(today, 13);
      return { dateFrom: formatDateString(today), dateTo: formatDateString(end) };
    }
    default:
      return { dateFrom: formatDateString(today), dateTo: formatDateString(today) };
  }
}

const WEEKDAYS_PL = [
  "niedziela",
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
];

const MONTHS_PL = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

function formatDayLabel(dateKey: string): string {
  const d = parseDateOnly(dateKey);
  if (!d) return dateKey;
  const day = d.getDate();
  const month = MONTHS_PL[d.getMonth()] ?? "";
  return `${day} ${month}`;
}

function formatWeekdayLabel(dateKey: string): string {
  const d = parseDateOnly(dateKey);
  if (!d) return "";
  return WEEKDAYS_PL[d.getDay()] ?? "";
}

function parseQty(value: string | null | undefined): number {
  if (!value) return 0;
  const q = parseInt(value, 10);
  return isNaN(q) ? 0 : q;
}

export async function fetchUpcomingDeliveries(
  dateFrom: string,
  dateTo: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveryDay[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const todayKey = formatDateString(todayInWarsaw());

  const [rangeRes, overdueRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .is("sales_acknowledged_at", null)
      .not("supplier_id", "is", null)
      .not("zd_fulfillment_deadline", "is", null)
      .gte("zd_fulfillment_deadline", dateFrom)
      .lte("zd_fulfillment_deadline", dateTo)
      .order("zd_fulfillment_deadline", { ascending: true })
      .order("supplier_id", { ascending: true }),
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .is("sales_acknowledged_at", null)
      .not("supplier_id", "is", null)
      .not("zd_fulfillment_deadline", "is", null)
      .lt("zd_fulfillment_deadline", todayKey)
      .order("zd_fulfillment_deadline", { ascending: true })
      .order("supplier_id", { ascending: true }),
  ]);

  if (rangeRes.error) {
    if (rangeRes.error.message?.includes("sales_acknowledged_at")) {
      return fetchUpcomingDeliveriesLegacy(dateFrom, dateTo, todayKey, carriers);
    }
    throw new Error(rangeRes.error.message);
  }
  if (overdueRes.error) {
    if (overdueRes.error.message?.includes("sales_acknowledged_at")) {
      return fetchUpcomingDeliveriesLegacy(dateFrom, dateTo, todayKey, carriers);
    }
    throw new Error(overdueRes.error.message);
  }

  const rangeOrders = normalizeIndividualOrders(rangeRes.data ?? []);
  const overdueOrders = normalizeIndividualOrders(overdueRes.data ?? []);

  const allOrders = [...overdueOrders, ...rangeOrders];
  const orderDays = await groupUpcomingDeliveries(allOrders, todayKey, carriers);
  return mergeZdIndexDeliveries(orderDays, dateFrom, dateTo, todayKey, carriers);
}

async function fetchUpcomingDeliveriesLegacy(
  dateFrom: string,
  dateTo: string,
  todayKey: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveryDay[]> {
  const supabase = createAdminClient();
  const [rangeRes, overdueRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .not("supplier_id", "is", null)
      .not("zd_fulfillment_deadline", "is", null)
      .gte("zd_fulfillment_deadline", dateFrom)
      .lte("zd_fulfillment_deadline", dateTo)
      .order("zd_fulfillment_deadline", { ascending: true })
      .order("supplier_id", { ascending: true }),
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .not("supplier_id", "is", null)
      .not("zd_fulfillment_deadline", "is", null)
      .lt("zd_fulfillment_deadline", todayKey)
      .order("zd_fulfillment_deadline", { ascending: true })
      .order("supplier_id", { ascending: true }),
  ]);

  if (rangeRes.error) throw new Error(rangeRes.error.message);
  if (overdueRes.error) throw new Error(overdueRes.error.message);

  const rangeOrders = normalizeIndividualOrders(rangeRes.data ?? []);
  const overdueOrders = normalizeIndividualOrders(overdueRes.data ?? []);

  const allOrders = [...overdueOrders, ...rangeOrders];
  const orderDays = await groupUpcomingDeliveries(allOrders, todayKey, carriers);
  return mergeZdIndexDeliveries(orderDays, dateFrom, dateTo, todayKey, carriers);
}

export async function groupUpcomingDeliveries(
  orders: IndividualOrder[],
  todayKey: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveryDay[]> {
  const byDate = new Map<string, IndividualOrder[]>();
  for (const order of orders) {
    const deadline = order.zd_fulfillment_deadline?.trim();
    if (!deadline) continue;
    const list = byDate.get(deadline) ?? [];
    list.push(order);
    byDate.set(deadline, list);
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));

  const allSupplierIds = new Set<string>();
  for (const dayOrders of byDate.values()) {
    for (const order of dayOrders) {
      if (order.supplier_id) allSupplierIds.add(order.supplier_id);
    }
  }

  let hintMap = new Map<string, WarehouseCarrierHint>();
  try {
    hintMap = await fetchCarrierHintsForSuppliers([...allSupplierIds]);
  } catch {
    hintMap = new Map();
  }

  const days: UpcomingDeliveryDay[] = [];
  for (const dateKey of sortedDates) {
    const dayOrders = byDate.get(dateKey)!;
    const suppliers = groupBySupplier(dayOrders, hintMap, carriers);
    days.push({
      dateKey,
      dateLabel: formatDayLabel(dateKey),
      weekdayLabel: formatWeekdayLabel(dateKey),
      isToday: dateKey === todayKey,
      isOverdue: dateKey < todayKey,
      suppliers,
    });
  }

  return days;
}

function groupBySupplier(
  orders: IndividualOrder[],
  hintMap: Map<string, WarehouseCarrierHint>,
  carriers?: WarehouseCarrierRow[]
): UpcomingDeliverySupplier[] {
  const bySupplier = new Map<string, IndividualOrder[]>();
  for (const order of orders) {
    const supplierId = order.supplier_id;
    if (!supplierId) continue;
    const list = bySupplier.get(supplierId) ?? [];
    list.push(order);
    bySupplier.set(supplierId, list);
  }

  const result: UpcomingDeliverySupplier[] = [];
  for (const [supplierId, supplierOrders] of bySupplier) {
    const supplierName = supplierOrders[0]?.supplier?.name ?? "—";
    const zdDocNumber = supplierOrders.find((o) => o.zd_fulfillment_dok_nr?.trim())?.zd_fulfillment_dok_nr ?? null;
    const positionCount = supplierOrders.length;
    const totalQuantity = supplierOrders.reduce((sum, o) => sum + parseQty(o.quantity), 0);
    const totalDelivered = supplierOrders.reduce((sum, o) => sum + parseQty(o.delivered_quantity), 0);

    const salesPeopleMap = new Map<string, UpcomingDeliverySalesPerson>();
    for (const o of supplierOrders) {
      const spId = o.sales_person_id;
      const spName = o.sales_person?.name ?? spId;
      const existing = salesPeopleMap.get(spId);
      if (existing) {
        existing.orderCount++;
      } else {
        salesPeopleMap.set(spId, { id: spId, name: spName, orderCount: 1 });
      }
    }
    const salesPeople = [...salesPeopleMap.values()].sort((a, b) => a.name.localeCompare(b.name));

    const carrierHint = hintMap.get(supplierId) ?? null;
    const carrierLabel = carrierHint
      ? warehouseCarrierLabel(carrierHint.carrier, carriers)
      : null;

    result.push({
      supplierId,
      supplierName,
      zdDocNumber,
      positionCount,
      totalQuantity,
      totalDelivered,
      salesPeople,
      carrierHint,
      carrierLabel,
      orders: supplierOrders,
      zdOnlyDocNumbers: [],
    });
  }

  return result.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export function summarizeUpcomingDeliveries(
  days: UpcomingDeliveryDay[]
): UpcomingDeliverySummary {
  const supplierIds = new Set<string>();
  let positionCount = 0;
  let estimatedPackages = 0;
  let estimatedPallets = 0;

  for (const day of days) {
    for (const supplier of day.suppliers) {
      supplierIds.add(supplier.supplierId);
      positionCount += supplier.positionCount;
      if (supplier.carrierHint) {
        estimatedPackages += supplier.carrierHint.typicalPackageCount;
        estimatedPallets += supplier.carrierHint.typicalPalletCount;
      }
    }
  }

  return {
    dayCount: days.length,
    supplierCount: supplierIds.size,
    positionCount,
    estimatedPackages,
    estimatedPallets,
  };
}

type ZdIndexRow = {
  dok_nr_pelny: string | null;
  supplier_id: string;
  dok_termin_realizacji: string;
};

async function fetchZdIndexDeliveries(
  dateFrom: string,
  dateTo: string,
  todayKey: string
): Promise<Map<string, Map<string, string[]>>> {
  const supabase = createAdminClient();
  const [rangeRes, overdueRes] = await Promise.all([
    supabase
      .from("subiekt_zd_index")
      .select("dok_nr_pelny, supplier_id, dok_status, dok_termin_realizacji")
      .not("supplier_id", "is", null)
      .not("dok_termin_realizacji", "is", null)
      .in("dok_status", [5, 6, 7])
      .gte("dok_termin_realizacji", dateFrom)
      .lte("dok_termin_realizacji", dateTo)
      .limit(500),
    supabase
      .from("subiekt_zd_index")
      .select("dok_nr_pelny, supplier_id, dok_status, dok_termin_realizacji")
      .not("supplier_id", "is", null)
      .not("dok_termin_realizacji", "is", null)
      .in("dok_status", [5, 6, 7])
      .lt("dok_termin_realizacji", todayKey)
      .limit(200),
  ]);

  if (rangeRes.error) return new Map();
  if (overdueRes.error) return new Map();

  const rows = [
    ...(overdueRes.data ?? []),
    ...(rangeRes.data ?? []),
  ] as ZdIndexRow[];

  const byDateBySupplier = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    if (!row.supplier_id || !row.dok_termin_realizacji) continue;
    if (!row.dok_nr_pelny) continue;
    const dateKey = row.dok_termin_realizacji;
    const bySupplier = byDateBySupplier.get(dateKey) ?? new Map<string, string[]>();
    const docSet = bySupplier.get(row.supplier_id) ?? [];
    if (!docSet.includes(row.dok_nr_pelny)) docSet.push(row.dok_nr_pelny);
    bySupplier.set(row.supplier_id, docSet);
    byDateBySupplier.set(dateKey, bySupplier);
  }

  return byDateBySupplier;
}

async function fetchSupplierNames(
  supplierIds: string[]
): Promise<Map<string, string>> {
  if (!supplierIds.length) return new Map();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .in("id", supplierIds);
  if (error) return new Map();
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(String(row.id), String(row.name));
  }
  return map;
}

async function mergeZdIndexDeliveries(
  orderDays: UpcomingDeliveryDay[],
  dateFrom: string,
  dateTo: string,
  todayKey: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveryDay[]> {
  let zdIndexMap: Map<string, Map<string, string[]>>;
  try {
    zdIndexMap = await fetchZdIndexDeliveries(dateFrom, dateTo, todayKey);
  } catch {
    return orderDays;
  }
  if (!zdIndexMap.size) return orderDays;

  const existingSuppliersByDate = new Map<string, Set<string>>();
  for (const day of orderDays) {
    existingSuppliersByDate.set(
      day.dateKey,
      new Set(day.suppliers.map((s) => s.supplierId))
    );
  }

  const trulyNewSupplierIds = new Set<string>();
  for (const [dateKey, bySupplier] of zdIndexMap) {
    const existing = existingSuppliersByDate.get(dateKey) ?? new Set<string>();
    for (const sid of bySupplier.keys()) {
      if (!existing.has(sid)) trulyNewSupplierIds.add(sid);
    }
  }

  let hintMap = new Map<string, WarehouseCarrierHint>();
  if (trulyNewSupplierIds.size > 0) {
    try {
      hintMap = await fetchCarrierHintsForSuppliers([...trulyNewSupplierIds]);
    } catch {
      hintMap = new Map();
    }
  }

  let supplierNames = new Map<string, string>();
  if (trulyNewSupplierIds.size > 0) {
    try {
      supplierNames = await fetchSupplierNames([...trulyNewSupplierIds]);
    } catch {
      supplierNames = new Map();
    }
  }

  for (const [dateKey, bySupplier] of zdIndexMap) {
    let day = orderDays.find((d) => d.dateKey === dateKey);
    if (!day) {
      day = {
        dateKey,
        dateLabel: formatDayLabel(dateKey),
        weekdayLabel: formatWeekdayLabel(dateKey),
        isToday: dateKey === todayKey,
        isOverdue: dateKey < todayKey,
        suppliers: [],
      };
      orderDays.push(day);
    }

    const existingSuppliers = existingSuppliersByDate.get(dateKey) ?? new Set<string>();

    for (const [supplierId, docNumbers] of bySupplier) {
      if (existingSuppliers.has(supplierId)) {
        const supplier = day.suppliers.find((s) => s.supplierId === supplierId);
        if (supplier) {
          const existingDocNumbers = new Set(
            supplier.orders
              .map((o) => o.zd_fulfillment_dok_nr)
              .filter((n): n is string => Boolean(n?.trim()))
          );
          for (const docNr of docNumbers) {
            if (!existingDocNumbers.has(docNr)) {
              supplier.zdOnlyDocNumbers.push(docNr);
            }
          }
        }
      } else {
        const supplierName = supplierNames.get(supplierId) ?? "—";
        const carrierHint = hintMap.get(supplierId) ?? null;
        const carrierLabel = carrierHint
          ? warehouseCarrierLabel(carrierHint.carrier, carriers)
          : null;
        day.suppliers.push({
          supplierId,
          supplierName,
          zdDocNumber: docNumbers[0] ?? null,
          positionCount: 0,
          totalQuantity: 0,
          totalDelivered: 0,
          salesPeople: [],
          carrierHint,
          carrierLabel,
          orders: [],
          zdOnlyDocNumbers: docNumbers,
        });
      }
    }

    day.suppliers.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }

  orderDays.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return orderDays;
}
