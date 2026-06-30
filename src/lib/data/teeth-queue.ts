import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { estimateTeethDeliveryEta, resolveTeethDeliveryDate } from "@/lib/data/teeth-delivery-eta";
import { markTeethScheduleOrdered, fetchTeethSchedules } from "@/lib/data/teeth-schedule";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { formatDateString, toDateOnly } from "@/lib/orders/dates";
import type { IndividualOrder, IndividualOrderTeethDetail } from "@/types/database";

export async function fetchTeethDetailsForOrders(
  orderIds: string[]
): Promise<Map<string, IndividualOrderTeethDetail[]>> {
  if (!orderIds.length) return new Map();
  if (!hasSupabaseConfig()) return new Map();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_order_teeth_details")
    .select("id, order_id, position, color, mould, size, jaw, kind")
    .in("order_id", orderIds)
    .order("position", { ascending: true });

  if (error) return new Map();

  const map = new Map<string, IndividualOrderTeethDetail[]>();
  for (const row of data ?? []) {
    const orderId = row.order_id as string;
    const entry: IndividualOrderTeethDetail = {
      id: row.id as string,
      order_id: orderId,
      position: row.position as number,
      color: row.color as string,
      mould: (row.mould as string | null) ?? null,
      size: (row.size as string | null) ?? null,
      jaw: (row.jaw as "upper" | "lower" | null) ?? null,
      kind: (row.kind as "anterior" | "posterior" | null) ?? null,
    };
    const existing = map.get(orderId);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(orderId, [entry]);
    }
  }
  return map;
}

export type TeethQueueItem = IndividualOrder & {
  supplier_name: string | null;
  sales_person_name: string | null;
};

/** Pozycja z harmonogramu zębów — nie jest prawdziwym zamówieniem, ale zadaniem do zamówienia u dostawcy. */
export type TeethScheduledItem = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  computed_next_date: string | null;
  shift_date: string | null;
  is_scheduled: true;
};

export type TeethQueueEntry = TeethQueueItem | TeethScheduledItem;

export function isScheduledItem(entry: TeethQueueEntry): entry is TeethScheduledItem {
  return (entry as TeethScheduledItem).is_scheduled === true;
}

export type TeethQueueGroup = {
  supplierId: string | null;
  supplierName: string;
  items: TeethQueueEntry[];
  /** Czy grupa zawiera tylko zaplanowane pozycje (bez prawdziwych zamówień). */
  scheduledOnly: boolean;
};

function mapQueueItems(orders: IndividualOrder[]): TeethQueueItem[] {
  return orders.map((order) => ({
    ...order,
    supplier_name: order.supplier?.name ?? null,
    sales_person_name: order.sales_person?.name ?? null,
  }));
}

/** Pobierz pozycje zębów oczekujące na zamówienie (status Nowe lub Weryfikacja) + zaplanowanych dostawców. */
export async function fetchTeethQueue(): Promise<TeethQueueGroup[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const orders = normalizeIndividualOrders(data ?? []);
  const orderIds = orders.map((o) => o.id);
  const teethDetailsMap = await fetchTeethDetailsForOrders(orderIds);
  const items = mapQueueItems(
    orders.map((o) => ({
      ...o,
      teeth_details: teethDetailsMap.get(o.id) ?? null,
    })),
  );

  // Pobierz zaplanowanych dostawców z harmonogramu (computed_next_date <= today)
  const todayStr = formatDateString(todayInWarsaw());
  const schedules = await fetchTeethSchedules().catch(() => []);
  const dueSchedules = schedules.filter(
    (s) => s.computed_next_date && s.computed_next_date <= todayStr
  );

  const groupsMap = new Map<string, TeethQueueGroup>();
  for (const item of items) {
    const key = item.supplier_id ?? "__no_supplier";
    const existing = groupsMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groupsMap.set(key, {
        supplierId: item.supplier_id,
        supplierName: item.supplier_name ?? "Bez dostawcy",
        items: [item],
        scheduledOnly: false,
      });
    }
  }

  // Dodaj zaplanowanych dostawców, którzy nie mają jeszcze pozycji w kolejce
  for (const sched of dueSchedules) {
    const key = sched.supplier_id;
    if (groupsMap.has(key)) continue;
    groupsMap.set(key, {
      supplierId: sched.supplier_id,
      supplierName: sched.supplier_name,
      items: [
        {
          id: `sched:${sched.supplier_id}`,
          supplier_id: sched.supplier_id,
          supplier_name: sched.supplier_name,
          computed_next_date: sched.computed_next_date,
          shift_date: sched.shift_date,
          is_scheduled: true,
        },
      ],
      scheduledOnly: true,
    });
  }

  return Array.from(groupsMap.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl")
  );
}

/** Pobierz historię zamówień zębów (status Zamowione lub nowszy). */
export async function fetchTeethHistory(supplierId?: string | null): Promise<TeethQueueItem[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("is_teeth", true)
    .in("status", ["Zamowione", "Czesciowo_zrealizowane", "Zrealizowane"])
    .order("teeth_ordered_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (supplierId) {
    query = query.eq("supplier_id", supplierId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const orders = normalizeIndividualOrders(data ?? []);
  const orderIds = orders.map((o) => o.id);
  const teethDetailsMap = await fetchTeethDetailsForOrders(orderIds);
  return mapQueueItems(
    orders.map((o) => ({
      ...o,
      teeth_details: teethDetailsMap.get(o.id) ?? null,
    })),
  );
}

/** Oznacz pozycje zębów jako zamówione. */
export async function markTeethOrdered(
  orderIds: string[],
  userId: string
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Pobierz zamówienia przed aktualizacją — potrzebne do obliczenia teeth_delivery_date
  const { data: beforeUpdate } = await supabase
    .from("individual_orders")
    .select("id, supplier_id, teeth_delivery_date")
    .in("id", orderIds)
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja"]);

  const { data, error } = await supabase
    .from("individual_orders")
    .update({
      status: "Zamowione",
      ordered_at: now,
      teeth_ordered_by: userId,
      teeth_ordered_at: now,
    })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja"])
    .select("id");

  if (error) throw new Error(error.message);

  const updatedIds = (data ?? []).map((r) => r.id as string);
  if (updatedIds.length === 0) return { updated: 0 };

  // Ustaw teeth_delivery_date dla każdej pozycji (jeśli nie ustawione ręcznie)
  const supplierIds = new Set<string>();
  for (const row of beforeUpdate ?? []) {
    const supplierId = row.supplier_id as string | null;
    if (!supplierId) continue;
    supplierIds.add(supplierId);

    // Jeśli teeth_delivery_date już ustawione ręcznie — pomiń
    if (row.teeth_delivery_date) continue;

    try {
      const estimate = await estimateTeethDeliveryEta(supplierId, now);
      const deliveryDate = resolveTeethDeliveryDate(null, estimate);
      if (deliveryDate) {
        await supabase
          .from("individual_orders")
          .update({ teeth_delivery_date: deliveryDate })
          .eq("id", row.id);
      }
    } catch {
      // ETA opcjonalne — błąd nie przerywa oznaczania
    }
  }

  // Zaktualizuj harmonogramy dostawców zębów
  const today = todayInWarsaw();
  for (const supplierId of supplierIds) {
    try {
      await markTeethScheduleOrdered(supplierId, today);
    } catch {
      // Harmonogram opcjonalny — błąd nie przerywa
    }
  }

  return { updated: updatedIds.length };
}

/** Cofnij oznaczenie zębów jako zamówione. */
export async function unmarkTeethOrdered(
  orderIds: string[]
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("individual_orders")
    .update({
      status: "Nowe",
      ordered_at: null,
      teeth_ordered_by: null,
      teeth_ordered_at: null,
      teeth_delivery_date: null,
    })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .eq("status", "Zamowione")
    .select("id");

  if (error) throw new Error(error.message);

  return { updated: data?.length ?? 0 };
}

/** Ręczne nadpisanie planowanej daty dostawy dla zamówień zębowych. */
export async function overrideTeethDeliveryDate(
  orderIds: string[],
  deliveryDate: string
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .update({ teeth_delivery_date: deliveryDate })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja", "Zamowione", "Czesciowo_zrealizowane"])
    .select("id");

  if (error) throw new Error(error.message);
  return { updated: data?.length ?? 0 };
}

/** Wyczyść ręcznie nadpisaną datę dostawy (powrót do automatycznego szacunku). */
export async function clearTeethDeliveryDateOverride(
  orderIds: string[]
): Promise<{ updated: number }> {
  if (!orderIds.length) return { updated: 0 };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .update({ teeth_delivery_date: null })
    .in("id", orderIds)
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja", "Zamowione", "Czesciowo_zrealizowane"])
    .select("id");

  if (error) throw new Error(error.message);
  return { updated: data?.length ?? 0 };
}

/** Policz pozycje zębów oczekujące na zamówienie — do badge w nawigacji. */
export async function countTeethQueue(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("individual_orders")
    .select("*", { count: "exact", head: true })
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja"]);

  if (error) return 0;

  // Dodaj zaplanowanych dostawców z computed_next_date <= today
  const todayStr = formatDateString(todayInWarsaw());
  const schedules = await fetchTeethSchedules().catch(() => []);
  const dueCount = schedules.filter(
    (s) => s.computed_next_date && s.computed_next_date <= todayStr
  ).length;

  return (count ?? 0) + dueCount;
}

/** Wersja kolejki zębów do polling — count + max(created_at) dla detekcji zmian. */
export async function fetchTeethQueueVersion(): Promise<string | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("created_at")
    .eq("is_teeth", true)
    .in("status", ["Nowe", "Weryfikacja"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  const maxCreatedAt = data?.[0]?.created_at ?? null;
  const count = await countTeethQueue();

  // Uwzględnij max updated_at z harmonogramu — shift schedule zmienia wersję
  const todayStr = formatDateString(todayInWarsaw());
  const schedules = await fetchTeethSchedules().catch(() => []);
  const dueSchedules = schedules.filter(
    (s) => s.computed_next_date && s.computed_next_date <= todayStr
  );
  const maxSchedUpdated = dueSchedules
    .map((s) => s.updated_at)
    .sort()
    .pop() ?? "";

  return `${count}:${maxCreatedAt ?? ""}:${maxSchedUpdated}`;
}
