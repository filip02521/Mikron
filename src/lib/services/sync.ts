import { createAdminClient } from "@/lib/supabase/admin";
import { formatContactHref } from "@/lib/orders/supplier-contact";
import { recalcScheduleRow } from "@/lib/orders/recalc";
import type { VacationPeriod } from "@/lib/orders/vacations";
import { dateToIso, parseDateOnly, resolveSupplierInterval } from "@/lib/orders/dates";
import type { SupplierLocation } from "@/types/database";

type SupplierWithSchedule = {
  id: string;
  name: string;
  location: string;
  interval_raw: string | null;
  interval_weeks: number | null;
  supplier_schedules:
    | {
        order_date: string | null;
        shift_date: string | null;
        computed_next_date: string | null;
      }
    | Array<{
        order_date: string | null;
        shift_date: string | null;
        computed_next_date: string | null;
      }>
    | null;
};

function scheduleRow(supplier: SupplierWithSchedule) {
  return Array.isArray(supplier.supplier_schedules)
    ? supplier.supplier_schedules[0]
    : supplier.supplier_schedules;
}

function buildVacationsBySupplier(
  vacations: Array<{
    supplier_id: string;
    start_date: string;
    end_date: string;
    last_order_date: string;
  }>
): Record<string, VacationPeriod[]> {
  const vacationsBySupplier: Record<string, VacationPeriod[]> = {};
  for (const v of vacations) {
    const start = parseDateOnly(v.start_date);
    const end = parseDateOnly(v.end_date);
    const lastOrder = parseDateOnly(v.last_order_date);
    if (!start || !end || !lastOrder) continue;
    if (!vacationsBySupplier[v.supplier_id]) vacationsBySupplier[v.supplier_id] = [];
    vacationsBySupplier[v.supplier_id].push({ start, end, lastOrder });
  }
  for (const id of Object.keys(vacationsBySupplier)) {
    vacationsBySupplier[id].sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  return vacationsBySupplier;
}

/** Przelicza harmonogram jednego dostawcy (szybkie — bez sync całej bazy). */
export async function recalcSingleSupplierSchedule(supplierId: string): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: supplier, error: supplierErr }, { data: vacations }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, location, interval_raw, interval_weeks, supplier_schedules(*)")
      .eq("id", supplierId)
      .single(),
    supabase.from("vacations").select("*").eq("active", true),
  ]);

  if (supplierErr || !supplier) {
    throw new Error(supplierErr?.message ?? "Nie znaleziono dostawcy");
  }

  const schedule = scheduleRow(supplier as SupplierWithSchedule);
  const shiftDate = parseDateOnly(schedule?.shift_date ?? null);
  const vacationsBySupplier = buildVacationsBySupplier(vacations ?? []);

  const recalc = recalcScheduleRow({
    orderDate: parseDateOnly(schedule?.order_date ?? null),
    shiftDate,
    interval: resolveSupplierInterval(
      supplier.interval_raw as string | null,
      supplier.interval_weeks != null ? Number(supplier.interval_weeks) : null
    ),
    location: supplier.location as SupplierLocation,
    vacations: vacationsBySupplier[supplier.id] ?? [],
  });

  const computed_next_date = dateToIso(recalc.computedNextDate);

  const { error: upsertErr } = await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplier.id,
      order_date: schedule?.order_date ?? null,
      shift_date: schedule?.shift_date ?? null,
      computed_next_date,
      vacation_note: recalc.vacationNote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );

  if (upsertErr) throw new Error(upsertErr.message);
}

export async function syncSuppliersFromSettings(): Promise<{
  processed: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .order("name");

  if (error) throw new Error(error.message);
  if (!suppliers?.length) return { processed: 0, errors: ["Brak dostawców w ustawieniach"] };

  const { data: vacations } = await supabase
    .from("vacations")
    .select("*")
    .eq("active", true);

  const vacationsBySupplier = buildVacationsBySupplier(vacations ?? []);

  let processed = 0;
  for (const s of suppliers) {
    if (s.is_active === false) continue;
    try {
      const schedule = scheduleRow(s as SupplierWithSchedule);
      const shiftDate = parseDateOnly(schedule?.shift_date ?? null);
      const interval = resolveSupplierInterval(
        s.interval_raw as string | null,
        s.interval_weeks != null ? Number(s.interval_weeks) : null
      );

      const recalc = recalcScheduleRow({
        orderDate: parseDateOnly(schedule?.order_date ?? null),
        shiftDate,
        interval,
        location: s.location as SupplierLocation,
        vacations: vacationsBySupplier[s.id] ?? [],
      });

      const computed_next_date = dateToIso(recalc.computedNextDate);

      const { error: upsertErr } = await supabase.from("supplier_schedules").upsert(
        {
          supplier_id: s.id,
          order_date: schedule?.order_date ?? null,
          shift_date: schedule?.shift_date ?? null,
          computed_next_date,
          vacation_note: recalc.vacationNote,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "supplier_id" }
      );

      if (upsertErr) errors.push(`${s.name}: ${upsertErr.message}`);
      else processed++;
    } catch (e) {
      errors.push(`${s.name}: ${e instanceof Error ? e.message : "błąd"}`);
    }
  }

  return { processed, errors };
}

export function buildSupplierRowFromSettings(row: {
  name: string;
  location: SupplierLocation;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
}) {
  const contact_display = formatContactHref(row.notes, row.mails);
  return { ...row, contact_display };
}
