import { createAdminClient } from "@/lib/supabase/admin";
import { recalcScheduleRow } from "@/lib/orders/recalc";
import { buildScheduleUpsertFromRecalc } from "@/lib/orders/schedule-persist";
import {
  filterApplicableVacationPeriods,
  parseVacationPeriodRow,
  type VacationPeriod,
} from "@/lib/orders/vacations";
import { dateToIso, parseDateOnly, resolveSupplierInterval } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { SupplierLocation } from "@/types/database";
import {
  parseHistoriaActionAt,
  replayHistoriaScheduleState,
} from "@/lib/orders/historia-schedule-actions";
import { deactivateExpiredVacations } from "@/lib/services/sync";

type HistoryRow = {
  supplier_id: string;
  action_at: string;
  action: string;
  next_date: string | null;
};

const HISTORY_PAGE_SIZE = 1000;

async function fetchAllNormalOrderHistory(
  supabase: ReturnType<typeof createAdminClient>
): Promise<HistoryRow[]> {
  const all: HistoryRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("normal_order_history")
      .select("supplier_id, action_at, action, next_date")
      .not("supplier_id", "is", null)
      .order("action_at", { ascending: true })
      .range(from, from + HISTORY_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as HistoryRow[];
    all.push(...page);
    if (page.length < HISTORY_PAGE_SIZE) break;
    from += HISTORY_PAGE_SIZE;
  }

  return all;
}

function buildVacationsBySupplier(
  vacations: Array<{
    supplier_id: string;
    start_date: string;
    end_date: string;
    last_order_date: string;
  }>,
  today = todayInWarsaw()
): Record<string, VacationPeriod[]> {
  const out: Record<string, VacationPeriod[]> = {};
  for (const v of vacations) {
    const period = parseVacationPeriodRow(v);
    if (!period) continue;
    if (!out[v.supplier_id]) out[v.supplier_id] = [];
    out[v.supplier_id].push(period);
  }
  for (const id of Object.keys(out)) {
    out[id] = filterApplicableVacationPeriods(
      out[id]!.sort((a, b) => a.start.getTime() - b.start.getTime()),
      today
    );
  }
  return out;
}

export async function rebuildAllSupplierSchedulesFromHistoria(): Promise<{
  updated: number;
  skippedNoHistory: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  await deactivateExpiredVacations();

  const [history, { data: suppliers, error: supErr }, { data: vacations }] = await Promise.all([
    fetchAllNormalOrderHistory(supabase),
    supabase
      .from("suppliers")
      .select("id, name, location, interval_raw, interval_weeks, is_active"),
    supabase.from("vacations").select("*").eq("active", true),
  ]);

  if (supErr) throw new Error(supErr.message);

  const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s]));
  const vacationsBySupplier = buildVacationsBySupplier(vacations ?? []);

  const bySupplier = new Map<string, HistoryRow[]>();
  for (const row of history) {
    if (!row.supplier_id) continue;
    const list = bySupplier.get(row.supplier_id) ?? [];
    list.push(row as HistoryRow);
    bySupplier.set(row.supplier_id, list);
  }

  let updated = 0;
  let skippedNoHistory = 0;

  for (const [supplierId, rows] of bySupplier) {
    const supplier = supplierById.get(supplierId);
    if (!supplier || supplier.is_active === false) continue;

    try {
      const events = rows
        .map((r) => {
          const actionAt = parseHistoriaActionAt(r.action_at);
          if (!actionAt) return null;
          return {
            actionAt,
            action: r.action,
            nextDate: r.next_date ? parseDateOnly(r.next_date) : null,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e != null);

      const { orderDate, shiftDate } = replayHistoriaScheduleState(events);
      const interval = resolveSupplierInterval(
        supplier.interval_raw as string | null,
        supplier.interval_weeks != null ? Number(supplier.interval_weeks) : null
      );

      const recalc = recalcScheduleRow({
        orderDate,
        shiftDate,
        interval,
        location: supplier.location as SupplierLocation,
        vacations: vacationsBySupplier[supplierId] ?? [],
      });

      const { error: upsertErr } = await supabase.from("supplier_schedules").upsert(
        buildScheduleUpsertFromRecalc({
          supplierId,
          orderDate: dateToIso(orderDate),
          shiftDate: dateToIso(shiftDate),
          recalc,
        }),
        { onConflict: "supplier_id" }
      );

      if (upsertErr) errors.push(`${supplier.name}: ${upsertErr.message}`);
      else updated++;
    } catch (e) {
      errors.push(
        `${supplier.name}: ${e instanceof Error ? e.message : "błąd przeliczenia"}`
      );
    }
  }

  const withSchedule = new Set(bySupplier.keys());
  for (const s of suppliers ?? []) {
    if (s.is_active === false) continue;
    if (!withSchedule.has(s.id)) skippedNoHistory++;
  }

  return { updated, skippedNoHistory, errors };
}
