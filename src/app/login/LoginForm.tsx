"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { runLoginFlow } from "@/lib/auth/login-flow";
import { loginSessionLostMessage } from "@/lib/auth/login-messages";
import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";
import {
  readLoginLastAccountId,
  resolveLoginLastAccountId,
  writeLoginLastAccountId,
} from "@/lib/auth/login-account-preference";
import { applyLoginFormError } from "@/lib/auth/login-form-errors";
import type { LoginSubtitleMode } from "@/lib/auth/login-form-copy";
import { LoginAccountPicker } from "@/components/auth/LoginAccountPicker";
import { LoginQuickAccountGreeting } from "@/components/auth/LoginQuickAccountGreeting";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";

const loginAltLinkClass = cn(
  "text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
);

export function LoginForm({
  accounts,
  onSubtitleModeChange,
}: {
  accounts: LoginDirectoryAccount[];
  onSubtitleModeChange?: (mode: LoginSubtitleMode) => void;
}) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const reason = searchParams.get("reason");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(true);
  const [manualEmail, setManualEmail] = useState("");
  const [useManualEmail, setUseManualEmail] = useState(() => accounts.length === 0);
  const [password, setPassword] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const sessionNotice = useMemo(
    () => (reason === "session" ? loginSessionLostMessage() : ""),
    [reason]
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const quickLoginActive =
    !useManualEmail &&
    accounts.length > 0 &&
    Boolean(selectedAccount) &&
    !showAccountPicker;

  useEffect(() => {
    if (!onSubtitleModeChange) return;
    const mode: LoginSubtitleMode = useManualEmail
      ? "manual"
      : quickLoginActive
        ? "quick"
        : "picker";
    onSubtitleModeChange(mode);
  }, [useManualEmail, quickLoginActive, onSubtitleModeChange]);

  const loginEmail = useManualEmail
    ? manualEmail.trim().toLowerCase()
    : (selectedAccount?.email ?? "");

  const restoreKey = `${useManualEmail}\0${accounts.map((account) => account.id).join(",")}`;
  const [appliedRestoreKey, setAppliedRestoreKey] = useState("");
  if (!useManualEmail && accounts.length > 0 && restoreKey !== appliedRestoreKey) {
    setAppliedRestoreKey(restoreKey);
    const restored = resolveLoginLastAccountId(accounts);
    if (restored) {
      setSelectedAccountId(restored);
      setShowAccountPicker(false);
    } else {
      setSelectedAccountId(null);
      setShowAccountPicker(true);
    }
  }

  useEffect(() => {
    if (!quickLoginActive) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [quickLoginActive]);

  useEffect(() => {
    const message = bannerError;
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [bannerError]);

  const handleAccountChange = useCallback((accountId: string) => {
    writeLoginLastAccountId(accountId);
    setSelectedAccountId(accountId);
    setShowAccountPicker(false);
    setBannerError("");
    setPasswordError("");
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
    });
  }, []);

  const showOtherAccountPicker = useCallback(() => {
    setShowAccountPicker(true);
    setBannerError("");
    setPasswordError("");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBannerError("");
    setPasswordError("");

    if (!loginEmail) {
      setBannerError(useManualEmail ? "Podaj adres e-mail." : "Wybierz konto z listy.");
      if (!useManualEmail) setShowAccountPicker(true);
      return;
    }

    if (!password.trim()) {
      setPasswordError("Podaj hasło.");
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
      });
      return;
    }

    setLoading(true);

    const result = await runLoginFlow(loginEmail, password, next);

    if (!result.ok) {
      setLoading(false);
      const placement = applyLoginFormError(result.error, {
        setPasswordError,
        setBannerError,
      });
      if (placement === "password") {
        requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
        });
      }
      return;
    }

    window.location.assign(result.redirectTo);
  }

  const passwordField = (
    <Field
      label="Hasło"
      hint={
        !quickLoginActive && !useManualEmail && !selectedAccount
          ? "Najpierw wybierz konto z listy."
          : undefined
      }
      error={passwordError || undefined}
      state={passwordError ? "error" : "default"}
    >
      <Input
        type="password"
        name="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (passwordError) setPasswordError("");
        }}
        disabled={!loginEmail || loading}
        state={passwordError ? "error" : "default"}
      />
    </Field>
  );

  const submitBlock = (
    <Button
      type="submit"
      size="lg"
      className="w-full min-h-11 transition-opacity"
      disabled={loading || !loginEmail}
    >
      {loading ? "Logowanie…" : "Zaloguj się"}
    </Button>
  );

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-col gap-4 sm:gap-5" noValidate>
      <noscript>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Do logowania wymagany jest JavaScript w przeglądarce.
        </p>
      </noscript>

      {sessionNotice ? <Alert tone="warning">{sessionNotice}</Alert> : null}

      {bannerError ? (
        <div ref={errorRef} id="login-banner-error" className="scroll-mb-3">
          <Alert tone="error">{bannerError}</Alert>
        </div>
      ) : null}

      {loginEmail ? (
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={loginEmail}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
      ) : null}

      {quickLoginActive && selectedAccount ? (
        <div className="space-y-4 sm:space-y-5">
          <LoginQuickAccountGreeting displayName={selectedAccount.displayName} />
          {passwordField}
          {submitBlock}
          <div className="flex justify-end">
            <button
              type="button"
              className={loginAltLinkClass}
              onClick={showOtherAccountPicker}
              disabled={loading}
            >
              To nie Ty? Wybierz inne konto
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 shrink space-y-3 sm:space-y-4">
            {useManualEmail ? (
              <Field label="E-mail">
                <Input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                  spellCheck={false}
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Konto">
                <LoginAccountPicker
                  accounts={accounts}
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  disabled={loading}
                />
              </Field>
            )}

            {accounts.length > 0 && !useManualEmail ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={loginAltLinkClass}
                  onClick={() => {
                    setUseManualEmail(true);
                    setSelectedAccountId(null);
                    setShowAccountPicker(true);
                    setBannerError("");
                    setPasswordError("");
                  }}
                  disabled={loading}
                >
                  Zaloguj na inny adres e-mail
                </button>
              </div>
            ) : null}

            {accounts.length > 0 && useManualEmail ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={loginAltLinkClass}
                  onClick={() => {
                    const restored = resolveLoginLastAccountId(
                      accounts,
                      readLoginLastAccountId()
                    );
                    setSelectedAccountId(restored);
                    setShowAccountPicker(!restored);
                    setUseManualEmail(false);
                    setBannerError("");
                    setPasswordError("");
                  }}
                  disabled={loading}
                >
                  Wybierz konto z listy
                </button>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-3 sm:space-y-4">
            {passwordField}
            {submitBlock}
          </div>
        </>
      )}
    </form>
  );
}
