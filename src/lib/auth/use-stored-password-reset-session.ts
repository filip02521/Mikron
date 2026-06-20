"use client";

import { useSyncExternalStore } from "react";
import { readStoredPasswordResetSession } from "@/lib/auth/login-password-reset-session";

export type LoginPasswordResetSession = {
  accountId: string;
  maskedEmail: string;
  resendAvailableAt: string;
};

function readLoginPasswordResetSession(): LoginPasswordResetSession | null {
  const stored = readStoredPasswordResetSession();
  if (!stored) return null;
  return {
    accountId: stored.accountId,
    maskedEmail: stored.maskedEmail,
    resendAvailableAt: stored.resendAvailableAt,
  };
}

/** Odczyt sesji resetu hasła — null na serwerze, wartość z sessionStorage po hydracji. */
export function useStoredPasswordResetSession(): LoginPasswordResetSession | null {
  return useSyncExternalStore(
    () => () => {},
    readLoginPasswordResetSession,
    () => null
  );
}
