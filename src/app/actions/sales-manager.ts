"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, requireSalesTeamManagement } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import {
  assertManagerCanUseGroupId,
  canAccessSalesPerson,
} from "@/lib/data/sales-group-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUniqueSalesPersonLink } from "@/lib/users/sales-person-link";
import {
  generateSalesPersonInviteLink,
  type SalesInviteLinkResult,
} from "@/lib/users/sales-invite";
import { isValidEmail } from "@/lib/security/text-limits";

function revalidateTeamPaths() {
  revalidatePath("/zespol");
  revalidatePath("/zespol/handlowcy");
  revalidatePath("/zespol/grupy");
  revalidatePath("/admin/handlowcy");
  revalidatePath("/admin/uzytkownicy");
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Konto handlowca z hasłem jednorazowym — kierownik przekazuje je osobiście. */
export async function actionCreateSalesTeamUser(form: {
  name: string;
  email: string;
  groupId?: string | null;
}): Promise<
  | {
      success: true;
      salesPersonId: string;
      email: string;
      salesPersonName: string;
      tempPassword: string;
    }
  | { error: string }
> {
  const actor = await requireSalesTeamManagement();

  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  if (!name) return { error: "Podaj imię i nazwisko handlowca." };
  if (!email) return { error: "Podaj adres e-mail." };
  if (!isValidEmail(email)) {
    return { error: "Podaj poprawny adres e-mail." };
  }

  const supabase = createAdminClient();

  const { data: existingPerson } = await supabase
    .from("sales_people")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existingPerson) {
    return { error: "Handlowiec z tym adresem e-mail już istnieje." };
  }

  let groupId: string | null = form.groupId?.trim() ? form.groupId.trim() : null;
  if (groupId) {
    const { data: group } = await supabase
      .from("sales_groups")
      .select("id")
      .eq("id", groupId)
      .maybeSingle();
    if (!group) return { error: "Wybrana grupa nie istnieje." };
  } else {
    groupId = null;
  }

  if (!isAdmin(actor.role)) {
    try {
      await assertManagerCanUseGroupId(actor, groupId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Brak uprawnień do grupy." };
    }
  }

  const { data: person, error: personError } = await supabase
    .from("sales_people")
    .insert({ name, email, group_id: groupId })
    .select("id, name")
    .single();

  if (personError || !person) {
    return { error: personError?.message ?? "Nie udało się utworzyć karty handlowca." };
  }

  const linkError = await assertUniqueSalesPersonLink(supabase, person.id);
  if (linkError) {
    await supabase.from("sales_people").delete().eq("id", person.id);
    return { error: linkError };
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { sales_person_id: person.id },
  });

  if (createError || !created.user) {
    await supabase.from("sales_people").delete().eq("id", person.id);
    return { error: createError?.message ?? "Nie udało się utworzyć konta." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email,
      role: "sales",
      sales_person_id: person.id,
      must_change_password: true,
    })
    .eq("id", created.user.id);

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    await supabase.from("sales_people").delete().eq("id", person.id);
    return { error: profileError.message };
  }

  revalidateTeamPaths();
  return {
    success: true,
    salesPersonId: person.id,
    email,
    salesPersonName: person.name,
    tempPassword,
  };
}

/** Nowe hasło jednorazowe dla istniejącego konta handlowca — wymusza zmianę przy logowaniu. */
export async function actionResetSalesTeamUserPassword(
  salesPersonId: string
): Promise<
  | { success: true; email: string; salesPersonName: string; tempPassword: string }
  | { error: string }
> {
  const current = await requireSalesTeamManagement();
  if (!salesPersonId?.trim()) {
    return { error: "Brak identyfikatora handlowca." };
  }

  const supabase = createAdminClient();

  const { data: person, error: personError } = await supabase
    .from("sales_people")
    .select("id, name, email")
    .eq("id", salesPersonId)
    .maybeSingle();

  if (personError) return { error: personError.message };
  if (!person) return { error: "Nie znaleziono handlowca." };

  if (!isAdmin(current.role)) {
    const allowed = await canAccessSalesPerson(current, salesPersonId);
    if (!allowed) {
      return { error: "Nie masz uprawnień do tego handlowca." };
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, sales_person_id")
    .eq("sales_person_id", salesPersonId)
    .maybeSingle();

  if (profileError) return { error: profileError.message };
  if (!profile) {
    return { error: "Ten handlowiec nie ma konta — użyj „Link zaproszenia” lub dodaj od nowa." };
  }
  if (profile.role !== "sales") {
    return { error: "Reset hasła dotyczy tylko kont handlowców." };
  }
  if (profile.id === current.id) {
    return {
      error:
        "Nie możesz zresetować własnego hasła tą opcją — poproś administratora lub zmień hasło w ustawieniach.",
    };
  }

  const tempPassword = generateTempPassword();
  const email = (profile.email ?? person.email)?.trim().toLowerCase();
  if (!email) {
    return { error: "Brak adresu e-mail na koncie handlowca." };
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
    password: tempPassword,
  });
  if (authError) return { error: authError.message };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ must_change_password: true, email })
    .eq("id", profile.id);

  if (updateError) return { error: updateError.message };

  revalidateTeamPaths();
  return {
    success: true,
    email,
    salesPersonName: person.name,
    tempPassword,
  };
}

export async function actionGenerateSalesTeamInviteLink(
  salesPersonId: string
): Promise<{ success: true; invite: SalesInviteLinkResult } | { error: string }> {
  const actor = await requireSalesTeamManagement();
  if (!isAdmin(actor.role)) {
    const allowed = await canAccessSalesPerson(actor, salesPersonId);
    if (!allowed) return { error: "Nie masz uprawnień do tego handlowca." };
  }
  const supabase = createAdminClient();
  const result = await generateSalesPersonInviteLink(supabase, salesPersonId);
  if ("error" in result) return { error: result.error };
  revalidateTeamPaths();
  return { success: true, invite: result };
}

export async function actionClearMustChangePassword(): Promise<
  { success: true } | { error: string }
> {
  const user = await getSessionUser();
  if (!user) return { error: "Brak sesji." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/moje");
  return { success: true };
}
