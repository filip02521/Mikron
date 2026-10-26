import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { query } from "@/lib/db/pool";
import { fetchAllRows, fetchAllRowsResult } from "@/lib/data/fetch-all-rows";
import { warsawMidnightIso } from "@/lib/time/warsaw";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { runRepairIncompleteIndividualOrders } from "@/lib/services/repair-incomplete-orders-runner";
import { mapRowToOrderFormSupplier, mapRowsToOrderFormSuppliers } from "@/lib/orders/order-form-suppliers";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import {
  buildSuppliersOnVacationNow,
  type VacationCalendarRow,
} from "@/lib/orders/procurement-supplier-vacation";
import {
  mapFlagDefinitionRow,
  type ProcurementFlagDefinition,
} from "@/lib/orders/procurement-request-flag";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { fetchTeethSupplierLaneIndex } from "@/lib/data/teeth-schedule";
import { fetchProcurementLaneOrderRaw } from "@/lib/data/procurement-lane-order";
import { teethLaneIndexToRecord } from "@/lib/teeth/teeth-supplier-dual-lane";
import { sortIndividualOrdersBySupplier } from "@/lib/orders/queue-sort";
import { sortInformacjaQueueForDisplay } from "@/lib/orders/queue-product-groups";
import {
  countDeliveryQueueActivePartialRows,
  countInformacjaWarehouseQueueRows,
} from "@/lib/data/queue-counts";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import {
  filterDeliveryQueueByLane,
  type DeliveryQueueLane,
} from "@/lib/teeth/teeth-lifecycle";
import {
  hasActiveSupplierFulfillment,
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
  Vacation,
} from "@/types/database";

/** Dostawcy powiązani z prośbami danego handlowca (dowolny status). */
export async function fetchSupplierIdsForSalesPerson(
  salesPersonId: string
): Promise<Set<string>> {
  if (!hasSupabaseConfig()) return new Set();
  // DISTINCT w bazie — wiersz na prośbę rośnie z historią handlowca.
  const { rows } = await query<{ supplier_id: string }>(
    `SELECT DISTINCT supplier_id FROM individual_orders
      WHERE sales_person_id = $1 AND supplier_id IS NOT NULL`,
    [salesPersonId]
  );
  return new Set(rows.map((r) => r.supplier_id));
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
  // Z potwierdzonymi: niepotwierdzone najpierw, żeby limit ucinał stare potwierdzone, nie otwarte prośby.
  let q = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .order("sales_acknowledged_at", { ascending: false, nullsFirst: true })
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
  // Kolejność dla widoków jak dotąd: ostatnia akcja najpierw.
  return normalizeIndividualOrders(data ?? []).sort((a, b) =>
    (b.action_at ?? "").localeCompare(a.action_at ?? "")
  );
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
      : warsawMidnightIso(options.acknowledgedSince);
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
/** Osobno: naprawa statusów vs auto-powiązanie — page load nie może „zabić” assign w badge. */
let verificationRepairExpiresAt = 0;
let verificationAutoAssignExpiresAt = 0;
let verificationRepairInFlight: Promise<void> | null = null;
let verificationAutoAssignInFlight: Promise<void> | null = null;

/** Naprawa statusów właśnie przebiegła — pomiń tylko repair przez TTL. */
export function markVerificationQueueSynced(): void {
  verificationRepairExpiresAt = Date.now() + VERIFICATION_SYNC_TTL_MS;
}

/** Auto-assign właśnie przebiegł (page / sync) — pomiń kolejny assign przez TTL. */
export function markVerificationAutoAssignSynced(): void {
  verificationAutoAssignExpiresAt = Date.now() + VERIFICATION_SYNC_TTL_MS;
}

/**
 * Niekompletne prośby → status Weryfikacja, potem auto-powiązanie dostawcy z katalogu.
 * Badge w menu woła to samo (osobne TTL) — inaczej świeci „Weryfikacja” mimo że prośba
 * już poszła do podsumowania po cichym promote do Nowe.
 * Bez revalidatePath tu (ścieżka renderu layoutu / poll API).
 */
async function syncVerificationQueueStatuses(): Promise<void> {
  if (!hasSupabaseConfig()) return;

  if (Date.now() >= verificationRepairExpiresAt) {
    if (!verificationRepairInFlight) {
      verificationRepairInFlight = (async () => {
        const supabase = createAdminClient();
        await runRepairIncompleteIndividualOrders(supabase);
        verificationRepairExpiresAt = Date.now() + VERIFICATION_SYNC_TTL_MS;
      })().finally(() => {
        verificationRepairInFlight = null;
      });
    }
    await verificationRepairInFlight;
  }

  // Ponowny odczyt czasu — po await repair page mógł już zrobić assign.
  if (Date.now() >= verificationAutoAssignExpiresAt) {
    if (!verificationAutoAssignInFlight) {
      verificationAutoAssignInFlight = (async () => {
        try {
          const { autoAssignMissingSuppliersFromCatalog } = await import(
            "@/lib/services/auto-assign-suppliers"
          );
          await autoAssignMissingSuppliersFromCatalog({ limit: 80 });
        } catch (e) {
          console.error("[syncVerificationQueueStatuses autoAssign]", e);
        }
        verificationAutoAssignExpiresAt = Date.now() + VERIFICATION_SYNC_TTL_MS;
      })().finally(() => {
        verificationAutoAssignInFlight = null;
      });
    }
    await verificationAutoAssignInFlight;
  }
}

/** Historia audytu — bez pozycji informacyjnych (tylko powiadomienie, bez rezerwacji). */
export async function fetchVerificationOrders(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  await syncVerificationQueueStatuses();
  const supabase = createAdminClient();

  const data = await fetchAllRows<IndividualOrder>(() =>
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("status", "Weryfikacja")
      .neq("is_teeth", true)
      .order("action_at", { ascending: true })
      .order("id", { ascending: true })
  );
  return normalizeIndividualOrders(data);
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

/** /historia pokazuje najnowsze pozycje z okna retencji — świadomy limit, nie całość. */
const INDIVIDUAL_HISTORY_LIMIT = 1000;

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
    .order("action_at", { ascending: false })
    .limit(INDIVIDUAL_HISTORY_LIMIT);
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
  const data = await fetchAllRows<IndividualOrder>(() =>
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("request_kind", "informacja")
      .in("status", ["Nowe", "Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .order("action_at", { ascending: true })
      .order("id", { ascending: true })
  );
  const rows = normalizeIndividualOrders(data).filter(isInformacjaWarehouseQueueOrder);
  return sortInformacjaQueueForDisplay(rows);
}

// informacja_stock_out_reorder: bez niego licznik liczył też „brak na stanie”, których kolejka nie pokazuje.
const INFORMACJA_QUEUE_COUNT_SELECT =
  "request_kind, status, informacja_queue_via_daily_panel, informacja_stock_out_reorder, sales_cancelled_at";

export async function countInformacjaQueue(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const data = await fetchAllRows<import("@/lib/data/queue-counts").InformacjaQueueCountRow>(() =>
    supabase
      .from("individual_orders")
      .select(INFORMACJA_QUEUE_COUNT_SELECT)
      .eq("request_kind", "informacja")
      .in("status", ["Nowe", "Zamowione", "Czesciowo_zrealizowane"])
      .is("sales_cancelled_at", null)
      .order("id", { ascending: true })
  );

  return countInformacjaWarehouseQueueRows(data);
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
    // Anulowane bez granicy czasu — rośnie z historią, więc całość stronami.
    fetchAllRowsResult(() =>
      supabase
        .from("individual_orders")
        .select(DELIVERY_QUEUE_CANCELLED_COUNT_SELECT)
        .eq("request_kind", "zamowienie")
        .not("sales_cancelled_at", "is", null)
        .not("procurement_cancel_disposition", "is", null)
        .order("sales_cancelled_at", { ascending: false })
        .order("id", { ascending: true })
    ),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);
  if (cancelledRes.error) {
    if (cancelledRes.error.message?.includes("sales_cancelled_at")) {
      return activeRes.count ?? 0;
    }
    throw new Error(cancelledRes.error.message);
  }

  const partialActive = countDeliveryQueueActivePartialRows(
    (cancelledRes.data ?? []) as import("@/lib/data/queue-counts").DeliveryQueueCancelledCountRow[]
  );

  return (activeRes.count ?? 0) + partialActive;
}

/** Całość na regale — u handlowców świeci na zielono do odbioru (poza kolejką przyjęcia). */
export async function countPickupReadyForSales(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;
  const supabase = createAdminClient();
  const { data, error } = await fetchAllRowsResult<IndividualOrder>(() =>
    supabase
      .from("individual_orders")
      .select("id, status, sales_acknowledged_at, sales_cancelled_at, sales_cancelled_quantity, quantity, delivered_quantity, request_kind")
      .eq("request_kind", "zamowienie")
      .eq("status", "Zrealizowane")
      .is("sales_acknowledged_at", null)
      .order("id", { ascending: true })
  );
  if (error) {
    if (error.message?.includes("sales_acknowledged_at")) return 0;
    throw new Error(error.message);
  }
  return (data ?? []).filter((row) =>
    isAwaitingSalesPickup(row as IndividualOrder)
  ).length;
}

/** Pozycje fizycznie na magazynie — inwentaryzacja regału (odbiór / informacja). */
export async function fetchWarehouseInventory(): Promise<IndividualOrder[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await fetchAllRowsResult<IndividualOrder>(() =>
    supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .in("status", ["Zrealizowane", "Czesciowo_zrealizowane"])
      .is("sales_acknowledged_at", null)
      .is("sales_cancelled_at", null)
      .order("action_at", { ascending: true })
      .order("id", { ascending: true })
  );
  if (error) {
    if (error.message?.includes("sales_acknowledged_at")) return [];
    throw new Error(error.message);
  }
  const normalized = normalizeIndividualOrders(data ?? []).filter(isWarehouseInventoryOrder);
  return buildWarehouseInventoryRows(normalized).map((r) => r.order);
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
    fetchAllRowsResult<IndividualOrder>(() =>
      supabase
        .from("individual_orders")
        .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
        .eq("request_kind", "zamowienie")
        .in("status", ["Zamowione", "Czesciowo_zrealizowane"])
        .is("sales_cancelled_at", null)
        .not("supplier_id", "is", null)
        .order("action_at", { ascending: true })
        .order("id", { ascending: true })
    ),
    fetchAllRowsResult<IndividualOrder>(() =>
      supabase
        .from("individual_orders")
        .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
        .eq("request_kind", "zamowienie")
        .not("sales_cancelled_at", "is", null)
        .is("warehouse_cancel_fulfilled_at", null)
        .order("sales_cancelled_at", { ascending: false })
        .order("id", { ascending: true })
    ),
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
      cancelledRows = await fetchAllRows<IndividualOrder>(() =>
        supabase
          .from("individual_orders")
          .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
          .eq("request_kind", "zamowienie")
          .not("sales_cancelled_at", "is", null)
          .order("sales_cancelled_at", { ascending: false })
          .order("id", { ascending: true })
      );
    } else {
      throw new Error(cancelledRes.error.message);
    }
  }

  const partialActive = normalizeIndividualOrders(cancelledRows).filter(
    (o) =>
      o.request_kind === "zamowienie" &&
      (o.status === "Zamowione" || o.status === "Czesciowo_zrealizowane") &&
      Boolean(o.sales_cancelled_at) &&
      hasActiveSupplierFulfillment(o)
  );

  const active = normalizeIndividualOrders(activeRes.data ?? []);
  const merged = sortIndividualOrdersBySupplier([
    ...partialActive,
    ...active,
  ]);
  return filterDeliveryQueueByLane(merged, lane);
}

export async function fetchSummaryWorkspace(options?: { salesPersonId?: string }) {
  type EtaQuantiles = import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles;
  const salesPersonId = options?.salesPersonId;
  // Statystyki → kwantyle ETA (zależne od supplier_id ze statystyk), reszta równolegle.
  const statsPromise = fetchDeliveryStats();
  const etaPromise = statsPromise
    .then(async (rows) => {
      const { loadDeliveryEtaQuantilesForSupplierIds } = await import(
        "@/lib/orders/delivery-eta-quantiles-load"
      );
      return loadDeliveryEtaQuantilesForSupplierIds(rows.map((s) => s.supplier_id));
    })
    .catch((e): { useP50: boolean; bySupplierId: Record<string, EtaQuantiles> } => {
      console.warn("fetchSummaryWorkspace eta quantiles:", e);
      return { useP50: false, bySupplierId: {} };
    });
  const [
    schedules,
    allNewOrders,
    salesPeople,
    statsRows,
    formSuppliers,
    teethLaneIndex,
    onVacationNow,
    flagDefinitions,
    laneOrderRaw,
    salesCancelledOrders,
    etaLoaded,
  ] = await Promise.all([
    Promise.all([
      fetchSuppliersWithSchedules(undefined, { activeOnly: true }),
      salesPersonId ? fetchSupplierIdsForSalesPerson(salesPersonId) : null,
    ]).then(([all, allowed]) => (allowed ? all.filter((s) => allowed.has(s.id)) : all)),
    fetchIndividualOrders({ status: "Nowe", hideSalesAcknowledged: false, excludeTeeth: true, allowAll: true }),
    import("@/lib/data/sales-people-admin").then((m) => m.fetchSalesPeopleForPicker()),
    statsPromise,
    fetchSuppliersForRequestForms(),
    fetchTeethSupplierLaneIndex(),
    fetchSuppliersOnVacationNow(),
    fetchProcurementFlagDefinitions(),
    fetchProcurementLaneOrderRaw(),
    salesPersonId
      ? ([] as IndividualOrder[])
      : fetchSalesCancelledOrders(7).catch(() => [] as IndividualOrder[]),
    etaPromise,
  ]);
  const newOrders = salesPersonId
    ? allNewOrders.filter((o) => o.sales_person_id === salesPersonId)
    : allNewOrders;

  const workspace = buildSummaryWorkspace(
    schedules,
    newOrders,
    undefined,
    salesPeople.map((p) => ({ id: p.id, name: p.name })),
    salesCancelledOrders
  );

  for (const [id, meta] of Object.entries(workspace.supplierMeta)) {
    if (onVacationNow[id]) {
      meta.on_vacation_now = true;
    }
  }

  // Pełna lista defs (aktywne + nieaktywne seed/soft-delete) — manage + chipy.
  // Filtr/assign używa tylko isActive lokalnie w UI.
  const procurementFlagDefinitions = flagDefinitions;

  const statsBySupplierId = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );
  const supplierStatsMode = Object.fromEntries(
    schedules.map((s) => [s.id, (s.stats_mode ?? "LACZNIE") as import("@/types/database").StatsMode])
  );

  const etaUseP50 = etaLoaded.useP50;
  const etaQuantilesBySupplierId: Record<string, EtaQuantiles> = etaLoaded.bySupplierId;

  return {
    workspace: {
      ...workspace,
      suppliersOnVacationNow: onVacationNow,
      procurementFlagDefinitions,
      procurementLaneOrder: laneOrderRaw,
    },
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
    etaUseP50,
    etaQuantilesBySupplierId,
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
  // Wszystkie urlopy od początku — lista rośnie z czasem, więc stronami.
  const { data, error } = await fetchAllRowsResult<Vacation & { suppliers?: { name: string } }>(() =>
    supabase
      .from("vacations")
      .select("*, suppliers(name)")
      .order("start_date", { ascending: false })
      .order("id", { ascending: true })
  );
  if (error) console.error("fetchVacations:", error.message);
  return data ?? [];
}

/** Aktywne urlopy obejmujące dziś (panel dzienny — nakładka na prośbach). */
export async function fetchSuppliersOnVacationNow(
  todayKey: string = todayDateKeyInWarsaw()
): Promise<Record<string, { startDate: string; endDate: string }>> {
  if (!hasSupabaseConfig()) return {};
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vacations")
    .select("supplier_id, start_date, end_date, active")
    .eq("active", true)
    .lte("start_date", todayKey)
    .gte("end_date", todayKey);
  if (error) {
    console.error("fetchSuppliersOnVacationNow:", error.message);
    return {};
  }
  return buildSuppliersOnVacationNow(
    (data ?? []) as VacationCalendarRow[],
    todayKey
  );
}

/** Definicje flag zakupów — aktywne i nieaktywne (sort_order). */
export async function fetchProcurementFlagDefinitions(): Promise<
  ProcurementFlagDefinition[]
> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("procurement_flag_definitions")
    .select("id, label, color, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (error) {
    if (
      error.message?.includes("procurement_flag_definitions") ||
      error.message?.includes("does not exist") ||
      error.message?.includes("schema cache")
    ) {
      return [];
    }
    console.error("fetchProcurementFlagDefinitions:", error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => mapFlagDefinitionRow(row))
    .filter((d): d is ProcurementFlagDefinition => Boolean(d));
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

  let etaUseP50 = false;
  let etaQuantilesBySupplierId: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  > = {};
  try {
    const { loadDeliveryEtaQuantilesForSupplierIds } = await import(
      "@/lib/orders/delivery-eta-quantiles-load"
    );
    const loaded = await loadDeliveryEtaQuantilesForSupplierIds(
      Object.keys(statsBySupplierId)
    );
    etaUseP50 = loaded.useP50;
    etaQuantilesBySupplierId = loaded.bySupplierId;
  } catch (e) {
    console.warn("fetchSupplierDeliveryContext eta quantiles:", e);
  }

  return {
    suppliers,
    statsBySupplierId,
    etaUseP50,
    etaQuantilesBySupplierId,
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
  else q = q.limit(1000);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
