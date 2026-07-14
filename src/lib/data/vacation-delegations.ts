import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type VacationDelegationRow = {
  id: string;
  salesPersonId: string;
  salesPersonName: string;
  delegateProfileId: string;
  startDate: string;
  endDate: string;
  createdBy: string | null;
  createdAt: string;
};

type DelegationDbRow = {
  id: string;
  sales_person_id: string;
  delegate_profile_id: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
  sales_person: { name: string } | null;
};

function mapRow(row: DelegationDbRow): VacationDelegationRow {
  return {
    id: row.id,
    salesPersonId: row.sales_person_id,
    salesPersonName: row.sales_person?.name ?? "",
    delegateProfileId: row.delegate_profile_id,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Aktywne delegacje gdzie użytkownik jest zastępcą (do przełącznika w /moje). */
export async function fetchActiveDelegationsForDelegate(
  profileId: string
): Promise<VacationDelegationRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .select(
      "id, sales_person_id, delegate_profile_id, start_date, end_date, created_by, created_at, sales_person:sales_people(name)"
    )
    .eq("delegate_profile_id", profileId)
    .lte("start_date", new Date().toISOString().slice(0, 10))
    .gte("end_date", new Date().toISOString().slice(0, 10))
    .order("end_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as unknown as DelegationDbRow));
}

/** Aktywna delegacja dla danego handlowca (czy ma zastępcę). */
export async function fetchActiveDelegationForSalesPerson(
  salesPersonId: string
): Promise<VacationDelegationRow | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .select(
      "id, sales_person_id, delegate_profile_id, start_date, end_date, created_by, created_at, sales_person:sales_people(name)"
    )
    .eq("sales_person_id", salesPersonId)
    .lte("start_date", new Date().toISOString().slice(0, 10))
    .gte("end_date", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as unknown as DelegationDbRow);
}

/** Czy profil jest aktywnym zastępcą danego handlowca. */
export async function isProfileActiveDelegateForSalesPerson(
  profileId: string,
  salesPersonId: string
): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .select("id")
    .eq("sales_person_id", salesPersonId)
    .eq("delegate_profile_id", profileId)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Wszystkie delegacje dla danego handlowca (historia + aktywne). */
export async function fetchDelegationsForSalesPerson(
  salesPersonId: string
): Promise<VacationDelegationRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .select(
      "id, sales_person_id, delegate_profile_id, start_date, end_date, created_by, created_at, sales_person:sales_people(name)"
    )
    .eq("sales_person_id", salesPersonId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as unknown as DelegationDbRow));
}

/** Tworzy delegację (upsert — EXCLUDE constraint zapobiega konfliktom zakresów). */
export async function createDelegation(input: {
  salesPersonId: string;
  delegateProfileId: string;
  startDate: string;
  endDate: string;
  createdBy: string | null;
}): Promise<VacationDelegationRow> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");

  if (input.startDate > input.endDate) {
    throw new Error("Data rozpoczęcia nie może być późniejsza niż data zakończenia.");
  }

  const supabase = createAdminClient();

  // Usuń istniejące delegacje w nakładającym się zakresie (upsert semantyka)
  await supabase
    .from("sales_vacation_delegations")
    .delete()
    .eq("sales_person_id", input.salesPersonId)
    .lte("start_date", input.endDate)
    .gte("end_date", input.startDate);

  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .insert({
      sales_person_id: input.salesPersonId,
      delegate_profile_id: input.delegateProfileId,
      start_date: input.startDate,
      end_date: input.endDate,
      created_by: input.createdBy,
    })
    .select(
      "id, sales_person_id, delegate_profile_id, start_date, end_date, created_by, created_at, sales_person:sales_people(name)"
    )
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as unknown as DelegationDbRow);
}

/** Usuwa delegację. */
export async function removeDelegation(id: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error("Brak konfiguracji Supabase.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sales_vacation_delegations")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Aktywne delegacje dla handlowców z grup kierownika. */
export async function fetchActiveDelegationsForGroupManager(
  profileId: string
): Promise<VacationDelegationRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  // Pobierz grupy zarządzane przez kierownika
  const { data: groupLinks } = await supabase
    .from("sales_group_managers")
    .select("group_id")
    .eq("profile_id", profileId);

  const groupIds = (groupLinks ?? []).map((r) => r.group_id as string);
  if (!groupIds.length) return [];

  // Pobierz handlowców z tych grup
  const { data: salesPeople } = await supabase
    .from("sales_people")
    .select("id")
    .in("group_id", groupIds);

  const salesPersonIds = (salesPeople ?? []).map((r) => r.id as string);
  if (!salesPersonIds.length) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .select(
      "id, sales_person_id, delegate_profile_id, start_date, end_date, created_by, created_at, sales_person:sales_people(name)"
    )
    .in("sales_person_id", salesPersonIds)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as unknown as DelegationDbRow));
}

export type DelegateOption = {
  id: string;
  name: string;
  email: string;
};

/** Wszystkie delegacje dla wielu handlowców (batch — jedno zapytanie). */
export async function fetchDelegationsForSalesPeople(
  salesPersonIds: string[]
): Promise<Record<string, VacationDelegationRow[]>> {
  if (!hasSupabaseConfig() || !salesPersonIds.length) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_vacation_delegations")
    .select(
      "id, sales_person_id, delegate_profile_id, start_date, end_date, created_by, created_at, sales_person:sales_people(name)"
    )
    .in("sales_person_id", salesPersonIds)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  const bySalesPerson: Record<string, VacationDelegationRow[]> = {};
  for (const row of data ?? []) {
    const mapped = mapRow(row as unknown as DelegationDbRow);
    if (!bySalesPerson[mapped.salesPersonId]) bySalesPerson[mapped.salesPersonId] = [];
    bySalesPerson[mapped.salesPersonId].push(mapped);
  }
  return bySalesPerson;
}

/** Lista możliwych zastępców (role sales + sales_manager). */
export async function fetchDelegateOptions(): Promise<DelegateOption[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, role, sales_person_id")
    .in("role", ["sales", "sales_manager"]);
  const { data: salesPeople } = await supabase
    .from("sales_people")
    .select("id, name");
  const nameById = new Map((salesPeople ?? []).map((r) => [r.id as string, r.name as string]));
  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    name: (p.sales_person_id && nameById.get(p.sales_person_id as string)) || p.email || p.id,
    email: p.email ?? "",
  }));
}
