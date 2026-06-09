"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import { isValidEmail } from "@/lib/security/text-limits";
import { passwordValidationError } from "@/lib/auth/password-policy";

export async function actionBootstrapAdmin(form: {
  email: string;
  password: string;
}): Promise<{ success: true } | { error: string }> {
  const email = form.email.trim().toLowerCase();
  const password = form.password;

  if (!email || !password) {
    return { error: "Podaj e-mail i hasło." };
  }
  if (!isValidEmail(email)) {
    return { error: "Podaj poprawny adres e-mail." };
  }
  const policyError = passwordValidationError(password);
  if (policyError) return { error: policyError };

  const allowed = await needsBootstrapSetup();
  if (!allowed) {
    return { error: "Konto administratora już istnieje. Użyj logowania." };
  }

  const supabase = createAdminClient();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return {
      error: createError?.message ?? "Nie udało się utworzyć konta.",
    };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: created.user.id,
    email,
    role: "admin",
    sales_person_id: null,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  return { success: true };
}
