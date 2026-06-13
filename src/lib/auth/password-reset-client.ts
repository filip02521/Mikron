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

export async function requestPasswordResetCode(
  email: string
): Promise<PasswordResetSendResponse> {
  const response = await fetch("/api/auth/password-reset/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return (await response.json()) as PasswordResetSendResponse;
}

export async function verifyPasswordResetCode(
  email: string,
  code: string
): Promise<PasswordResetVerifyResponse> {
  const response = await fetch("/api/auth/password-reset/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  return (await response.json()) as PasswordResetVerifyResponse;
}
