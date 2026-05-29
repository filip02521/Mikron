import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationScheduleRow } from "./location-schedule-pdf";

export const LOCATION_SCHEDULE_NAME_ALIASES: Record<
  string,
  Record<string, string>
> = {
  POLSKA: {
    "FUTURE TECHNOLOGY AND DEVELOPMENT": "AND DEVELOPMENT",
  },
  ZAGRANICA: {
    "Dentsply Sirona (dawny Zhermack)": "Dentsply Sirona (dawny Zhermack)",
  },
  IMPORT: {},
};

export type ApplyLocationScheduleResult = {
  updated: number;
  total: number;
  missing: string[];
};

export async function applyLocationScheduleRows(
  supabase: SupabaseClient,
  location: string,
  rows: LocationScheduleRow[]
): Promise<ApplyLocationScheduleResult> {
  const filtered = rows.filter(
    (r) =>
      r.name &&
      !/^\d{4}-\d{2}-\d{2}$/.test(r.name) &&
      !/^w razie potrzeby$/i.test(r.name)
  );

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("location", location);

  if (error) throw new Error(error.message);

  const byName = new Map(
    (suppliers ?? []).map((s) => [s.name.toUpperCase().trim(), s.id])
  );

  const aliases = LOCATION_SCHEDULE_NAME_ALIASES[location] ?? {};
  let updated = 0;
  const missing: string[] = [];

  for (const row of filtered) {
    const keyName = row.name.toUpperCase().trim();
    let id = byName.get(keyName);
    if (!id && aliases[keyName]) {
      id = byName.get(aliases[keyName].toUpperCase().trim());
    }
    if (!id) {
      missing.push(row.name);
      continue;
    }

    const supplierPatch: Record<string, unknown> = {
      name: row.name,
      pickup_mikran: row.pickup_mikran,
      pickup_pallet: row.pickup_pallet,
      notes: row.notes || undefined,
      extra_info: row.extra_info || undefined,
      updated_at: new Date().toISOString(),
    };
    if (row.stock_raw?.trim()) {
      supplierPatch.stock_raw = row.stock_raw.trim();
      supplierPatch.stock = row.stock_weeks;
    }
    await supabase.from("suppliers").update(supplierPatch).eq("id", id);

    // 1:1 z arkuszem: F→order_date, G→computed_next_date, H→shift_date (bez przeliczania).
    const { error: schedErr } = await supabase.from("supplier_schedules").upsert(
      {
        supplier_id: id,
        order_date: row.order_date,
        shift_date: row.shift_date,
        computed_next_date: row.computed_next_date,
        vacation_note: row.vacation_note_raw?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supplier_id" }
    );

    if (schedErr) {
      console.warn(row.name, schedErr.message);
      continue;
    }
    updated++;
  }

  return { updated, total: filtered.length, missing };
}
