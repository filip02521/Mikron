import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  fetchCarrierHintsForSuppliers,
  type WarehouseCarrierHint,
} from "@/lib/warehouse/delivery-receipts";
import {
  searchDeliveryReceipts,
} from "@/lib/warehouse/delivery-journal-insights";
import {
  warehouseCarrierLabel,
} from "@/lib/warehouse/delivery-carriers";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import type { IndividualOrder } from "@/types/database";
import type {
  UpcomingDeliveryDay,
  UpcomingDeliverySalesPerson,
  UpcomingDeliverySupplier,
} from "@/lib/data/upcoming-deliveries-shared";
import { journalHasReceiptForDeadline } from "@/lib/data/upcoming-deliveries-shared";

export type {
  DeliveryScheduleDay,
  DeliveryScheduleSupplier,
  ExtendedDeliverySummary,
  UpcomingDeliveryDay,
  UpcomingDeliveryRangePreset,
  UpcomingDeliverySalesPerson,
  UpcomingDeliverySummary,
  UpcomingDeliverySupplier,
} from "@/lib/data/upcoming-deliveries-shared";
export {
  buildDeliveryScheduleWeek,
  buildDeliveryTodayDay,
  clearedSupplierIdsByDateFromPayload,
  hideScheduledReceivedToday,
  journalHasReceiptForDeadline,
  summarizeDeliverySchedule,
  summarizeUpcomingDeliveries,
  upcomingDeliveryPresetRange,
} from "@/lib/data/upcoming-deliveries-shared";

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

/** supplierId → daty przyjęcia (YYYY-MM-DD) z dziennika magazynu. */
type JournalReceiptIndex = Map<string, Set<string>>;

async function fetchJournalReceiptIndex(
  dateFrom: string,
  todayKey: string
): Promise<JournalReceiptIndex> {
  try {
    // Szersze okno wstecz: zaległe ZD sprzed początku tygodnia + przyjęcia z ostatnich dni.
    const fromDate = parseDateOnly(dateFrom);
    const lookbackStart = fromDate
      ? formatDateString(new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() - 21))
      : dateFrom;
    const receipts = await searchDeliveryReceipts({
      dateFrom: lookbackStart,
      dateTo: todayKey,
    });
    const index: JournalReceiptIndex = new Map();
    for (const r of receipts) {
      if (!r.supplierId || !r.receivedDate) continue;
      const set = index.get(r.supplierId) ?? new Set<string>();
      set.add(r.receivedDate);
      index.set(r.supplierId, set);
    }
    return index;
  } catch {
    return new Map();
  }
}

function supplierIdsReceivedOnDate(
  journalReceipts: JournalReceiptIndex,
  dateKey: string
): string[] {
  const ids: string[] = [];
  for (const [supplierId, dates] of journalReceipts) {
    if (dates.has(dateKey)) ids.push(supplierId);
  }
  return ids.sort();
}

export type UpcomingDeliveriesResult = {
  days: UpcomingDeliveryDay[];
  /** Dostawcy z wpisem dziennika przyjęć dokładnie na dziś. */
  receivedSupplierIdsToday: string[];
  /** Dostawcy w pełni odznaczeni dla danego terminu ZD (YYYY-MM-DD → ids). */
  clearedSupplierIdsByDate: Record<string, string[]>;
};

export async function fetchUpcomingDeliveries(
  dateFrom: string,
  dateTo: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveryDay[]> {
  const result = await fetchUpcomingDeliveriesWithMeta(dateFrom, dateTo, carriers);
  return result.days;
}

export async function fetchUpcomingDeliveriesWithMeta(
  dateFrom: string,
  dateTo: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveriesResult> {
  if (!hasSupabaseConfig()) {
    return { days: [], receivedSupplierIdsToday: [], clearedSupplierIdsByDate: {} };
  }

  const supabase = createAdminClient();
  const todayKey = formatDateString(todayInWarsaw());

  const [rangeRes, overdueRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Zrealizowane"])
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
      .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Zrealizowane"])
      .is("sales_cancelled_at", null)
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

  const seenOrderIds = new Set<string>();
  const allOrders = [...overdueOrders, ...rangeOrders].filter((o) => {
    if (seenOrderIds.has(o.id)) return false;
    seenOrderIds.add(o.id);
    return true;
  });
  const journalReceipts = await fetchJournalReceiptIndex(dateFrom, todayKey);
  const { days: orderDays, clearedSupplierIdsByDate, orderSupplierIdsByDate } =
    await groupUpcomingDeliveries(allOrders, todayKey, carriers, journalReceipts);
  const days = await mergeZdIndexDeliveries(
    orderDays,
    dateFrom,
    dateTo,
    todayKey,
    carriers,
    journalReceipts,
    clearedSupplierIdsByDate,
    orderSupplierIdsByDate
  );
  return {
    days,
    receivedSupplierIdsToday: supplierIdsReceivedOnDate(journalReceipts, todayKey),
    clearedSupplierIdsByDate: mapSetsToRecord(clearedSupplierIdsByDate),
  };
}

function mapSetsToRecord(map: Map<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, set] of map) {
    if (set.size > 0) out[key] = [...set].sort();
  }
  return out;
}

async function fetchUpcomingDeliveriesLegacy(
  dateFrom: string,
  dateTo: string,
  todayKey: string,
  carriers?: WarehouseCarrierRow[]
): Promise<UpcomingDeliveriesResult> {
  const supabase = createAdminClient();
  const [rangeRes, overdueRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Zrealizowane"])
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
      .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Zrealizowane"])
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

  const seenOrderIds = new Set<string>();
  const allOrders = [...overdueOrders, ...rangeOrders].filter((o) => {
    if (seenOrderIds.has(o.id)) return false;
    seenOrderIds.add(o.id);
    return true;
  });
  const journalReceipts = await fetchJournalReceiptIndex(dateFrom, todayKey);
  const { days: orderDays, clearedSupplierIdsByDate, orderSupplierIdsByDate } =
    await groupUpcomingDeliveries(allOrders, todayKey, carriers, journalReceipts);
  const days = await mergeZdIndexDeliveries(
    orderDays,
    dateFrom,
    dateTo,
    todayKey,
    carriers,
    journalReceipts,
    clearedSupplierIdsByDate,
    orderSupplierIdsByDate
  );
  return {
    days,
    receivedSupplierIdsToday: supplierIdsReceivedOnDate(journalReceipts, todayKey),
    clearedSupplierIdsByDate: mapSetsToRecord(clearedSupplierIdsByDate),
  };
}

export async function groupUpcomingDeliveries(
  orders: IndividualOrder[],
  todayKey: string,
  carriers?: WarehouseCarrierRow[],
  journalReceipts?: JournalReceiptIndex
): Promise<{
  days: UpcomingDeliveryDay[];
  clearedSupplierIdsByDate: Map<string, Set<string>>;
  orderSupplierIdsByDate: Map<string, Set<string>>;
}> {
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

  let hintMap: Map<string, WarehouseCarrierHint>;
  try {
    hintMap = await fetchCarrierHintsForSuppliers([...allSupplierIds]);
  } catch {
    hintMap = new Map();
  }

  const clearedSupplierIdsByDate = new Map<string, Set<string>>();
  const orderSupplierIdsByDate = new Map<string, Set<string>>();
  const days: UpcomingDeliveryDay[] = [];
  for (const dateKey of sortedDates) {
    const dayOrders = byDate.get(dateKey)!;
    const orderIds = new Set<string>();
    for (const o of dayOrders) {
      if (o.supplier_id) orderIds.add(o.supplier_id);
    }
    orderSupplierIdsByDate.set(dateKey, orderIds);

    const { suppliers, clearedIds } = groupBySupplier(
      dayOrders,
      hintMap,
      carriers,
      journalReceipts,
      dateKey,
      todayKey
    );
    if (clearedIds.length > 0) {
      clearedSupplierIdsByDate.set(dateKey, new Set(clearedIds));
    }
    days.push({
      dateKey,
      dateLabel: formatDayLabel(dateKey),
      weekdayLabel: formatWeekdayLabel(dateKey),
      isToday: dateKey === todayKey,
      isOverdue: dateKey < todayKey,
      suppliers,
    });
  }

  return { days, clearedSupplierIdsByDate, orderSupplierIdsByDate };
}

function effectiveDeliveredQty(order: IndividualOrder): number {
  const qty = parseQty(order.quantity);
  const delivered = parseQty(order.delivered_quantity);
  // Status „Zrealizowane” bez wpisanej ilości = pełne odznaczenie w planie.
  if (order.status === "Zrealizowane" && qty > 0) return Math.max(delivered, qty);
  return delivered;
}

function groupBySupplier(
  orders: IndividualOrder[],
  hintMap: Map<string, WarehouseCarrierHint>,
  carriers?: WarehouseCarrierRow[],
  journalReceipts?: JournalReceiptIndex,
  dateKey?: string,
  todayKey?: string
): { suppliers: UpcomingDeliverySupplier[]; clearedIds: string[] } {
  const bySupplier = new Map<string, IndividualOrder[]>();
  for (const order of orders) {
    const supplierId = order.supplier_id;
    if (!supplierId) continue;
    const list = bySupplier.get(supplierId) ?? [];
    list.push(order);
    bySupplier.set(supplierId, list);
  }

  const result: UpcomingDeliverySupplier[] = [];
  const clearedIds: string[] = [];
  for (const [supplierId, supplierOrders] of bySupplier) {
    const supplierName = supplierOrders[0]?.supplier?.name ?? "—";
    const zdDocNumber = supplierOrders.find((o) => o.zd_fulfillment_dok_nr?.trim())?.zd_fulfillment_dok_nr ?? null;
    const positionCount = supplierOrders.length;
    const totalQuantity = supplierOrders.reduce((sum, o) => sum + parseQty(o.quantity), 0);
    const totalDelivered = supplierOrders.reduce((sum, o) => sum + effectiveDeliveredQty(o), 0);

    const hasJournalReceipt =
      journalReceipts && dateKey && todayKey && supplierId
        ? journalHasReceiptForDeadline(journalReceipts, dateKey, supplierId, todayKey)
        : false;

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

    const adjustedDelivered =
      hasJournalReceipt && totalDelivered === 0 && totalQuantity > 0
        ? Math.max(1, Math.ceil(totalQuantity * 0.01))
        : totalDelivered;

    const fullyCleared =
      (adjustedDelivered >= totalQuantity && totalQuantity > 0) ||
      (supplierOrders.every((o) => o.status === "Zrealizowane") && totalQuantity === 0);
    if (fullyCleared) {
      clearedIds.push(supplierId);
      continue;
    }

    result.push({
      supplierId,
      supplierName,
      zdDocNumber,
      positionCount,
      totalQuantity,
      totalDelivered: adjustedDelivered,
      salesPeople,
      carrierHint,
      carrierLabel,
      orders: supplierOrders,
      zdOnlyDocNumbers: [],
    });
  }

  return {
    suppliers: result.sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
    clearedIds,
  };
}

type ZdIndexRow = {
  dok_nr_pelny: string | null;
  supplier_id: string;
  dok_status: number;
  dok_termin_realizacji: string;
};

type ZdSupplierEntry = {
  docNumbers: string[];
  fulfilled: boolean;
};

async function fetchZdIndexDeliveries(
  dateFrom: string,
  dateTo: string,
  todayKey: string
): Promise<Map<string, Map<string, ZdSupplierEntry>>> {
  const supabase = createAdminClient();
  const [rangeRes, overdueRes] = await Promise.all([
    supabase
      .from("subiekt_zd_index")
      .select("dok_nr_pelny, supplier_id, dok_status, dok_termin_realizacji")
      .not("supplier_id", "is", null)
      .not("dok_termin_realizacji", "is", null)
      .in("dok_status", [5, 6, 7, 8])
      .gte("dok_termin_realizacji", dateFrom)
      .lte("dok_termin_realizacji", dateTo)
      .limit(500),
    supabase
      .from("subiekt_zd_index")
      .select("dok_nr_pelny, supplier_id, dok_status, dok_termin_realizacji")
      .not("supplier_id", "is", null)
      .not("dok_termin_realizacji", "is", null)
      .in("dok_status", [5, 6, 7, 8])
      .lt("dok_termin_realizacji", todayKey)
      .limit(200),
  ]);

  if (rangeRes.error) return new Map();
  if (overdueRes.error) return new Map();

  const rows = [
    ...(overdueRes.data ?? []),
    ...(rangeRes.data ?? []),
  ] as ZdIndexRow[];

  const byDateBySupplier = new Map<string, Map<string, ZdSupplierEntry>>();
  for (const row of rows) {
    if (!row.supplier_id || !row.dok_termin_realizacji) continue;
    if (!row.dok_nr_pelny) continue;
    const dateKey = row.dok_termin_realizacji;
    const bySupplier = byDateBySupplier.get(dateKey) ?? new Map<string, ZdSupplierEntry>();
    const entry = bySupplier.get(row.supplier_id) ?? { docNumbers: [], fulfilled: true };
    if (!entry.docNumbers.includes(row.dok_nr_pelny)) entry.docNumbers.push(row.dok_nr_pelny);
    if (row.dok_status !== 8) entry.fulfilled = false;
    bySupplier.set(row.supplier_id, entry);
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
  carriers?: WarehouseCarrierRow[],
  journalReceipts?: JournalReceiptIndex,
  clearedSupplierIdsByDate?: Map<string, Set<string>>,
  orderSupplierIdsByDate?: Map<string, Set<string>>
): Promise<UpcomingDeliveryDay[]> {
  let zdIndexMap: Map<string, Map<string, ZdSupplierEntry>>;
  try {
    zdIndexMap = await fetchZdIndexDeliveries(dateFrom, dateTo, todayKey);
  } catch {
    return orderDays;
  }
  if (!zdIndexMap.size) return orderDays;

  const existingSuppliersByDate = new Map<string, Set<string>>();
  for (const day of orderDays) {
    const touched = new Set<string>([
      ...(orderSupplierIdsByDate?.get(day.dateKey) ?? []),
      ...day.suppliers.map((s) => s.supplierId),
    ]);
    existingSuppliersByDate.set(day.dateKey, touched);
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

    for (const [supplierId, entry] of bySupplier) {
      if (existingSuppliers.has(supplierId)) {
        const supplier = day.suppliers.find((s) => s.supplierId === supplierId);
        if (supplier) {
          const existingDocNumbers = new Set(
            supplier.orders
              .map((o) => o.zd_fulfillment_dok_nr)
              .filter((n): n is string => Boolean(n?.trim()))
          );
          for (const docNr of entry.docNumbers) {
            if (!existingDocNumbers.has(docNr)) {
              supplier.zdOnlyDocNumbers.push(docNr);
            }
          }
        }
        // Zamówienia na ten termin już obsłużone (także cleared) — nie dodawaj karty „tylko ZD”.
      } else {
        if (entry.fulfilled) {
          const cleared = clearedSupplierIdsByDate?.get(dateKey) ?? new Set<string>();
          cleared.add(supplierId);
          clearedSupplierIdsByDate?.set(dateKey, cleared);
          continue;
        }
        // Przyjęcie w dzienniku (nawet po terminie) — nie pokazuj karty „tylko ZD”.
        if (
          journalReceipts &&
          journalHasReceiptForDeadline(journalReceipts, dateKey, supplierId, todayKey)
        ) {
          const cleared = clearedSupplierIdsByDate?.get(dateKey) ?? new Set<string>();
          cleared.add(supplierId);
          clearedSupplierIdsByDate?.set(dateKey, cleared);
          continue;
        }
        const supplierName = supplierNames.get(supplierId) ?? "—";
        const carrierHint = hintMap.get(supplierId) ?? null;
        const carrierLabel = carrierHint
          ? warehouseCarrierLabel(carrierHint.carrier, carriers)
          : null;
        day.suppliers.push({
          supplierId,
          supplierName,
          zdDocNumber: entry.docNumbers[0] ?? null,
          positionCount: 0,
          totalQuantity: entry.fulfilled ? 1 : 0,
          totalDelivered: entry.fulfilled ? 1 : 0,
          salesPeople: [],
          carrierHint,
          carrierLabel,
          orders: [],
          zdOnlyDocNumbers: entry.docNumbers,
        });
      }
    }

    day.suppliers.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }

  orderDays.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return orderDays;
}
