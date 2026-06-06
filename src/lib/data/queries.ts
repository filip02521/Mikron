import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { sortIndividualOrdersBySupplier } from "@/lib/orders/queue-sort";
import { sortInformacjaQueueForDisplay } from "@/lib/orders/queue-product-groups";
import {
  countDeliveryQueueCancelledRows,
  countInformacjaWarehouseQueueRows,
} from "@/lib/data/queue-counts";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import { isSalesCancelledForQueue } from "@/lib/orders/sales-cancel";
import { historyRetentionCutoffIso } from "@/lib/orders/history-retention";
import {
  buildWarehouseInventoryRows,
  isWarehouseInventoryOrder,
} from "@/lib/orders/warehouse-inventory";
import type {
  IndividualOrder,
  SupplierLocation,
  SupplierWithSchedule,
} from "@/types/database";

/** Dostawcy powiązani z prośbami danego handlowca (dowolny status). */
export async function fetchSupplierIdsForSalesPerson(
  salesPersonId: string
): Promise<Set<string>> {
  if (!hasSupabaseConfig()) return new Set();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("supplier_id")
    .eq("sales_person_id", salesPersonId)
    .not("supplier_id", "is", null);
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).map((r) => r.supplier_id).filter((id): id is string => Boolean(id))
  );
}

export type FetchSuppliersOptions = {
  /** Domyślnie true — tylko aktywni (panel dzienny, plan). */
  activeOnly?: boolean;
  /** Wyłącznie nieaktywni (lista Nieaktywni). */
  inactiveOnly?: boolean;
};

export async function fetchSuppliersWithSchedules(
  location?: SupplierLocation,
  options?: FetchSuppliersOptions
): Promise<SupplierWithSchedule[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .order("name");
  if (location) q = q.eq("location", location);
  if (options?.inactiveOnly && options?.activeOnly === false) {
    throw new Error("fetchSuppliersWithSchedules: nie używaj inactiveOnly razem z activeOnly: false");
  }
  if (options?.inactiveOnly) {
    q = q.eq("is_active", false);
  } else if (options?.activeOnly !== false) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    ...s,
    schedule: Array.isArray(s.supplier_schedules)
      ? s.supplier_schedules[0] ?? null
      : s.supplier_schedules,
  })) as SupplierWithSchedule[];
}

export async function fetchIndividualOrders(filters?: {
  status?: string;
  salesPersonId?: string;
  /** Domyślnie true — ukrywa potwierdzone przez handlowca. */
  hideSalesAcknowledged?: boolean;
}): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .order("action_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.salesPersonId) q = q.eq("sales_person_id", filters.salesPersonId);
  if (filters?.hideSalesAcknowledged !== false) {
    q = q.is("sales_acknowledged_at", null);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return normalizeIndividualOrders(data ?? []);
}

/** Ostatnio potwierdzone przez handlowca (archiwum na /moje). */
export async function fetchSalesAcknowledgedOrders(
  salesPersonId: string,
  options?: {
    /** ISO / YYYY-MM-DD — tylko od tego momentu (wg kolumny sales_acknowledged_at). */
    acknowledgedSince?: string;
    limit?: number;
  }
): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("sales_person_id", salesPersonId)
    .not("sales_acknowledged_at", "is", null)
    .order("sales_acknowledged_at", { ascending: false })
    .limit(options?.limit ?? 200);

  if (options?.acknowledgedSince) {
    const since = options.acknowledgedSince.includes("T")
      ? options.acknowledgedSince
      : `${options.acknowledgedSince}T00:00:00+02:00`;
    q = q.gte("sales_acknowledged_at", since);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return normalizeIndividualOrders(data ?? []);
}

/** Prośby anulowane przez handlowca (panel zakupów). */
export async function fetchSalesCancelledOrders(
  daysBack = 7
): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .not("sales_cancelled_at", "is", null)
    .gte("sales_cancelled_at", since.toISOString())
    .order("sales_cancelled_at", { ascending: false })
    .limit(80);
  if (error) {
    if (error.message?.includes("sales_cancelled_at")) return [];
    throw new Error(error.message);
  }
  return normalizeIndividualOrders(data ?? []);
}

/** Historia audytu — bez pozycji informacyjnych (tylko powiadomienie, bez rezerwacji). */
export async function fetchVerificationOrders(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("status", "Weryfikacja")
    .order("action_at", { ascending: true });
  if (error) throw new Error(error.message);
  return normalizeIndividualOrders(data ?? []);
}

export async function countVerificationOrders(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "Weryfikacja");
  if (error) return 0;
  return count ?? 0;
}

export async function fetchIndividualHistory(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .neq("request_kind", "informacja")
    .neq("status", "Weryfikacja")
    .gte("action_at", historyRetentionCutoffIso())
    .order("action_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalizeIndividualOrders(data ?? []);
}

/** Kolejka magazynu: prośby informacyjne (sprawdzenie dostępności lub powiadomienie po dostawie). */
export async function fetchInformacjaQueue(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("request_kind", "informacja")
    .in("status", ["Nowe", "Zamowione", "Czesciowo_zrealizowane"])
    .is("sales_cancelled_at", null)
    .order("action_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = normalizeIndividualOrders(data ?? []).filter(isInformacjaWarehouseQueueOrder);
  return sortInformacjaQueueForDisplay(rows);
}

const INFORMACJA_QUEUE_COUNT_SELECT =
  "request_kind, status, informacja_queue_via_daily_panel, sales_cancelled_at";

export async function countInformacjaQueue(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select(INFORMACJA_QUEUE_COUNT_SELECT)
    .eq("request_kind", "informacja")
    .in("status", ["Nowe", "Zamowione", "Czesciowo_zrealizowane"])
    .is("sales_cancelled_at", null);

  if (error) throw new Error(error.message);

  return countInformacjaWarehouseQueueRows(
    (data ?? []) as import("@/lib/data/queue-counts").InformacjaQueueCountRow[]
  );
}

const DELIVERY_QUEUE_CANCELLED_COUNT_SELECT =
  "status, sales_cancelled_at, sales_cancel_phase, quantity, delivered_quantity, procurement_cancel_disposition, request_kind";

/** Liczba pozycji w kolejce dostaw (zamówione u dostawcy, bez informacji). */
export async function countDeliveryQueue(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();

  const [activeRes, cancelledRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("id", { count: "exact", head: true })
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .not("supplier_id", "is", null),
    supabase
      .from("individual_orders")
      .select(DELIVERY_QUEUE_CANCELLED_COUNT_SELECT)
      .eq("request_kind", "zamowienie")
      .not("sales_cancelled_at", "is", null)
      .not("procurement_cancel_disposition", "is", null)
      .order("sales_cancelled_at", { ascending: false }),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);
  if (cancelledRes.error) {
    if (cancelledRes.error.message?.includes("sales_cancelled_at")) {
      return activeRes.count ?? 0;
    }
    throw new Error(cancelledRes.error.message);
  }

  const cancelledForQueue = countDeliveryQueueCancelledRows(
    (cancelledRes.data ?? []) as import("@/lib/data/queue-counts").DeliveryQueueCancelledCountRow[]
  );

  return (activeRes.count ?? 0) + cancelledForQueue;
}

/** Całość na regale — u handlowców świeci na zielono do odbioru (poza kolejką przyjęcia). */
export async function countPickupReadyForSales(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("individual_orders")
    .select("id", { count: "exact", head: true })
    .eq("request_kind", "zamowienie")
    .eq("status", "Zrealizowane")
    .is("sales_acknowledged_at", null)
    .is("sales_cancelled_at", null);
  if (error) {
    if (error.message?.includes("sales_acknowledged_at")) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

const SUPABASE_PAGE = 1000;

/** Pozycje fizycznie na magazynie — inwentaryzacja regału (odbiór / informacja). */
export async function fetchWarehouseInventory(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const orders: IndividualOrder[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .in("status", ["Zrealizowane", "Czesciowo_zrealizowane"])
      .is("sales_acknowledged_at", null)
      .is("sales_cancelled_at", null)
      .order("action_at", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE - 1);
    if (error) {
      if (error.message?.includes("sales_acknowledged_at")) return [];
      throw new Error(error.message);
    }
    const batch = data ?? [];
    const normalized = normalizeIndividualOrders(batch).filter(isWarehouseInventoryOrder);
    orders.push(...buildWarehouseInventoryRows(normalized).map((r) => r.order));
    if (batch.length < SUPABASE_PAGE) break;
    offset += SUPABASE_PAGE;
  }

  return orders;
}

/** Kolejka dostaw: zamówienia dla handlowca do przyjęcia towaru — bez informacji. */
export async function fetchDeliveryQueue(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();

  const [activeRes, cancelledRes] = await Promise.all([
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .not("supplier_id", "is", null)
      .order("action_at", { ascending: true }),
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "zamowienie")
      .not("sales_cancelled_at", "is", null)
      .order("sales_cancelled_at", { ascending: false }),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);
  if (cancelledRes.error) {
    if (cancelledRes.error.message?.includes("sales_cancelled_at")) {
      return sortIndividualOrdersBySupplier(
        normalizeIndividualOrders(activeRes.data ?? [])
      );
    }
    throw new Error(cancelledRes.error.message);
  }

  const cancelledForQueue = normalizeIndividualOrders(
    cancelledRes.data ?? []
  ).filter(
    (o) =>
      isSalesCancelledForQueue(o) && Boolean(o.procurement_cancel_disposition)
  );

  const active = normalizeIndividualOrders(activeRes.data ?? []);
  return sortIndividualOrdersBySupplier([...cancelledForQueue, ...active]);
}

export async function fetchSummaryWorkspace(options?: { salesPersonId?: string }) {
  const allSchedules = await fetchSuppliersWithSchedules(undefined, { activeOnly: true });
  let schedules = allSchedules;
  if (options?.salesPersonId) {
    const allowed = await fetchSupplierIdsForSalesPerson(options.salesPersonId);
    schedules = allSchedules.filter((s) => allowed.has(s.id));
  }
  const { fetchSalesPeopleForPicker } = await import("@/lib/data/sales-people-admin");
  const [allNewOrders, salesPeople, statsRows] = await Promise.all([
    fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false }),
    fetchSalesPeopleForPicker(),
    fetchDeliveryStats(),
  ]);
  const newOrders = options?.salesPersonId
    ? allNewOrders.filter((o) => o.sales_person_id === options.salesPersonId)
    : allNewOrders;
  const salesCancelledOrders = options?.salesPersonId
    ? []
    : await fetchSalesCancelledOrders(7).catch(() => [] as IndividualOrder[]);

  const workspace = buildSummaryWorkspace(
    schedules,
    newOrders,
    undefined,
    salesPeople.map((p) => ({ id: p.id, name: p.name })),
    salesCancelledOrders
  );
  const statsBySupplierId = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  const supplierStatsMode = Object.fromEntries(
    schedules.map((s) => [s.id, (s.stats_mode ?? "LACZNIE") as import("@/types/database").StatsMode])
  );
  return {
    workspace,
    suppliers: schedules.map((s) => ({ id: s.id, name: s.name })),
    supplierDirectory: schedules.map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location,
      vacationNote: s.schedule?.vacation_note ?? null,
    })),
    salesPeople,
    statsBySupplierId,
    supplierStatsMode,
  };
}

/** @deprecated użyj fetchSummaryWorkspace */
export async function fetchSummary() {
  const { workspace } = await fetchSummaryWorkspace();
  return workspace;
}

export async function fetchSalesPeople() {
  if (!hasSupabaseConfig()) return [];
  const { isTeamSalesPerson } = await import("@/lib/sales/sales-person-catalog");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sales_people")
    .select("*")
    .not("group_id", "is", null)
    .order("name");
  const rows = (data ?? []).filter((p) =>
    isTeamSalesPerson({ name: p.name, email: p.email, groupId: p.group_id })
  );
  const byId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!row.id || byId.has(row.id)) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

export async function fetchVacations() {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vacations")
    .select("*, suppliers(name)")
    .order("start_date", { ascending: false });
  return data ?? [];
}

export async function fetchDeliveryStats() {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data } = await supabase.from("delivery_stats").select("*, suppliers(name)");
  return data ?? [];
}

/** Liczba nieaktywnych dostawców (badge w hubie). */
export async function countInactiveSuppliers(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("suppliers")
    .select("id", { count: "exact", head: true })
    .eq("is_active", false);
  if (error) {
    console.error("countInactiveSuppliers:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Lekka lista dostawców do pól wyboru (bez harmonogramów, także nieaktywni). */
export async function fetchSuppliersForForm() {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, stats_mode, subiekt_kh_id")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    stats_mode: (s.stats_mode ?? "LACZNIE") as import("@/types/database").StatsMode,
    subiekt_kh_id: s.subiekt_kh_id ?? null,
  }));
}

/** Dostawcy + statystyki czasów realizacji (formularze, panel dzienny). */
export async function fetchSupplierDeliveryContext(options?: { lightSuppliers?: boolean }) {
  const [supplierRows, statsRows] = await Promise.all([
    options?.lightSuppliers ? fetchSuppliersForForm() : fetchSuppliersWithSchedules(),
    fetchDeliveryStats(),
  ]);
  const statsBySupplierId = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  return {
    suppliers: supplierRows.map((s) => ({
      id: s.id,
      name: s.name,
      stats_mode: (s.stats_mode ?? "LACZNIE") as import("@/types/database").StatsMode,
      subiekt_kh_id: s.subiekt_kh_id ?? null,
    })),
    statsBySupplierId,
  };
}

/** Prośby handlowca — tylko pola potrzebne w formularzu (szybsze SSR). */
export async function fetchSupplierFormContext() {
  return fetchSupplierDeliveryContext({ lightSuppliers: true });
}

export async function fetchNormalHistory(limit?: number) {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("normal_order_history")
    .select("*, suppliers(name)")
    .gte("action_at", historyRetentionCutoffIso())
    .order("action_at", { ascending: false });
  if (limit != null) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
