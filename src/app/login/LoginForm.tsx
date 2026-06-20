"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { runLoginFlow } from "@/lib/auth/login-flow";
import { postLoginEnteringUrl } from "@/lib/auth/post-login-entering";
import { loginSessionLostMessage } from "@/lib/auth/login-messages";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import {
  readLoginLastAccountId,
  readLoginRecentEmails,
  rememberLoginAccountId,
  rememberLoginEmail,
  resolveLoginLastAccountId,
} from "@/lib/auth/login-account-preference";
import { applyLoginFormError } from "@/lib/auth/login-form-errors";
import type { LoginSubtitleMode } from "@/lib/auth/login-form-copy";
import {
  LOGIN_RESET_LINK_HINT,
  LOGIN_RESET_LINK_LABEL,
  LOGIN_RESET_LINK_SENDING,
} from "@/lib/auth/login-form-copy";
import { requestPasswordResetCode } from "@/lib/auth/password-reset-client";
import { writeStoredPasswordResetSession } from "@/lib/auth/login-password-reset-session";
import { useStoredPasswordResetSession } from "@/lib/auth/use-stored-password-reset-session";
import { LoginAccountPicker } from "@/components/auth/LoginAccountPicker";
import { useLoginDirectorySearch } from "@/lib/auth/use-login-directory-search";
import { LoginQuickAccountGreeting } from "@/components/auth/LoginQuickAccountGreeting";
import { PasswordResetPanel } from "@/components/auth/PasswordResetPanel";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";

const loginAltLinkClass = cn(
  "text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
);

type AccountSelection = {
  selectedAccountId: string | null;
  showAccountPicker: boolean;
};

function deriveAccountSelection(
  hydrated: boolean,
  useManualEmail: boolean,
  accounts: LoginDirectoryAccountPublic[]
): AccountSelection {
  if (!hydrated || useManualEmail || accounts.length === 0) {
    return { selectedAccountId: null, showAccountPicker: true };
  }

  const restored = resolveLoginLastAccountId(accounts);
  if (restored) {
    return { selectedAccountId: restored, showAccountPicker: false };
  }

  return { selectedAccountId: null, showAccountPicker: true };
}

export function LoginForm({
  accounts: preloadedAccounts,
  onSubtitleModeChange,
}: {
  accounts: LoginDirectoryAccountPublic[];
  onSubtitleModeChange?: (mode: LoginSubtitleMode) => void;
}) {
  const directory = useLoginDirectorySearch(preloadedAccounts);
  const accounts = directory.accounts;
  const searchParams = useSearchParams();
  const hydrated = useClientHydrated();
  const next = searchParams.get("next");
  const reason = searchParams.get("reason");
  const [accountSelectionOverride, setAccountSelectionOverride] =
    useState<AccountSelection | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [useManualEmail, setUseManualEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);
  const [resetSessionOverride, setResetSessionOverride] = useState<{
    accountId: string;
    maskedEmail: string;
    resendAvailableAt: string;
  } | null>(null);
  const restoredResetSession = useStoredPasswordResetSession();
  const resetSession = resetSessionOverride ?? restoredResetSession;
  const errorRef = useRef<HTMLDivElement>(null);

  const derivedAccountSelection = useMemo(
    () => deriveAccountSelection(hydrated, useManualEmail, accounts),
    [hydrated, useManualEmail, accounts]
  );
  const { selectedAccountId, showAccountPicker } =
    accountSelectionOverride ?? derivedAccountSelection;

  const sessionNotice = useMemo(
    () => (reason === "session" ? loginSessionLostMessage() : ""),
    [reason]
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const quickLoginActive =
    hydrated &&
    !useManualEmail &&
    accounts.length > 0 &&
    Boolean(selectedAccount) &&
    !showAccountPicker;

  const subtitleMode: LoginSubtitleMode = resetSession
    ? "reset"
    : useManualEmail
      ? "manual"
      : quickLoginActive
        ? "quick"
        : "picker";
  const lastSubtitleModeRef = useRef<LoginSubtitleMode | null>(null);

  useEffect(() => {
    if (!onSubtitleModeChange) return;
    if (lastSubtitleModeRef.current === subtitleMode) return;
    lastSubtitleModeRef.current = subtitleMode;
    onSubtitleModeChange(subtitleMode);
  }, [onSubtitleModeChange, subtitleMode]);

  const loginReady = useManualEmail ? Boolean(manualEmail.trim()) : Boolean(selectedAccountId);

  useEffect(() => {
    if (!hydrated) return;
    setRecentEmails(readLoginRecentEmails());
  }, [hydrated]);

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
    rememberLoginAccountId(accountId);
    setAccountSelectionOverride({
      selectedAccountId: accountId,
      showAccountPicker: false,
    });
    setPassword("");
    setBannerError("");
    setPasswordError("");
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
    });
  }, []);

  const showOtherAccountPicker = useCallback(() => {
    setAccountSelectionOverride((current) => {
      const selection = current ?? derivedAccountSelection;
      return {
        selectedAccountId: selection.selectedAccountId,
        showAccountPicker: true,
      };
    });
    setPassword("");
    setBannerError("");
    setPasswordError("");
  }, [derivedAccountSelection]);

  const canResetPassword = !useManualEmail && Boolean(selectedAccountId);

  const exitPasswordReset = useCallback(() => {
    setResetSessionOverride(null);
    writeStoredPasswordResetSession(null);
    setBannerError("");
    setPasswordError("");
    setResetSending(false);
  }, []);

  const persistResetSession = useCallback(
    (session: { accountId: string; maskedEmail: string; resendAvailableAt: string }) => {
      setResetSessionOverride(session);
      writeStoredPasswordResetSession({
        ...session,
        startedAt: new Date().toISOString(),
      });
    },
    []
  );

  const startPasswordReset = useCallback(async () => {
    if (!canResetPassword || !selectedAccountId || resetSending) return;

    setResetSending(true);
    setBannerError("");
    setPasswordError("");

    const result = await requestPasswordResetCode(selectedAccountId);
    setResetSending(false);

    if (!result.ok) {
      setBannerError(result.error);
      return;
    }

    persistResetSession({
      accountId: selectedAccountId,
      maskedEmail: result.maskedEmail,
      resendAvailableAt: result.resendAvailableAt,
    });
  }, [canResetPassword, selectedAccountId, resetSending, persistResetSession]);

  const forgotPasswordLink = canResetPassword ? (
    <div className="space-y-1">
      <div className="flex justify-end">
        <button
          type="button"
          className={loginAltLinkClass}
          onClick={() => void startPasswordReset()}
          disabled={loading || resetSending}
        >
          {resetSending ? LOGIN_RESET_LINK_SENDING : LOGIN_RESET_LINK_LABEL}
        </button>
      </div>
      <p className="text-right text-xs text-slate-500">{LOGIN_RESET_LINK_HINT}</p>
    </div>
  ) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBannerError("");
    setPasswordError("");

    if (!loginReady) {
      setBannerError(useManualEmail ? "Podaj adres e-mail." : "Wybierz konto z listy.");
      if (!useManualEmail) {
        setAccountSelectionOverride({
          selectedAccountId: null,
          showAccountPicker: true,
        });
      }
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

    const result = await runLoginFlow({
      accountId: useManualEmail ? null : selectedAccountId,
      email: useManualEmail ? manualEmail.trim().toLowerCase() : undefined,
      password,
      next,
    });

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

    if (useManualEmail) {
      rememberLoginEmail(manualEmail.trim().toLowerCase());
    } else if (selectedAccountId) {
      rememberLoginAccountId(selectedAccountId);
    }

    window.location.assign(postLoginEnteringUrl(result.redirectTo));
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
        disabled={!loginReady || loading}
        state={passwordError ? "error" : "default"}
      />
    </Field>
  );

  const submitBlock = (
    <Button
      type="submit"
      size="lg"
      className="w-full min-h-11 transition-opacity"
      disabled={loading || !loginReady}
    >
      {loading ? "Logowanie…" : "Zaloguj się"}
    </Button>
  );

  if (resetSession) {
    return (
      <PasswordResetPanel
        accountId={resetSession.accountId}
        maskedEmail={resetSession.maskedEmail}
        resendAvailableAt={resetSession.resendAvailableAt}
        sessionNotice={sessionNotice || undefined}
        onBack={exitPasswordReset}
      />
    );
  }

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

      {useManualEmail && hydrated && manualEmail.trim() ? (
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={manualEmail.trim().toLowerCase()}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
      ) : null}

      {quickLoginActive && selectedAccount ? (
        <div className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <LoginQuickAccountGreeting displayName={selectedAccount.displayName} />
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
          {passwordField}
          {submitBlock}
          {forgotPasswordLink}
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
                  list={recentEmails.length > 0 ? "login-recent-emails" : undefined}
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
                {recentEmails.length > 0 ? (
                  <datalist id="login-recent-emails">
                    {recentEmails.map((email) => (
                      <option key={email} value={email} />
                    ))}
                  </datalist>
                ) : null}
              </Field>
            ) : (
              <Field label="Konto">
                <LoginAccountPicker
                  accounts={accounts}
                  value={selectedAccountId}
                  onChange={handleAccountChange}
                  disabled={loading}
                  searchRequired={directory.searchRequired}
                  query={directory.query}
                  onQueryChange={directory.setQuery}
                  loading={directory.loading}
                  minQueryLength={directory.minQueryLength}
                  fetchError={directory.fetchError}
                />
              </Field>
            )}

            {!useManualEmail ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={loginAltLinkClass}
                  onClick={() => {
                    setUseManualEmail(true);
                    setAccountSelectionOverride({
                      selectedAccountId: null,
                      showAccountPicker: true,
                    });
                    setPassword("");
                    setBannerError("");
                    setPasswordError("");
                  }}
                  disabled={loading}
                >
                  Zaloguj na inny adres e-mail
                </button>
              </div>
            ) : null}

            {useManualEmail ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={loginAltLinkClass}
                  onClick={() => {
                    const restored = resolveLoginLastAccountId(
                      accounts,
                      readLoginLastAccountId()
                    );
                    setAccountSelectionOverride({
                      selectedAccountId: restored,
                      showAccountPicker: !restored,
                    });
                    setUseManualEmail(false);
                    setPassword("");
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
            {forgotPasswordLink}
          </div>
        </>
      )}
    </form>
  );
}
