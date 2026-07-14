import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import type { StaffVacationCategory } from "@/lib/data/staff-vacation-periods";

export type VacationCategory = StaffVacationCategory;

export type VacationPeriodRow = {
  id: string;
  salesPersonId: string;
  category: VacationCategory;
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
};

type VacationPeriodDbRow = {
  id: string;
  sales_person_id: string;
  category: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
};

function mapRow(row: VacationPeriodDbRow): VacationPeriodRow {
  return {
    id: row.id,
    salesPersonId: row.sales_person_id,
    category: (row.category as VacationCategory) ?? "urlop",
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** Wszystkie okresy urlopu dla danego handlowca. */
export async function fetchVacationPeriodsForSalesPerson(
  salesPersonId: string
): Promise<VacationPeriodRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_periods")
    .select("id, sales_person_id, category, start_date, end_date, note, created_at")
    .eq("sales_person_id", salesPersonId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as unknown as VacationPeriodDbRow));
}

/** Aktywny urlop danego handlowca (today między start a end). */
export async function fetchActiveVacationPeriod(
  salesPersonId: string
): Promise<VacationPeriodRow | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const today = todayDateKeyInWarsaw();
  const { data, error } = await supabase
    .from("sales_vacation_periods")
    .select("id, sales_person_id, category, start_date, end_date, note, created_at")
    .eq("sales_person_id", salesPersonId)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as unknown as VacationPeriodDbRow);
}

/** Tworzy okres urlopu (EXCLUDE constraint zapobiega nakładającym się zakresom). */
export async function createVacationPeriod(input: {
  salesPersonId: string;
  startDate: string;
  endDate: string;
  category?: VacationCategory;
  note?: string | null;
}): Promise<VacationPeriodRow> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");

  if (input.startDate > input.endDate) {
    throw new Error("Data rozpoczęcia nie może być późniejsza niż data zakończenia.");
  }

  const note = input.note?.trim().slice(0, 500) || null;
  const category = input.category ?? "urlop";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_periods")
    .insert({
      sales_person_id: input.salesPersonId,
      start_date: input.startDate,
      end_date: input.endDate,
      category,
      note,
    })
    .select("id, sales_person_id, category, start_date, end_date, note, created_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as unknown as VacationPeriodDbRow);
}

/** Wszystkie okresy urlopu dla grup zarządzanych przez kierownika. */
export async function fetchVacationPeriodsForManager(
  profileId: string
): Promise<Record<string, VacationPeriodRow[]>> {
  if (!hasSupabaseConfig()) return {};

  const supabase = createAdminClient();

  const { data: groupLinks } = await supabase
    .from("sales_group_managers")
    .select("group_id")
    .eq("profile_id", profileId);

  const groupIds = (groupLinks ?? []).map((r) => r.group_id as string);
  if (!groupIds.length) return {};

  const { data: salesPeople } = await supabase
    .from("sales_people")
    .select("id")
    .in("group_id", groupIds);

  const salesPersonIds = (salesPeople ?? []).map((r) => r.id as string);
  if (!salesPersonIds.length) return {};

  const { data, error } = await supabase
    .from("sales_vacation_periods")
    .select("id, sales_person_id, category, start_date, end_date, note, created_at")
    .in("sales_person_id", salesPersonIds)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  const bySalesPerson: Record<string, VacationPeriodRow[]> = {};
  for (const row of data ?? []) {
    const mapped = mapRow(row as unknown as VacationPeriodDbRow);
    if (!bySalesPerson[mapped.salesPersonId]) bySalesPerson[mapped.salesPersonId] = [];
    bySalesPerson[mapped.salesPersonId].push(mapped);
  }
  return bySalesPerson;
}

/** Wszystkie okresy urlopu dla wielu handlowców (batch — jedno zapytanie). */
export async function fetchVacationPeriodsForSalesPeople(
  salesPersonIds: string[]
): Promise<Record<string, VacationPeriodRow[]>> {
  if (!hasSupabaseConfig() || !salesPersonIds.length) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_periods")
    .select("id, sales_person_id, category, start_date, end_date, note, created_at")
    .in("sales_person_id", salesPersonIds)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  const bySalesPerson: Record<string, VacationPeriodRow[]> = {};
  for (const row of data ?? []) {
    const mapped = mapRow(row as unknown as VacationPeriodDbRow);
    if (!bySalesPerson[mapped.salesPersonId]) bySalesPerson[mapped.salesPersonId] = [];
    bySalesPerson[mapped.salesPersonId].push(mapped);
  }
  return bySalesPerson;
}

/** Usuwa okres urlopu. */
export async function removeVacationPeriod(id: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sales_vacation_periods")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Aktualizuje okres urlopu. */
export async function updateVacationPeriod(input: {
  id: string;
  startDate: string;
  endDate: string;
  category?: VacationCategory;
  note?: string | null;
}): Promise<VacationPeriodRow> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");

  if (input.startDate > input.endDate) {
    throw new Error("Data rozpoczęcia nie może być późniejsza niż data zakończenia.");
  }

  const note = input.note?.trim().slice(0, 500) || null;
  const category = input.category ?? "urlop";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_periods")
    .update({
      start_date: input.startDate,
      end_date: input.endDate,
      category,
      note,
    })
    .eq("id", input.id)
    .select("id, sales_person_id, category, start_date, end_date, note, created_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as unknown as VacationPeriodDbRow);
}
