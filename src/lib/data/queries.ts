import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { runRepairIncompleteIndividualOrders } from "@/lib/services/repair-incomplete-orders-runner";
import { mapRowToOrderFormSupplier, mapRowsToOrderFormSuppliers } from "@/lib/orders/order-form-suppliers";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { fetchTeethSupplierLaneIndex } from "@/lib/data/teeth-schedule";
import { teethLaneIndexToRecord } from "@/lib/teeth/teeth-supplier-dual-lane";
import { sortIndividualOrdersBySupplier } from "@/lib/orders/queue-sort";
import { sortInformacjaQueueForDisplay } from "@/lib/orders/queue-product-groups";
import {
  countDeliveryQueueActivePartialRows,
  countDeliveryQueueCancelledRows,
  countInformacjaWarehouseQueueRows,
} from "@/lib/data/queue-counts";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import {
  filterDeliveryQueueByLane,
  type DeliveryQueueLane,
} from "@/lib/teeth/teeth-lifecycle";
import {
  hasActiveSupplierFulfillment,
  isSalesCancelledForQueue,
} from "@/lib/orders/sales-cancel";
import { isAwaitingSalesPickup } from "@/lib/orders/sales-pickup";
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
  /** Ogranicz do podanych ID (np. dostawcy z otwartych zamówień na /moje). */
  supplierIds?: string[];
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
  if (options?.supplierIds?.length) {
    q = q.in("id", options.supplierIds);
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
  /** Gdy true — wyklucza zamówienia zębowe (is_teeth = true). */
  excludeTeeth?: boolean;
  /** Gdy true — pozwala na pobranie wszystkich zamówień bez salesPersonId (panel operacyjny). */
  allowAll?: boolean;
}): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  if (!filters?.salesPersonId && !filters?.allowAll) {
    throw new Error("fetchIndividualOrders wymaga salesPersonId lub allowAll=true");
  }
  const supabase = createAdminClient();
  let q = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .order("action_at", { ascending: false })
    .limit(500);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.salesPersonId) q = q.eq("sales_person_id", filters.salesPersonId);
  if (filters?.hideSalesAcknowledged !== false) {
    q = q.is("sales_acknowledged_at", null);
  }
  if (filters?.excludeTeeth) {
    q = q.neq("is_teeth", true);
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

/** TTL w obrębie procesu — ogranicza koszt przy pollingu badge (co ~25 s). */
const VERIFICATION_SYNC_TTL_MS = 20_000;
let verificationSyncExpiresAt = 0;
let verificationSyncInFlight: Promise<void> | null = null;

/**
 * Niekompletne prośby → status Weryfikacja (jak przed fetch na /weryfikacja).
 * Bez tego badge w menu liczy tylko rekordy już oznaczone w DB.
 */
async function syncVerificationQueueStatuses(): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const now = Date.now();
  if (now < verificationSyncExpiresAt) return;

  if (!verificationSyncInFlight) {
    verificationSyncInFlight = (async () => {
      const supabase = createAdminClient();
      await runRepairIncompleteIndividualOrders(supabase);
      verificationSyncExpiresAt = Date.now() + VERIFICATION_SYNC_TTL_MS;
    })().finally(() => {
      verificationSyncInFlight = null;
    });
  }

  await verificationSyncInFlight;
}

/** Historia audytu — bez pozycji informacyjnych (tylko powiadomienie, bez rezerwacji). */
export async function fetchVerificationOrders(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  await syncVerificationQueueStatuses();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("status", "Weryfikacja")
    .neq("is_teeth", true)
    .order("action_at", { ascending: true });
  if (error) throw new Error(error.message);
  return normalizeIndividualOrders(data ?? []);
}

export async function countVerificationOrders(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  await syncVerificationQueueStatuses();
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "Weryfikacja")
    .neq("is_teeth", true);
  if (error) return 0;
  return count ?? 0;
}

export async function fetchIndividualHistory(options?: {
  /**
   * Domyślnie true — historia toru standardowego (/historia).
   * Zamówienia zębowe są w panelu /zeby → Historia.
   */
  excludeTeeth?: boolean;
}): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .neq("request_kind", "informacja")
    .neq("status", "Weryfikacja")
    .gte("action_at", historyRetentionCutoffIso())
    .order("action_at", { ascending: false });
  if (options?.excludeTeeth !== false) {
    q = q.neq("is_teeth", true);
  }
  const { data, error } = await q;
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
  "status, sales_cancelled_at, sales_cancel_phase, quantity, delivered_quantity, sales_cancelled_quantity, procurement_cancel_disposition, request_kind";

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
  const partialActive = countDeliveryQueueActivePartialRows(
    (cancelledRes.data ?? []) as import("@/lib/data/queue-counts").DeliveryQueueCancelledCountRow[]
  );

  return (activeRes.count ?? 0) + cancelledForQueue + partialActive;
}

/** Całość na regale — u handlowców świeci na zielono do odbioru (poza kolejką przyjęcia). */
export async function countPickupReadyForSales(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, status, sales_acknowledged_at, sales_cancelled_at, sales_cancelled_quantity, quantity, delivered_quantity, request_kind")
    .eq("request_kind", "zamowienie")
    .eq("status", "Zrealizowane")
    .is("sales_acknowledged_at", null);
  if (error) {
    if (error.message?.includes("sales_acknowledged_at")) return 0;
    throw new Error(error.message);
  }
  return (data ?? []).filter((row) =>
    isAwaitingSalesPickup(row as IndividualOrder)
  ).length;
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
export async function fetchDeliveryQueue(options?: {
  /**
   * `regular` — bez zębów (zakładka Przyjęcie).
   * `teeth` — tylko zęby (zakładka Zęby).
   * `all` — oba tory (domyślnie, kompatybilność wsteczna).
   */
  lane?: DeliveryQueueLane;
}): Promise<IndividualOrder[]> {
  const lane = options?.lane ?? "all";
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
      .is("warehouse_cancel_fulfilled_at", null)
      .order("sales_cancelled_at", { ascending: false }),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);

  let cancelledRows = cancelledRes.data ?? [];
  if (cancelledRes.error) {
    if (cancelledRes.error.message?.includes("sales_cancelled_at")) {
      return sortIndividualOrdersBySupplier(
        normalizeIndividualOrders(activeRes.data ?? [])
      );
    }
    if (cancelledRes.error.message?.includes("warehouse_cancel_fulfilled_at")) {
      const fallback = await supabase
        .from("individual_orders")
        .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
        .eq("request_kind", "zamowienie")
        .not("sales_cancelled_at", "is", null)
        .order("sales_cancelled_at", { ascending: false });
      if (fallback.error) throw new Error(fallback.error.message);
      cancelledRows = fallback.data ?? [];
    } else {
      throw new Error(cancelledRes.error.message);
    }
  }

  const cancelledForQueue = normalizeIndividualOrders(cancelledRows).filter(
    (o) =>
      !o.warehouse_cancel_fulfilled_at &&
      isSalesCancelledForQueue(o) &&
      Boolean(o.procurement_cancel_disposition)
  );

  const partialActive = normalizeIndividualOrders(cancelledRows).filter(
    (o) =>
      o.request_kind === "zamowienie" &&
      (o.status === "Zamowione" || o.status === "Czesciowo_zrealizowane") &&
      Boolean(o.sales_cancelled_at) &&
      hasActiveSupplierFulfillment(o)
  );

  const active = normalizeIndividualOrders(activeRes.data ?? []);
  const merged = sortIndividualOrdersBySupplier([
    ...cancelledForQueue,
    ...partialActive,
    ...active,
  ]);
  return filterDeliveryQueueByLane(merged, lane);
}

export async function fetchSummaryWorkspace(options?: { salesPersonId?: string }) {
  const allSchedules = await fetchSuppliersWithSchedules(undefined, { activeOnly: true });
  let schedules = allSchedules;
  if (options?.salesPersonId) {
    const allowed = await fetchSupplierIdsForSalesPerson(options.salesPersonId);
    schedules = allSchedules.filter((s) => allowed.has(s.id));
  }
  const { fetchSalesPeopleForPicker } = await import("@/lib/data/sales-people-admin");
  const [allNewOrders, salesPeople, statsRows, formSuppliers, teethLaneIndex] =
    await Promise.all([
    fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false, excludeTeeth: true, allowAll: true }),
    fetchSalesPeopleForPicker(),
    fetchDeliveryStats(),
    fetchSuppliersForRequestForms(),
    fetchTeethSupplierLaneIndex(),
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
    /** Wszyscy dostawcy (także nieaktywni) — formularze prośby / edycja w panelu. */
    suppliers: formSuppliers,
    supplierDirectory: schedules.map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location,
      vacationNote: s.schedule?.vacation_note ?? null,
    })),
    salesPeople,
    statsBySupplierId,
    supplierStatsMode,
    teethLaneBySupplierId: teethLaneIndexToRecord(teethLaneIndex),
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
  return (data ?? []).map((s) => mapRowToOrderFormSupplier(s));
}

/** Wszyscy dostawcy do formularzy prośby, edycji i weryfikacji (z subiekt_kh_id). */
export async function fetchSuppliersForRequestForms() {
  return fetchSuppliersForForm();
}

/** Dostawcy + statystyki czasów realizacji (formularze, panel dzienny). */
export async function fetchSupplierDeliveryContext(options?: { lightSuppliers?: boolean }) {
  const [suppliers, statsRows] = await Promise.all([
    options?.lightSuppliers
      ? fetchSuppliersForForm()
      : mapRowsToOrderFormSuppliers(
          await fetchSuppliersWithSchedules(undefined, { activeOnly: false })
        ),
    fetchDeliveryStats(),
  ]);
  const statsBySupplierId = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  return {
    suppliers,
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
