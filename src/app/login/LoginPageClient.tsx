"use client";

import { Suspense, useCallback, useLayoutEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import {
  LOGIN_SUBTITLE_PICKER,
  loginSubtitleForMode,
  loginTitleForMode,
  type LoginSubtitleMode,
} from "@/lib/auth/login-form-copy";
import { resolveClientLoginSubtitleMode } from "@/lib/auth/login-client-subtitle";
import { resolveInitialManualEmailLogin } from "@/lib/auth/login-initial-mode";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { LoginForm } from "./LoginForm";

function LoginPageClientInner({ accounts }: { accounts: LoginDirectoryAccountPublic[] }) {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const modeParam = searchParams.get("mode");
  const initialSubtitleMode: LoginSubtitleMode = resolveInitialManualEmailLogin({
    preloadedAccountCount: accounts.length,
    modeParam,
  })
    ? "manual"
    : "picker";
  const [subtitleMode, setSubtitleMode] = useState<LoginSubtitleMode>(initialSubtitleMode);
  const [subtitle, setSubtitle] = useState(loginSubtitleForMode(initialSubtitleMode));

  /* eslint-disable react-hooks/set-state-in-effect -- subtitle z localStorage przed paint */
  useLayoutEffect(() => {
    const clientMode = resolveClientLoginSubtitleMode({
      preloadedAccountCount: accounts.length,
      modeParam,
    });
    setSubtitleMode(clientMode);
    setSubtitle(loginSubtitleForMode(clientMode));
  }, [accounts.length, modeParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubtitleModeChange = useCallback((mode: LoginSubtitleMode) => {
    setSubtitleMode(mode);
    setSubtitle(loginSubtitleForMode(mode));
  }, []);

  return (
    <AuthScreenLayout
      title={loginTitleForMode(subtitleMode)}
      subtitle={subtitle}
      hideCompactQuote={reason === "session"}
    >
      <LoginForm accounts={accounts} onSubtitleModeChange={handleSubtitleModeChange} />
    </AuthScreenLayout>
  );
}

export function LoginPageClient({ accounts }: { accounts: LoginDirectoryAccountPublic[] }) {
  return (
    <Suspense
      fallback={
        <AuthScreenLayout title="Zaloguj się" subtitle={LOGIN_SUBTITLE_PICKER}>
          <p className="text-sm text-slate-500">Ładowanie…</p>
        </AuthScreenLayout>
      }
    >
      <LoginPageClientInner accounts={accounts} />
    </Suspense>
  );
}
