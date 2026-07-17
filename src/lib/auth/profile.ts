import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import type { UserRole, Workspace } from "@/types/database";

export type ProfileRow = {
  role: UserRole;
  sales_person_id: string | null;
  email: string | null;
  must_change_password: boolean;
  sales_onboarding_completed_at: string | null;
  assigned_workspaces: Workspace[];
  uniform_background: boolean;
};

const PROFILE_SELECT =
  "role, sales_person_id, email, must_change_password, sales_onboarding_completed_at, assigned_workspaces, preferences";

function mapProfileRow(data: Record<string, unknown>): ProfileRow {
  const rawWorkspaces = data.assigned_workspaces;
  const workspaces = Array.isArray(rawWorkspaces)
    ? (rawWorkspaces.filter((w) => typeof w === "string") as Workspace[])
    : [];
  const rawPrefs = data.preferences;
  const prefs = (rawPrefs && typeof rawPrefs === "object") ? rawPrefs as Record<string, unknown> : {};
  return {
    role: data.role as UserRole,
    sales_person_id: data.sales_person_id as string | null,
    email: data.email as string | null,
    must_change_password: Boolean(data.must_change_password),
    sales_onboarding_completed_at: (data.sales_onboarding_completed_at as string | null) ?? null,
    assigned_workspaces: workspaces,
    uniform_background: Boolean(prefs.uniform_background ?? false),
  };
}

/** Odczyt własnego profilu JWT użytkownika (RLS profiles — pierwszy krok migracji z service role). */
export async function fetchOwnProfileForSession(): Promise<
  (ProfileRow & { id: string }) | null
> {
  if (!hasSupabaseConfig()) return null;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: user.id,
    ...mapProfileRow(data),
    email: (data.email as string | null) ?? user.email ?? "",
  };
}

/** Odczyt profilu service role — middleware, lookup po id, integracje. */
export async function fetchProfileByUserId(
  userId: string
): Promise<ProfileRow | null> {
  if (!hasSupabaseConfig()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileRow(data);
}
