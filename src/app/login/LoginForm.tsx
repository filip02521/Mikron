"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { runLoginFlow } from "@/lib/auth/login-flow";
import { postLoginEnteringUrl } from "@/lib/auth/post-login-entering";
import { loginJsRequiredMessage, loginSessionLostMessage } from "@/lib/auth/login-messages";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import {
  readLoginAccountDisplayName,
  readLoginLastAccountId,
  readLoginRecentAccountIds,
  readLoginRecentEmails,
  rememberLoginAccountId,
  rememberLoginEmail,
  resolveLoginLastAccountId,
  resolveQuickLoginAccountId,
} from "@/lib/auth/login-account-preference";
import {
  buildLoginPageHref,
  loginFormModeFromParam,
  resolveInitialManualEmailLogin,
} from "@/lib/auth/login-initial-mode";
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
  modeParam: string | null,
  accounts: LoginDirectoryAccountPublic[]
): AccountSelection {
  const mode = loginFormModeFromParam(modeParam);
  if (mode === "picker") {
    return { selectedAccountId: null, showAccountPicker: true };
  }
  if (useManualEmail || mode === "email") {
    return { selectedAccountId: null, showAccountPicker: false };
  }

  const quickId = resolveQuickLoginAccountId(accounts);
  if (quickId) {
    return { selectedAccountId: quickId, showAccountPicker: false };
  }

  if (!hydrated || accounts.length === 0) {
    if (readLoginRecentAccountIds().length > 0) {
      return { selectedAccountId: null, showAccountPicker: true };
    }
    return { selectedAccountId: null, showAccountPicker: true };
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
  const router = useRouter();
  const directory = useLoginDirectorySearch(preloadedAccounts);
  const accounts = directory.accounts;
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const hydrated = useClientHydrated();
  const next = searchParams.get("next");
  const reason = searchParams.get("reason");
  const [accountSelectionOverride, setAccountSelectionOverride] =
    useState<AccountSelection | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [useManualEmail, setUseManualEmail] = useState(() =>
    resolveInitialManualEmailLogin({
      preloadedAccountCount: preloadedAccounts.length,
      modeParam,
    })
  );
  const [password, setPassword] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSessionOverride, setResetSessionOverride] = useState<{
    accountId: string;
    maskedEmail: string;
    resendAvailableAt: string;
  } | null>(null);
  const restoredResetSession = useStoredPasswordResetSession();
  const resetSession = resetSessionOverride ?? restoredResetSession;
  const errorRef = useRef<HTMLDivElement>(null);

  const syncLoginUrl = useCallback(
    (mode: "email" | "picker" | null) => {
      router.replace(buildLoginPageHref(mode, { next, reason }), { scroll: false });
    },
    [next, reason, router]
  );

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage + URL przed paint, bez migania UI */
  useLayoutEffect(() => {
    if (preloadedAccounts.length > 0) return;

    const mode = loginFormModeFromParam(modeParam);
    if (mode === "email") {
      setUseManualEmail(true);
      setAccountSelectionOverride(null);
      return;
    }
    if (mode === "picker") {
      setUseManualEmail(false);
      setAccountSelectionOverride({ selectedAccountId: null, showAccountPicker: true });
      return;
    }

    const quickId = resolveQuickLoginAccountId([]);
    if (quickId) {
      setUseManualEmail(false);
      setAccountSelectionOverride({ selectedAccountId: quickId, showAccountPicker: false });
      return;
    }

    if (readLoginRecentAccountIds().length > 0) {
      setUseManualEmail(false);
      setAccountSelectionOverride({ selectedAccountId: null, showAccountPicker: true });
      return;
    }

    setUseManualEmail(true);
    setAccountSelectionOverride(null);
  }, [modeParam, preloadedAccounts.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const derivedAccountSelection = useMemo(
    () => deriveAccountSelection(hydrated, useManualEmail, modeParam, accounts),
    [hydrated, useManualEmail, modeParam, accounts]
  );
  const { selectedAccountId, showAccountPicker } =
    accountSelectionOverride ?? derivedAccountSelection;

  const sessionNotice = useMemo(() => {
    if (reason === "session") return loginSessionLostMessage();
    if (reason === "js-required") return loginJsRequiredMessage();
    return "";
  }, [reason]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    const fromDirectory = accounts.find((account) => account.id === selectedAccountId);
    if (fromDirectory) return fromDirectory;
    const cachedName = readLoginAccountDisplayName(selectedAccountId);
    if (cachedName) return { id: selectedAccountId, displayName: cachedName };
    return null;
  }, [accounts, selectedAccountId]);

  const quickLoginActive =
    hydrated && !useManualEmail && Boolean(selectedAccount) && !showAccountPicker;

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
  const passwordInputDisabled = loading || (!useManualEmail && !selectedAccountId);

  const resolveManualLoginEmail = useCallback((): string => {
    const fromState = manualEmail.trim().toLowerCase();
    if (fromState) return fromState;
    return (
      document.querySelector<HTMLInputElement>('input[name="email"]')?.value?.trim().toLowerCase() ??
      ""
    );
  }, [manualEmail]);

  const syncManualEmailFromDom = useCallback(() => {
    const fromDom =
      document.querySelector<HTMLInputElement>('input[name="email"]')?.value?.trim().toLowerCase() ??
      "";
    if (fromDom && fromDom !== manualEmail.trim().toLowerCase()) {
      setManualEmail(fromDom);
    }
  }, [manualEmail]);

  const recentEmails = useMemo(
    () => (hydrated ? readLoginRecentEmails() : []),
    [hydrated]
  );

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

  const handleAccountChange = useCallback(
    (accountId: string) => {
      const account = accounts.find((entry) => entry.id === accountId);
      rememberLoginAccountId(accountId, account?.displayName);
      setAccountSelectionOverride({
        selectedAccountId: accountId,
        showAccountPicker: false,
      });
      setUseManualEmail(false);
      syncLoginUrl(null);
      setPassword("");
      setBannerError("");
      setPasswordError("");
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
      });
    },
    [accounts, syncLoginUrl]
  );

  const switchToManualEmail = useCallback(() => {
    directory.clearSearch();
    setUseManualEmail(true);
    setAccountSelectionOverride({
      selectedAccountId: null,
      showAccountPicker: false,
    });
    setPassword("");
    setBannerError("");
    setPasswordError("");
    syncLoginUrl("email");
  }, [directory, syncLoginUrl]);

  const switchToAccountPicker = useCallback(() => {
    const restored = resolveLoginLastAccountId(accounts, readLoginLastAccountId());
    setAccountSelectionOverride({
      selectedAccountId: restored,
      showAccountPicker: true,
    });
    setUseManualEmail(false);
    setPassword("");
    setBannerError("");
    setPasswordError("");
    syncLoginUrl("picker");
  }, [accounts, syncLoginUrl]);

  const showOtherAccountPicker = useCallback(() => {
    setAccountSelectionOverride((current) => {
      const selection = current ?? derivedAccountSelection;
      return {
        selectedAccountId: selection.selectedAccountId,
        showAccountPicker: true,
      };
    });
    setUseManualEmail(false);
    syncLoginUrl("picker");
    setPassword("");
    setBannerError("");
    setPasswordError("");
  }, [derivedAccountSelection, syncLoginUrl]);

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

    let emailForLogin: string | undefined;
    if (useManualEmail) {
      emailForLogin = resolveManualLoginEmail();
      if (!emailForLogin) {
        setBannerError("Podaj adres e-mail.");
        return;
      }
      if (emailForLogin !== manualEmail.trim().toLowerCase()) {
        setManualEmail(emailForLogin);
      }
    } else if (!selectedAccountId) {
      setBannerError("Wybierz konto z listy.");
      setAccountSelectionOverride({
        selectedAccountId: null,
        showAccountPicker: true,
      });
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
      email: emailForLogin,
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

    if (result.accountId) {
      const displayName =
        selectedAccount?.displayName ??
        accounts.find((account) => account.id === result.accountId)?.displayName;
      rememberLoginAccountId(result.accountId, displayName);
    }
    if (useManualEmail && emailForLogin) {
      rememberLoginEmail(emailForLogin);
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
        disabled={passwordInputDisabled}
        state={passwordError ? "error" : "default"}
      />
    </Field>
  );

  const submitBlock = (
    <Button
      type="submit"
      size="lg"
      className="w-full min-h-11 transition-opacity"
      disabled={loading || (!useManualEmail && !loginReady)}
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
    <form
      method="post"
      action="/api/auth/login-form"
      onSubmit={onSubmit}
      className="flex min-h-0 flex-col gap-4 sm:gap-5"
      noValidate
    >
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
                  onInput={syncManualEmailFromDom}
                  onBlur={syncManualEmailFromDom}
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
                  onClick={switchToManualEmail}
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
                  onClick={switchToAccountPicker}
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
