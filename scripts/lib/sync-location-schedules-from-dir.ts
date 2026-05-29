import type { SupabaseClient } from "@supabase/supabase-js";
import { findLocationScheduleCsvs } from "./location-schedule-csv";
import { readLocationScheduleCsv } from "./location-schedule-csv";
import { applyLocationScheduleRows } from "./apply-location-schedule-rows";

/** Nadpisuje supplier_schedules stanem z zakładek POLSKA/ZAGRANICA/IMPORT w katalogu. */
export async function syncLocationSchedulesFromDir(
  supabase: SupabaseClient,
  dir: string
): Promise<{ locations: string[]; updated: number }> {
  const found = findLocationScheduleCsvs(dir);
  const locations = Object.keys(found) as ("POLSKA" | "ZAGRANICA" | "IMPORT")[];
  if (!locations.length) return { locations: [], updated: 0 };

  let updated = 0;
  for (const loc of locations) {
    const path = found[loc]!;
    const rows = readLocationScheduleCsv(path);
    const result = await applyLocationScheduleRows(supabase, loc, rows);
    updated += result.updated;
    console.log(`Harmonogram ${loc}: ${result.updated}/${result.total} (${path})`);
  }
  return { locations, updated };
}
