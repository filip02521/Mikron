import { ensureCryptoRandomUUID } from "@/lib/ensure-crypto";
import { redirectPathAfterLogin } from "@/lib/auth-roles";
import { readAdminPanelContextFromDocument } from "@/lib/auth/admin-panel-context-client";

ensureCryptoRandomUUID();
import { translateAuthError } from "@/lib/auth-errors";
import { loginServerResponseErrorMessage } from "@/lib/auth/login-messages";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, Workspace } from "@/types/database";

export type LoginFlowResult =
  | { ok: true; redirectTo: string; accountId: string }
  | { ok: false; error: string };

export type RunLoginFlowParams = {
  accountId?: string | null;
  email?: string;
  password: string;
  next: string | null;
};

async function syncClientSessionAfterServerLogin(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: initialSession } = await supabase.auth.getSession();
  if (initialSession.session) {
    return { ok: true };
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (!refreshError) {
    const { data: refreshedSession } = await supabase.auth.getSession();
    if (refreshedSession.session) {
      return { ok: true };
    }
  }

  const { error: signError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signError) {
    return { ok: false, error: translateAuthError(signError.message) };
  }

  return { ok: true };
}

async function resolveRedirect(
  userId: string,
  next: string | null
): Promise<LoginFlowResult | { ok: false; error: string; signOut: true }> {
  const supabase = createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, must_change_password, assigned_workspaces")
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
    return { ok: true, redirectTo: "/ustaw-haslo?wymagane=1", accountId: userId };
  }

  const adminPanelContext = readAdminPanelContextFromDocument();

  return {
    ok: true,
    redirectTo: redirectPathAfterLogin(profile.role as UserRole, next, {
      adminPanelContext,
      workspaces: (profile.assigned_workspaces ?? []) as Workspace[],
    }),
    accountId: userId,
  };
}

/** Logowanie przez API (ciasteczka HTTP) + potwierdzenie w przeglądarce. */
export async function runLoginFlow(params: RunLoginFlowParams): Promise<LoginFlowResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() ?? "";
  const accountId = params.accountId?.trim() || null;

  const requestBody: Record<string, string | null> = {
    password: params.password,
    next: params.next,
  };
  if (accountId) {
    requestBody.accountId = accountId;
  } else {
    requestBody.email = normalizedEmail;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(requestBody),
    });

    let apiBody: { ok?: boolean; error?: string; redirectTo?: string; accountId?: string } = {};
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
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        await supabase.auth.refreshSession();
        ({ data: sessionData } = await supabase.auth.getSession());
      }
      if (!sessionData.session && normalizedEmail) {
        const synced = await syncClientSessionAfterServerLogin(
          normalizedEmail,
          params.password
        );
        if (!synced.ok) {
          return synced;
        }
        ({ data: sessionData } = await supabase.auth.getSession());
      }

      const resolvedAccountId =
        apiBody.accountId?.trim() ||
        accountId ||
        sessionData.session?.user?.id ||
        "";

      if (!resolvedAccountId) {
        return { ok: false, error: "Nie udało się odczytać sesji." };
      }

      return {
        ok: true,
        redirectTo: apiBody.redirectTo,
        accountId: resolvedAccountId,
      };
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

  if (!normalizedEmail) {
    return { ok: false, error: "Nie udało się zalogować. Sprawdź dane i spróbuj ponownie." };
  }

  const supabase = createClient();
  const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: params.password,
  });

  if (signError) {
    return { ok: false, error: translateAuthError(signError.message) };
  }

  const userId = signData.user?.id;
  if (!userId) {
    return { ok: false, error: "Nie udało się odczytać sesji." };
  }

  const redirect = await resolveRedirect(userId, params.next);
  if (!redirect.ok) {
    if ("signOut" in redirect && redirect.signOut) {
      await supabase.auth.signOut();
    }
    return { ok: false, error: redirect.error };
  }

  return { ...redirect, accountId: userId };
}
