"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { OTP_LENGTH } from "@/lib/auth/password-reset-constants";
import {
  requestPasswordResetCode,
  verifyPasswordResetCode,
} from "@/lib/auth/password-reset-client";
import { postLoginEnteringUrl } from "@/lib/auth/post-login-entering";
import {
  readStoredPasswordResetSession,
  writeStoredPasswordResetSession,
} from "@/lib/auth/login-password-reset-session";
import { cn } from "@/lib/cn";

const loginAltLinkClass = cn(
  "text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
);

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PasswordResetPanel({
  accountId,
  maskedEmail: initialMaskedEmail,
  resendAvailableAt: initialResendAvailableAt,
  sessionNotice,
  onBack,
}: {
  accountId: string;
  maskedEmail: string;
  resendAvailableAt: string;
  sessionNotice?: string;
  onBack: () => void;
}) {
  const [maskedEmail, setMaskedEmail] = useState(initialMaskedEmail);
  const [resendAvailableAt, setResendAvailableAt] = useState(initialResendAvailableAt);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdownTick, setCountdownTick] = useState(0);
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

  const busy = sending || verifying;
  const codeComplete = code.length === OTP_LENGTH;
  const resendSeconds = useMemo(() => {
    void countdownTick;
    return secondsUntil(resendAvailableAt);
  }, [resendAvailableAt, countdownTick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const resendLabel = useMemo(() => {
    if (resendSeconds > 0) {
      return `Wyślij ponownie za ${formatCountdown(resendSeconds)}`;
    }
    return sending ? "Wysyłanie…" : "Wyślij kod ponownie";
  }, [resendSeconds, sending]);

  const handleResend = useCallback(async () => {
    if (busy || resendSeconds > 0) return;
    setSending(true);
    setBannerError("");
    setCodeError("");

    const result = await requestPasswordResetCode(accountId);
    setSending(false);

    if (!result.ok) {
      setBannerError(result.error);
      if (result.retryAfterSec) {
        setResendAvailableAt(
          new Date(Date.now() + result.retryAfterSec * 1000).toISOString()
        );
      }
      return;
    }

    setMaskedEmail(result.maskedEmail);
    setResendAvailableAt(result.resendAvailableAt);
    setCode("");
    lastAutoSubmittedCodeRef.current = null;
    const stored = readStoredPasswordResetSession();
    writeStoredPasswordResetSession({
      accountId,
      maskedEmail: result.maskedEmail,
      resendAvailableAt: result.resendAvailableAt,
      startedAt: stored?.startedAt ?? new Date().toISOString(),
    });
  }, [busy, accountId, resendSeconds]);

  const handleVerify = useCallback(async () => {
    if (busy || !codeComplete) return;
    setVerifying(true);
    setBannerError("");
    setCodeError("");

    const result = await verifyPasswordResetCode(accountId, code);
    setVerifying(false);

    if (!result.ok) {
      setCodeError(result.error);
      return;
    }

    writeStoredPasswordResetSession(null);
    const targetUrl = postLoginEnteringUrl(result.redirectTo);
    const hasResetFlag = targetUrl.includes("reset=otp");
    const urlWithResetFlag = hasResetFlag
      ? targetUrl
      : targetUrl.includes("?")
        ? `${targetUrl}&reset=otp`
        : `${targetUrl}?reset=otp`;
    window.location.assign(urlWithResetFlag);
  }, [busy, code, codeComplete, accountId]);

  useEffect(() => {
    if (code.length < OTP_LENGTH) {
      lastAutoSubmittedCodeRef.current = null;
    }
  }, [code]);

  useEffect(() => {
    if (!codeComplete || busy) return;
    if (lastAutoSubmittedCodeRef.current === code) return;

    lastAutoSubmittedCodeRef.current = code;
    const frame = requestAnimationFrame(() => {
      void handleVerify();
    });
    return () => cancelAnimationFrame(frame);
  }, [codeComplete, busy, code, handleVerify]);

  return (
    <div className="flex min-h-0 flex-col gap-4 sm:gap-5">
      {sessionNotice ? <Alert tone="warning">{sessionNotice}</Alert> : null}

      <Alert tone="info">
        Wysłaliśmy 6-cyfrowy kod na <strong>{maskedEmail}</strong>. Kod jest ważny 10 minut.
      </Alert>

      {bannerError ? <Alert tone="error">{bannerError}</Alert> : null}

      <OtpCodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (codeError) setCodeError("");
        }}
        disabled={busy}
        error={codeError || undefined}
      />

      <Button
        type="button"
        size="lg"
        className="w-full min-h-11"
        disabled={busy || !codeComplete}
        onClick={() => void handleVerify()}
      >
        {verifying ? "Sprawdzanie kodu…" : "Potwierdź kod"}
      </Button>

      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className={loginAltLinkClass}
          onClick={onBack}
          disabled={busy}
        >
          Wróć do logowania
        </button>
        <button
          type="button"
          className={cn(
            loginAltLinkClass,
            (busy || resendSeconds > 0) && "cursor-not-allowed opacity-60 hover:no-underline"
          )}
          onClick={() => void handleResend()}
          disabled={busy || resendSeconds > 0}
        >
          {resendLabel}
        </button>
      </div>
    </div>
  );
}
