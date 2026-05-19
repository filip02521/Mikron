"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUniqueSalesPersonLink } from "@/lib/users/sales-person-link";
import {
  generateSalesPersonInviteLink,
  type SalesInviteLinkResult,
} from "@/lib/users/sales-invite";
import { getAppUrl } from "@/lib/env/app-config";
import type { UserRole } from "@/types/database";

function revalidateUsers() {
  revalidatePath("/admin/uzytkownicy");
  revalidatePath("/admin/handlowcy");
}

function appUrl(): string {
  return getAppUrl();
}

export async function actionCreateAppUser(form: {
  email: string;
  role: UserRole;
  salesPersonId: string | null;
  password: string;
}): Promise<{ success: true } | { error: string }> {
  await requireAdmin();

  const email = form.email.trim().toLowerCase();
  if (!email) return { error: "Podaj adres e-mail." };
  if (form.password.length < 8) {
    return { error: "Hasło musi mieć co najmniej 8 znaków." };
  }
  if (form.role === "sales" && !form.salesPersonId) {
    return { error: "Dla handlowca wybierz powiązaną osobę z listy handlowców." };
  }

  const supabase = createAdminClient();

  const linkError = await assertUniqueSalesPersonLink(supabase, form.salesPersonId);
  if (linkError) return { error: linkError };

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: form.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Nie udało się utworzyć użytkownika." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email,
      role: form.role,
      sales_person_id: form.role === "sales" ? form.salesPersonId : null,
    })
    .eq("id", created.user.id);

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  revalidateUsers();
  return { success: true };
}

export async function actionUpdateAppUser(form: {
  userId: string;
  role: UserRole;
  salesPersonId: string | null;
}): Promise<{ success: true } | { error: string }> {
  const current = await requireAdmin();

  if (form.role === "sales" && !form.salesPersonId) {
    return { error: "Handlowiec musi być powiązany z osobą z listy." };
  }

  const supabase = createAdminClient();

  const linkError = await assertUniqueSalesPersonLink(
    supabase,
    form.role === "sales" ? form.salesPersonId : null,
    form.userId
  );
  if (linkError) return { error: linkError };

  if (form.userId === current.id && form.role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Nie możesz odebrać sobie roli administratora — jesteś ostatnim adminem." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role: form.role,
      sales_person_id: form.role === "sales" ? form.salesPersonId : null,
    })
    .eq("id", form.userId);

  if (error) return { error: error.message };

  revalidateUsers();
  return { success: true };
}

export async function actionSetUserPassword(
  userId: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  await requireAdmin();

  if (password.length < 8) {
    return { error: "Hasło musi mieć co najmniej 8 znaków." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });

  if (error) return { error: error.message };

  return { success: true };
}

export async function actionGenerateSalesPersonInviteLink(
  salesPersonId: string
): Promise<{ success: true; invite: SalesInviteLinkResult } | { error: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const result = await generateSalesPersonInviteLink(supabase, salesPersonId);
  if ("error" in result) return { error: result.error };
  revalidateUsers();
  return { success: true, invite: result };
}

/** Po ustawieniu hasła z linku zaproszenia — dopina powiązanie z handlowcem. */
export async function actionFinalizeSalesPersonInvite(): Promise<
  { success: true } | { error: string }
> {
  const session = await getSessionUser();
  if (!session) return { error: "Brak aktywnej sesji." };

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
    session.id
  );
  if (authError || !authData.user) {
    return { error: authError?.message ?? "Nie znaleziono użytkownika." };
  }

  const raw = authData.user.user_metadata?.sales_person_id;
  const salesPersonId =
    typeof raw === "string" && raw.trim() ? raw.trim() : null;
  if (!salesPersonId) return { success: true };

  const linkError = await assertUniqueSalesPersonLink(
    supabase,
    salesPersonId,
    session.id
  );
  if (linkError) return { error: linkError };

  const email =
    authData.user.email?.trim().toLowerCase() ?? session.email?.trim().toLowerCase();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: "sales",
      sales_person_id: salesPersonId,
      ...(email ? { email } : {}),
    })
    .eq("id", session.id);

  if (error) return { error: error.message };

  revalidateUsers();
  return { success: true };
}

export async function actionGeneratePasswordResetLink(
  email: string
): Promise<{ success: true; link: string } | { error: string }> {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: {
      redirectTo: `${appUrl()}/ustaw-haslo`,
    },
  });

  if (error || !data.properties?.action_link) {
    return { error: error?.message ?? "Nie udało się wygenerować linku." };
  }

  return { success: true, link: data.properties.action_link };
}

export async function actionDeleteAppUser(
  userId: string
): Promise<{ success: true } | { error: string }> {
  const current = await requireAdmin();

  if (userId === current.id) {
    return { error: "Nie możesz usunąć własnego konta." };
  }

  const supabase = createAdminClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (target?.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Nie można usunąć ostatniego administratora." };
    }
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidateUsers();
  return { success: true };
}
