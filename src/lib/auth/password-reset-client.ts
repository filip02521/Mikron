export type PasswordResetSendResponse =
  | {
      ok: true;
      maskedEmail: string;
      resendAvailableAt: string;
    }
  | {
      ok: false;
      error: string;
      retryAfterSec?: number;
    };

export type PasswordResetVerifyResponse =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

async function readPasswordResetJson<T>(
  response: Response,
  fallbackError: string
): Promise<T | { ok: false; error: string }> {
  const text = await response.text();
  if (!text.trim()) {
    return {
      ok: false,
      error:
        response.status >= 500
          ? "Serwer resetu hasła jest chwilowo niedostępny. Spróbuj ponownie."
          : fallbackError,
    };
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: fallbackError };
  }
}

export async function requestPasswordResetCode(
  accountId: string
): Promise<PasswordResetSendResponse> {
  let response: Response;
  try {
    response = await fetch("/api/auth/password-reset/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
  } catch {
    return { ok: false, error: "Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie." };
  }

  const parsed = await readPasswordResetJson<PasswordResetSendResponse>(
    response,
    "Nie udało się wysłać kodu resetu hasła."
  );
  return parsed;
}

export async function verifyPasswordResetCode(
  accountId: string,
  code: string
): Promise<PasswordResetVerifyResponse> {
  let response: Response;
  try {
    response = await fetch("/api/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, code }),
    });
  } catch {
    return { ok: false, error: "Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie." };
  }

  const parsed = await readPasswordResetJson<PasswordResetVerifyResponse>(
    response,
    "Nie udało się zweryfikować kodu resetu hasła."
  );
  return parsed;
}
