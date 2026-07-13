import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type StaffVacationRow = {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
};

type StaffVacationDbRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  profiles: { email: string | null; role: UserRole; sales_people: { name: string } | null } | null;
};

function mapRow(row: StaffVacationDbRow): StaffVacationRow {
  const profile = row.profiles;
  const name = profile?.sales_people?.name ?? profile?.email ?? "Nieznany użytkownik";
  return {
    id: row.id,
    userId: row.user_id,
    userName: name,
    userRole: profile?.role ?? "sales",
    startDate: row.start_date,
    endDate: row.end_date,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** Wszyscy aktywni użytkownicy z danego działu (po roli). */
export async function fetchStaffByRole(role: UserRole): Promise<
  { id: string; name: string; role: UserRole }[]
> {
  if (!hasSupabaseConfig()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, sales_people(name)")
    .eq("role", role)
    .order("email", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => {
    const sp = p.sales_people as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(sp) ? (sp[0]?.name ?? null) : sp?.name ?? null;
    return {
      id: p.id,
      name: name ?? p.email ?? "Nieznany",
      role: p.role,
    };
  });
}

/** Okresy urlopów dla wielu użytkowników (batch). */
export async function fetchStaffVacationPeriods(
  userIds: string[]
): Promise<Record<string, StaffVacationRow[]>> {
  if (!hasSupabaseConfig() || !userIds.length) return {};
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("staff_vacation_periods")
    .select(`
      id, user_id, start_date, end_date, note, created_at,
      profiles!inner(email, role, sales_people(name))
    `)
    .in("user_id", userIds)
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);

  const byUser: Record<string, StaffVacationRow[]> = {};
  for (const row of data ?? []) {
    const mapped = mapRow(row as unknown as StaffVacationDbRow);
    if (!byUser[mapped.userId]) byUser[mapped.userId] = [];
    byUser[mapped.userId].push(mapped);
  }
  return byUser;
}

/** Tworzy okres urlopu. */
export async function createStaffVacationPeriod(input: {
  userId: string;
  startDate: string;
  endDate: string;
  note?: string | null;
}): Promise<StaffVacationRow> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");
  if (input.startDate > input.endDate) {
    throw new Error("Data rozpoczęcia nie może być późniejsza niż data zakończenia.");
  }
  const note = input.note?.trim().slice(0, 500) || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("staff_vacation_periods")
    .insert({
      user_id: input.userId,
      start_date: input.startDate,
      end_date: input.endDate,
      note,
    })
    .select(`
      id, user_id, start_date, end_date, note, created_at,
      profiles!inner(email, role, sales_people(name))
    `)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as unknown as StaffVacationDbRow);
}

/** Usuwa okres urlopu. */
export async function removeStaffVacationPeriod(id: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("staff_vacation_periods")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
