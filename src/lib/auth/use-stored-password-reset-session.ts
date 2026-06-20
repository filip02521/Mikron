"use client";

import { useSyncExternalStore } from "react";
import {
  LOGIN_PASSWORD_RESET_SESSION_EVENT,
  readStoredPasswordResetSession,
} from "@/lib/auth/login-password-reset-session";

export type LoginPasswordResetSession = {
  accountId: string;
  maskedEmail: string;
  resendAvailableAt: string;
};

let cachedSnapshot: LoginPasswordResetSession | null = null;
let cachedSnapshotKey = "";

function readLoginPasswordResetSession(): LoginPasswordResetSession | null {
  const stored = readStoredPasswordResetSession();
  if (!stored) {
    cachedSnapshot = null;
    cachedSnapshotKey = "";
    return null;
  }

  const key = `${stored.accountId}|${stored.maskedEmail}|${stored.resendAvailableAt}`;
  if (key === cachedSnapshotKey && cachedSnapshot) {
    return cachedSnapshot;
  }

  cachedSnapshotKey = key;
  cachedSnapshot = {
    accountId: stored.accountId,
    maskedEmail: stored.maskedEmail,
    resendAvailableAt: stored.resendAvailableAt,
  };
  return cachedSnapshot;
}

function subscribe(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange();
  window.addEventListener(LOGIN_PASSWORD_RESET_SESSION_EVENT, handler);
  return () => window.removeEventListener(LOGIN_PASSWORD_RESET_SESSION_EVENT, handler);
}

/** Odczyt sesji resetu hasła — null na serwerze, wartość z sessionStorage po hydracji. */
export function useStoredPasswordResetSession(): LoginPasswordResetSession | null {
  return useSyncExternalStore(
    subscribe,
    readLoginPasswordResetSession,
    () => null
  );
}
