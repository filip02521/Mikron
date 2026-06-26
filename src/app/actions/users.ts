"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import {
  requireAdminForMutation,
  requireAdminOrSalesTeamManagement,
  getSessionUser,
} from "@/lib/auth";
import { roleRequiresSalesPerson } from "@/lib/users/labels";
import { isAdmin } from "@/lib/auth-roles";
import { canAccessSalesPerson } from "@/lib/data/sales-group-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUniqueSalesPersonLink } from "@/lib/users/sales-person-link";
import {
  generateSalesPersonInviteLink,
  type SalesInviteLinkResult,
} from "@/lib/users/sales-invite";
import { resolveAppUrl } from "@/lib/env/resolve-app-url.server";
import {
  buildPasswordConfirmLink,
  emailOtpTypeFromVerification,
  passwordSetupConfirmUrl,
} from "@/lib/auth/password-link-redirect";
import { passwordValidationError } from "@/lib/auth/password-policy";
import type { UserRole } from "@/types/database";
import { isValidEmail } from "@/lib/security/text-limits";
import {
  deleteSalesManagerGroupsForProfile,
  replaceSalesManagerGroupsForProfile,
} from "@/lib/users/sales-manager-groups-db";
import type { AppUserRow } from "@/lib/data/users";

function revalidateUsers(opts?: { includeHandlowcy?: boolean; includeTeam?: boolean }) {
  revalidatePath("/admin/uzytkownicy", "page");
  if (opts?.includeHandlowcy) {
    revalidatePath("/admin/handlowcy", "page");
  }
  if (opts?.includeTeam) {
    revalidatePath("/zespol", "page");
    revalidatePath("/zespol/handlowcy", "page");
    revalidatePath("/zespol/grupy", "page");
  }
}

export async function actionCreateAppUser(form: {
  email: string;
  role: UserRole;
  salesPersonId: string | null;
  password: string;
}): Promise<{ success: true; user: AppUserRow } | { error: string }> {
  await requireAdminForMutation();

  const email = form.email.trim().toLowerCase();
  if (!email) return { error: "Podaj adres e-mail." };
  if (!isValidEmail(email)) return { error: "Podaj poprawny adres e-mail." };
  const passwordError = passwordValidationError(form.password);
  if (passwordError) return { error: passwordError };
  if (roleRequiresSalesPerson(form.role) && !form.salesPersonId) {
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
      sales_person_id: roleRequiresSalesPerson(form.role) ? form.salesPersonId : null,
    })
    .eq("id", created.user.id);

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  let salesPersonName: string | null = null;
  if (roleRequiresSalesPerson(form.role) && form.salesPersonId) {
    const { data: sp } = await supabase
      .from("sales_people")
      .select("name")
      .eq("id", form.salesPersonId)
      .maybeSingle();
    salesPersonName = sp?.name ?? null;
  }

  revalidateUsers({
    includeHandlowcy: roleRequiresSalesPerson(form.role) && Boolean(form.salesPersonId),
  });

  return {
    success: true,
    user: {
      id: created.user.id,
      email,
      role: form.role,
      salesPersonId: roleRequiresSalesPerson(form.role) ? form.salesPersonId : null,
      salesPersonName,
      createdAt: created.user.created_at ?? new Date().toISOString(),
      lastSignInAt: null,
    },
  };
}

export async function actionUpdateAppUser(form: {
  userId: string;
  role: UserRole;
  salesPersonId: string | null;
}): Promise<{ success: true } | { error: string }> {
  const current = await requireAdminForMutation();

  if (roleRequiresSalesPerson(form.role) && !form.salesPersonId) {
    return { error: "Handlowiec musi być powiązany z osobą z listy." };
  }

  const supabase = createAdminClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("role, sales_person_id")
    .eq("id", form.userId)
    .maybeSingle();

  const linkError = await assertUniqueSalesPersonLink(
    supabase,
    roleRequiresSalesPerson(form.role) ? form.salesPersonId : null,
    form.userId
  );
  if (linkError) return { error: linkError };

  const wasManager = before?.role === "sales_manager";
  const willBeManager = form.role === "sales_manager";
  if (wasManager && !willBeManager) {
    const clearErr = await deleteSalesManagerGroupsForProfile(supabase, form.userId);
    if (clearErr) return { error: clearErr };
  }

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
      sales_person_id: roleRequiresSalesPerson(form.role) ? form.salesPersonId : null,
    })
    .eq("id", form.userId);

  if (error) return { error: error.message };

  const prevRole = (before?.role as UserRole | undefined) ?? form.role;
  const prevSalesId = (before?.sales_person_id as string | null | undefined) ?? null;
  const nextSalesId = roleRequiresSalesPerson(form.role) ? form.salesPersonId : null;
  const handlowcyTouched =
    roleRequiresSalesPerson(prevRole) ||
    roleRequiresSalesPerson(form.role) ||
    prevSalesId !== nextSalesId;

  revalidateUsers({
    includeHandlowcy: handlowcyTouched,
    includeTeam: wasManager || willBeManager,
  });
  return { success: true };
}

/** Rola + handlowiec + grupy kierownika w jednej, poprawnej kolejności. */
export async function actionSaveAppUserPermissions(form: {
  userId: string;
  role: UserRole;
  salesPersonId: string | null;
  managerGroupIds: string[];
}): Promise<{ success: true } | { error: string }> {
  const current = await requireAdminForMutation();

  if (roleRequiresSalesPerson(form.role) && !form.salesPersonId) {
    return { error: "Handlowiec musi być powiązany z osobą z listy." };
  }

  const supabase = createAdminClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("role, sales_person_id")
    .eq("id", form.userId)
    .maybeSingle();

  const linkError = await assertUniqueSalesPersonLink(
    supabase,
    roleRequiresSalesPerson(form.role) ? form.salesPersonId : null,
    form.userId
  );
  if (linkError) return { error: linkError };

  const wasManager = before?.role === "sales_manager";
  const willBeManager = form.role === "sales_manager";

  if (wasManager && !willBeManager) {
    const clearErr = await deleteSalesManagerGroupsForProfile(supabase, form.userId);
    if (clearErr) return { error: clearErr };
  }

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
      sales_person_id: roleRequiresSalesPerson(form.role) ? form.salesPersonId : null,
    })
    .eq("id", form.userId);

  if (error) return { error: error.message };

  if (willBeManager) {
    const groupErr = await replaceSalesManagerGroupsForProfile(
      supabase,
      form.userId,
      form.managerGroupIds
    );
    if (groupErr) return { error: groupErr };
  }

  const prevRole = (before?.role as UserRole | undefined) ?? form.role;
  const prevSalesId = (before?.sales_person_id as string | null | undefined) ?? null;
  const nextSalesId = roleRequiresSalesPerson(form.role) ? form.salesPersonId : null;
  const handlowcyTouched =
    roleRequiresSalesPerson(prevRole) ||
    roleRequiresSalesPerson(form.role) ||
    prevSalesId !== nextSalesId;

  revalidateUsers({
    includeHandlowcy: handlowcyTouched,
    includeTeam: wasManager || willBeManager,
  });

  return { success: true };
}

export async function actionSetUserPassword(
  userId: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  await requireAdminForMutation();

  const passwordError = passwordValidationError(password);
  if (passwordError) return { error: passwordError };

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });

  if (error) return { error: error.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);
  if (profileError) return { error: profileError.message };

  return { success: true };
}

export async function actionGenerateSalesPersonInviteLink(
  salesPersonId: string
): Promise<{ success: true; invite: SalesInviteLinkResult } | { error: string }> {
  const actor = await requireAdminOrSalesTeamManagement("mutate");
  if (!isAdmin(actor.role)) {
    const allowed = await canAccessSalesPerson(actor, salesPersonId);
    if (!allowed) return { error: "Nie masz uprawnień do tego handlowca." };
  }
  const supabase = createAdminClient();
  const result = await generateSalesPersonInviteLink(supabase, salesPersonId);
  if ("error" in result) return { error: result.error };
  revalidateUsers({ includeHandlowcy: true, includeTeam: true });
  return { success: true, invite: result };
}

type FinalizeSalesPersonInviteUser = {
  id: string;
  email: string;
};

/** Po ustawieniu hasła z linku zaproszenia — dopina powiązanie z handlowcem. */
export async function actionFinalizeSalesPersonInvite(
  knownUser?: FinalizeSalesPersonInviteUser
): Promise<{ success: true } | { error: string }> {
  const session = knownUser ?? (await getSessionUser());
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

  revalidateUsers({ includeHandlowcy: true });
  return { success: true };
}

export async function actionGeneratePasswordResetLink(
  email: string
): Promise<{ success: true; link: string } | { error: string }> {
  await requireAdminForMutation();

  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { error: "Podaj poprawny adres e-mail." };
  }

  const supabase = createAdminClient();
  const appUrl = await resolveAppUrl();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: normalized,
    options: {
      redirectTo: passwordSetupConfirmUrl(appUrl),
    },
  });

  if (error || !data.properties?.hashed_token) {
    return { error: error?.message ?? "Nie udało się wygenerować linku." };
  }

  return {
    success: true,
    link: buildPasswordConfirmLink(
      data.properties.hashed_token,
      emailOtpTypeFromVerification(data.properties.verification_type),
      undefined,
      appUrl
    ),
  };
}

export async function actionDeleteAppUser(
  userId: string
): Promise<{ success: true } | { error: string }> {
  const current = await requireAdminForMutation();

  if (userId === current.id) {
    return { error: "Nie możesz usunąć własnego konta." };
  }

  const supabase = createAdminClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role, sales_person_id")
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

  revalidateUsers({
    includeHandlowcy: Boolean(target?.sales_person_id),
  });
  return { success: true };
}
