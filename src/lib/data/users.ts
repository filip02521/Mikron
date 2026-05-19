import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type AppUserRow = {
  id: string;
  email: string;
  role: UserRole;
  salesPersonId: string | null;
  salesPersonName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

async function fetchAllAuthUsersLastSignIn(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, string | null>> {
  const lastSignIn = new Map<string, string | null>();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);

    for (const u of data.users) {
      lastSignIn.set(u.id, u.last_sign_in_at ?? null);
    }

    if (data.users.length < 1000) break;
    page += 1;
  }

  return lastSignIn;
}

export async function fetchAppUsers(): Promise<AppUserRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, sales_person_id, created_at, sales_people(name)")
    .order("created_at", { ascending: true });

  if (profileError) throw new Error(profileError.message);

  const lastSignIn = await fetchAllAuthUsersLastSignIn(supabase);

  return (profiles ?? []).map((p) => {
    const salesPerson = Array.isArray(p.sales_people)
      ? p.sales_people[0]
      : p.sales_people;
    return {
      id: p.id,
      email: p.email ?? "—",
      role: p.role as UserRole,
      salesPersonId: p.sales_person_id,
      salesPersonName: salesPerson?.name ?? null,
      createdAt: p.created_at,
      lastSignInAt: lastSignIn.get(p.id) ?? null,
    };
  });
}
