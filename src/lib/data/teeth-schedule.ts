import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { addWeeks } from "date-fns";
import {
  formatDateString,
  parseDateOnly,
  snapToBusinessDay,
  toDateOnly,
} from "@/lib/orders/dates";
import type { DayOfWeek, TeethSupplierSchedule, TeethSupplierScheduleWithSupplier } from "@/types/database";
import {
  appendTeethOrderHistory,
  type TeethOrderHistoryActor,
} from "@/lib/data/teeth-order-history";

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  1: "Poniedziałek",
  2: "Wtorek",
  3: "Środa",
  4: "Czwartek",
  5: "Piątek",
};

export const DAY_OF_WEEK_SHORT: Record<DayOfWeek, string> = {
  1: "Pn",
  2: "Wt",
  3: "Śr",
  4: "Cz",
  5: "Pt",
};

function mapScheduleRow(row: Record<string, unknown>): TeethSupplierSchedule {
  return {
    id: String(row.id),
    supplier_id: String(row.supplier_id),
    order_day_of_week: Number(row.order_day_of_week) as DayOfWeek,
    interval_weeks: Number(row.interval_weeks),
    last_order_date: row.last_order_date != null ? String(row.last_order_date) : null,
    shift_date: row.shift_date != null ? String(row.shift_date) : null,
    computed_next_date: row.computed_next_date != null ? String(row.computed_next_date) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapScheduleWithSupplierRow(row: Record<string, unknown>): TeethSupplierScheduleWithSupplier {
  const schedule = mapScheduleRow(row);
  const supplier = row.supplier as Record<string, unknown> | null;
  return {
    ...schedule,
    supplier_name: supplier?.name != null ? String(supplier.name) : "Bez nazwy",
  };
}

/**
 * Oblicz następną datę zamówienia dla dostawcy zębów.
 *
 * Algorytm:
 * 1. Jeśli shift_date >= dziś → użyj shift_date (snapToBusinessDay)
 * 2. Jeśli last_order_date → dodaj interval_weeks, znajdź najbliższy order_day_of_week >= wynik
 * 3. Jeśli brak last_order_date → najbliższy order_day_of_week >= dziś
 * 4. Jeśli wynik < dziś → przewiń o kolejny interval_weeks aż >= dziś (guard 52)
 */
export function computeTeethNextDate(
  schedule: Pick<
    TeethSupplierSchedule,
    "order_day_of_week" | "interval_weeks" | "last_order_date" | "shift_date"
  >,
  today = todayInWarsaw()
): Date | null {
  const todayOnly = toDateOnly(today);
  const targetDow = schedule.order_day_of_week;
  const interval = schedule.interval_weeks;

  // 1. shift_date nadpisuje
  const shiftDate = parseDateOnly(schedule.shift_date);
  if (shiftDate && toDateOnly(shiftDate).getTime() >= todayOnly.getTime()) {
    return snapToBusinessDay(shiftDate);
  }

  // 2. Oblicz bazę: last_order_date + interval_weeks, lub dziś jeśli brak
  const lastOrder = parseDateOnly(schedule.last_order_date);
  let base: Date;
  if (lastOrder) {
    base = addWeeks(lastOrder, interval);
  } else {
    base = todayOnly;
  }

  // 3. Znajdź najbliższy targetDow >= base
  let candidate = findNextWeekday(base, targetDow);

  // 4. Jeśli candidate < dziś, przewiń o interval_weeks
  let guard = 0;
  while (candidate && toDateOnly(candidate).getTime() < todayOnly.getTime() && guard < 52) {
    const nextBase = addWeeks(candidate, interval);
    candidate = findNextWeekday(nextBase, targetDow);
    guard++;
  }

  if (!candidate) return null;
  return snapToBusinessDay(candidate);
}

/** Znajdź najbliższy dzień tygodnia >= date (jeśli date już jest ten dzień, zwróć date). */
function findNextWeekday(date: Date, targetDow: DayOfWeek): Date {
  const d = toDateOnly(date);
  const currentDow = d.getDay();
  // Konwersja: niedziela=0 → 7, poniedziałek=1 → 1, itd.
  const normalizedDow = currentDow === 0 ? 7 : currentDow;

  let diff = targetDow - normalizedDow;
  if (diff < 0) diff += 7;

  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  return result;
}

export type TeethSupplierLaneSnapshot = {
  supplierId: string;
  computedNextDate: string | null;
  shiftDate: string | null;
  lastOrderDate: string | null;
  orderDayOfWeek: DayOfWeek | null;
  intervalWeeks: number | null;
};

function mapLaneSnapshot(row: Record<string, unknown>): TeethSupplierLaneSnapshot {
  return {
    supplierId: String(row.supplier_id),
    computedNextDate: (row.computed_next_date as string | null) ?? null,
    shiftDate: (row.shift_date as string | null) ?? null,
    lastOrderDate: (row.last_order_date as string | null) ?? null,
    orderDayOfWeek: (row.order_day_of_week as DayOfWeek | null) ?? null,
    intervalWeeks:
      row.interval_weeks != null && Number.isFinite(Number(row.interval_weeks))
        ? Number(row.interval_weeks)
        : null,
  };
}

/** Lekki indeks harmonogramów zębów — do panelu dziennego (dual lane). */
export async function fetchTeethSupplierLaneIndex(): Promise<
  Map<string, TeethSupplierLaneSnapshot>
> {
  if (!hasSupabaseConfig()) return new Map();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teeth_supplier_schedules")
    .select(
      "supplier_id, computed_next_date, shift_date, last_order_date, order_day_of_week, interval_weeks"
    );

  if (error) {
    if (error.message?.includes("teeth_supplier_schedules")) return new Map();
    throw new Error(error.message);
  }

  const map = new Map<string, TeethSupplierLaneSnapshot>();
  for (const row of data ?? []) {
    const snap = mapLaneSnapshot(row as Record<string, unknown>);
    map.set(snap.supplierId, snap);
  }
  return map;
}

/** Pobierz wszystkie harmonogramy zębów z nazwami dostawców. */
export async function fetchTeethSchedules(): Promise<TeethSupplierScheduleWithSupplier[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teeth_supplier_schedules")
    .select("*, supplier:suppliers(name)")
    .order("computed_next_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapScheduleWithSupplierRow(row as Record<string, unknown>));
}

/** Pobierz harmonogram zębów dla konkretnego dostawcy. */
export async function fetchTeethScheduleForSupplier(
  supplierId: string
): Promise<TeethSupplierSchedule | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teeth_supplier_schedules")
    .select("*")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapScheduleRow(data as Record<string, unknown>);
}

/** Dodaj lub zaktualizuj harmonogram zębów dla dostawcy. */
export async function upsertTeethSchedule(
  supplierId: string,
  orderDayOfWeek: DayOfWeek,
  intervalWeeks: number
): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();

  // Sprawdź czy już istnieje
  const { data: existing } = await supabase
    .from("teeth_supplier_schedules")
    .select("id, last_order_date, shift_date")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  const now = new Date().toISOString();

  // Oblicz next_date dla nowego/aktualizowanego harmonogramu
  const nextDate = computeTeethNextDate({
    order_day_of_week: orderDayOfWeek,
    interval_weeks: intervalWeeks,
    last_order_date: existing?.last_order_date ?? null,
    shift_date: existing?.shift_date ?? null,
  });

  const { error } = await supabase
    .from("teeth_supplier_schedules")
    .upsert(
      {
        supplier_id: supplierId,
        order_day_of_week: orderDayOfWeek,
        interval_weeks: intervalWeeks,
        computed_next_date: nextDate ? formatDateString(nextDate) : null,
        updated_at: now,
      },
      { onConflict: "supplier_id" }
    );

  if (error) throw new Error(error.message);
}

/** Usuń harmonogram zębów dla dostawcy. */
export async function removeTeethSchedule(supplierId: string): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teeth_supplier_schedules")
    .delete()
    .eq("supplier_id", supplierId);

  if (error) throw new Error(error.message);
}

/** Przelicz i zapisz computed_next_date dla dostawcy. */
export async function recalcTeethSchedule(supplierId: string): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teeth_supplier_schedules")
    .select("*")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  const schedule = mapScheduleRow(data as Record<string, unknown>);
  const nextDate = computeTeethNextDate(schedule);

  const { error: updateErr } = await supabase
    .from("teeth_supplier_schedules")
    .update({
      computed_next_date: nextDate ? formatDateString(nextDate) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("supplier_id", supplierId);

  if (updateErr) throw new Error(updateErr.message);
}

/** Oznacz że zamówiono u dostawcy zębów — ustaw last_order_date, wyczyść shift_date, przelicz. */
export async function markTeethScheduleOrdered(
  supplierId: string,
  orderDate: Date
): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();
  const orderDateKey = formatDateString(orderDate);

  const { error } = await supabase
    .from("teeth_supplier_schedules")
    .update({
      last_order_date: orderDateKey,
      shift_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("supplier_id", supplierId);

  if (error) throw new Error(error.message);

  await recalcTeethSchedule(supplierId);
}

/** Jednorazowe przesunięcie harmonogramu zębów. */
export async function shiftTeethSchedule(
  supplierId: string,
  manualDate: Date | null,
  actor?: TeethOrderHistoryActor
): Promise<void> {
  if (!hasSupabaseConfig()) return;

  const supabase = createAdminClient();

  if (manualDate) {
    const shiftKey = formatDateString(snapToBusinessDay(manualDate));
    const { error } = await supabase
      .from("teeth_supplier_schedules")
      .update({
        shift_date: shiftKey,
        updated_at: new Date().toISOString(),
      })
      .eq("supplier_id", supplierId);

    if (error) throw new Error(error.message);
  } else {
    // Wyczyść shift_date — powrót do automatycznego wyliczenia
    const { error } = await supabase
      .from("teeth_supplier_schedules")
      .update({
        shift_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("supplier_id", supplierId);

    if (error) throw new Error(error.message);
  }

  await recalcTeethSchedule(supplierId);

  await appendTeethOrderHistory({
    action: "schedule_shift",
    actor,
    supplierId,
    meta: {
      shiftDate: manualDate ? formatDateString(snapToBusinessDay(manualDate)) : null,
    },
  });
}

/** Pobierz listę aktywnych dostawców niebędących jeszcze w harmonogramie zębów. */
export async function fetchAvailableSuppliersForTeethSchedule(): Promise<
  { id: string; name: string }[]
> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  // Pobierz wszystkich aktywnych dostawców
  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (supErr) throw new Error(supErr.message);
  if (!suppliers) return [];

  // Pobierz IDs dostawców już w harmonogramie
  const { data: existing, error: schedErr } = await supabase
    .from("teeth_supplier_schedules")
    .select("supplier_id");

  if (schedErr) throw new Error(schedErr.message);

  const existingIds = new Set((existing ?? []).map((r) => r.supplier_id as string));

  return suppliers
    .filter((s) => !existingIds.has(s.id as string))
    .map((s) => ({ id: s.id as string, name: s.name as string }));
}
