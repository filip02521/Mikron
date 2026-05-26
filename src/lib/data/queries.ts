import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { sortIndividualOrdersBySupplier } from "@/lib/orders/queue-sort";
import { sortInformacjaQueueByProduct } from "@/lib/orders/queue-product-groups";
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

export async function fetchSuppliersWithSchedules(
  location?: SupplierLocation
): Promise<SupplierWithSchedule[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  let q = supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .order("name");
  if (location) q = q.eq("location", location);
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
  const { runRepairIncompleteIndividualOrders } = await import(
    "@/lib/services/repair-incomplete-orders-runner"
  );
  await runRepairIncompleteIndividualOrders(supabase);

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

/** Kolejka: prośby informacyjne — powiadom handlowca, bez odkładania na regał. */
export async function fetchInformacjaQueue(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("request_kind", "informacja")
    .eq("status", "Nowe")
    .order("action_at", { ascending: true });
  if (error) throw new Error(error.message);
  return sortInformacjaQueueByProduct(normalizeIndividualOrders(data ?? []));
}

/** Liczba pozycji w kolejce dostaw (zamówione u dostawcy, bez informacji). */
export async function countDeliveryQueue(): Promise<number> {
  const rows = await fetchDeliveryQueue();
  return rows.length;
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

/** Pozycje fizycznie na magazynie — inwentaryzacja regału (odbiór / informacja). */
export async function fetchWarehouseInventory(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .in("status", ["Zrealizowane", "Czesciowo_zrealizowane"])
    .is("sales_acknowledged_at", null)
    .is("sales_cancelled_at", null);
  if (error) {
    if (error.message?.includes("sales_acknowledged_at")) return [];
    throw new Error(error.message);
  }
  const normalized = normalizeIndividualOrders(data ?? []).filter(isWarehouseInventoryOrder);
  const rows = buildWarehouseInventoryRows(normalized);
  return rows.map((r) => r.order);
}

/** Kolejka dostaw: zamówienia dla handlowca do przyjęcia towaru — bez informacji. */
export async function fetchDeliveryQueue(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { runRepairIncompleteIndividualOrders } = await import(
    "@/lib/services/repair-incomplete-orders-runner"
  );
  await runRepairIncompleteIndividualOrders(supabase);

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
  if (hasSupabaseConfig()) {
    const supabase = createAdminClient();
    const { runRepairIncompleteIndividualOrders } = await import(
      "@/lib/services/repair-incomplete-orders-runner"
    );
    await runRepairIncompleteIndividualOrders(supabase);
  }

  const allSchedules = await fetchSuppliersWithSchedules();
  let schedules = allSchedules;
  if (options?.salesPersonId) {
    const allowed = await fetchSupplierIdsForSalesPerson(options.salesPersonId);
    schedules = allSchedules.filter((s) => allowed.has(s.id));
  }
  const [allNewOrders, salesPeople, statsRows] = await Promise.all([
    fetchIndividualOrders({ hideSalesAcknowledged: false }),
    fetchSalesPeople(),
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
    newOrders.filter((o) => o.status === "Nowe"),
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
    salesPeople: salesPeople.map((p) => ({ id: p.id, name: p.name })),
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
  const supabase = createAdminClient();
  const { data } = await supabase.from("sales_people").select("*").order("name");
  return data ?? [];
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

/** Dostawcy + statystyki czasów realizacji (formularze, panel dzienny). */
export async function fetchSupplierDeliveryContext() {
  const [schedules, statsRows] = await Promise.all([
    fetchSuppliersWithSchedules(),
    fetchDeliveryStats(),
  ]);
  const statsBySupplierId = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  return {
    suppliers: schedules.map((s) => ({
      id: s.id,
      name: s.name,
      stats_mode: (s.stats_mode ?? "LACZNIE") as import("@/types/database").StatsMode,
      subiekt_kh_id: s.subiekt_kh_id ?? null,
    })),
    statsBySupplierId,
  };
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
