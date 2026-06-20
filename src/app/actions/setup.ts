"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { createAdminClient } from "@/lib/supabase/admin";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import { validateSetupToken } from "@/lib/setup/bootstrap-token";
import { isValidEmail } from "@/lib/security/text-limits";
import { passwordValidationError } from "@/lib/auth/password-policy";
import {
  consumeAuthRateLimit,
} from "@/lib/auth/auth-rate-limit";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";

const BOOTSTRAP_LOCK_KEY = "bootstrap-admin";

export async function actionBootstrapAdmin(form: {
  email: string;
  password: string;
  setupToken?: string;
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

  if (!validateSetupToken(form.setupToken)) {
    return { error: "Nieprawidłowy token konfiguracji (SETUP_TOKEN)." };
  }

  const rate = await consumeAuthRateLimit({
    bucketKey: "setup:bootstrap",
    maxEvents: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.ok) {
    return {
      error: rate.unavailable
        ? "Limit prób konfiguracji jest chwilowo niedostępny — spróbuj za chwilę."
        : `Zbyt wiele prób konfiguracji. Spróbuj za ${rate.retryAfterSec} s.`,
    };
  }

  const allowed = await needsBootstrapSetup();
  if (!allowed) {
    return { error: "Konto administratora już istnieje. Użyj logowania." };
  }

  const locked = await tryAcquireLock(BOOTSTRAP_LOCK_KEY, 120, "setup");
  if (!locked) {
    return { error: "Konfiguracja jest już w toku — odśwież stronę za chwilę." };
  }

  try {
    const stillAllowed = await needsBootstrapSetup();
    if (!stillAllowed) {
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
  } finally {
    await releaseLock(BOOTSTRAP_LOCK_KEY);
  }
}
