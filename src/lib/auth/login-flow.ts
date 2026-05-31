import { ensureCryptoRandomUUID } from "@/lib/ensure-crypto";
import { redirectPathAfterLogin } from "@/lib/auth-roles";

ensureCryptoRandomUUID();
import { translateAuthError } from "@/lib/auth-errors";
import {
  loginServerResponseErrorMessage,
} from "@/lib/auth/login-messages";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export type LoginFlowResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

async function resolveRedirect(
  userId: string,
  next: string | null
): Promise<LoginFlowResult | { ok: false; error: string; signOut: true }> {
  const supabase = createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: `Błąd profilu: ${profileError.message}`,
      signOut: true,
    };
  }

  if (!profile) {
    return {
      ok: false,
      error: "Brak profilu użytkownika — skontaktuj się z administratorem.",
      signOut: true,
    };
  }

  if (profile.must_change_password) {
    return { ok: true, redirectTo: "/ustaw-haslo?wymagane=1" };
  }

  return {
    ok: true,
    redirectTo: redirectPathAfterLogin(profile.role as UserRole, next),
  };
}

/** Logowanie przez API (ciasteczka HTTP) + potwierdzenie w przeglądarce. */
export async function runLoginFlow(
  email: string,
  password: string,
  next: string | null
): Promise<LoginFlowResult> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        next,
      }),
    });

    let apiBody: { ok?: boolean; error?: string; redirectTo?: string } = {};
    try {
      apiBody = (await res.json()) as typeof apiBody;
    } catch {
      return {
        ok: false,
        error: loginServerResponseErrorMessage(),
      };
    }

    if (res.ok && apiBody.ok && apiBody.redirectTo) {
      const supabase = createClient();
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      return { ok: true, redirectTo: apiBody.redirectTo };
    }

    if (!res.ok && apiBody.error) {
      return { ok: false, error: apiBody.error };
    }
  } catch {
    return {
      ok: false,
      error: "Brak połączenia z aplikacją. Sprawdź Wi‑Fi i adres w pasku przeglądarki.",
    };
  }

  const supabase = createClient();
  const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (signError) {
    return { ok: false, error: translateAuthError(signError.message) };
  }

  const userId = signData.user?.id;
  if (!userId) {
    return { ok: false, error: "Nie udało się odczytać sesji." };
  }

  const redirect = await resolveRedirect(userId, next);
  if (!redirect.ok) {
    if ("signOut" in redirect && redirect.signOut) {
      await supabase.auth.signOut();
    }
    return { ok: false, error: redirect.error };
  }

  return redirect;
}
