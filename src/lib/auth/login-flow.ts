import { ensureCryptoRandomUUID } from "@/lib/ensure-crypto";
import { loginServerResponseErrorMessage } from "@/lib/auth/login-messages";

ensureCryptoRandomUUID();

export type LoginFlowResult =
  | { ok: true; redirectTo: string; accountId: string }
  | { ok: false; error: string };

export type RunLoginFlowParams = {
  accountId?: string | null;
  email?: string;
  password: string;
  next: string | null;
};

/** Logowanie przez API (ciasteczka HTTP). */
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
      return { ok: false, error: loginServerResponseErrorMessage() };
    }

    if (res.ok && apiBody.ok && apiBody.redirectTo) {
      const resolvedAccountId = apiBody.accountId?.trim() || accountId || "";
      if (!resolvedAccountId) {
        return { ok: false, error: "Nie udało się odczytać sesji." };
      }
      return {
        ok: true,
        redirectTo: apiBody.redirectTo,
        accountId: resolvedAccountId,
      };
    }

    if (apiBody.error) {
      return { ok: false, error: apiBody.error };
    }
  } catch {
    return {
      ok: false,
      error: "Brak połączenia z aplikacją. Sprawdź Wi‑Fi i adres w pasku przeglądarki.",
    };
  }

  return { ok: false, error: "Nie udało się zalogować. Sprawdź dane i spróbuj ponownie." };
}
