"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import {
  LOGIN_SUBTITLE_PICKER,
  loginSubtitleForMode,
  loginTitleForMode,
  type LoginSubtitleMode,
} from "@/lib/auth/login-form-copy";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { LoginForm } from "./LoginForm";

function LoginPageClientInner({ accounts }: { accounts: LoginDirectoryAccountPublic[] }) {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const [subtitleMode, setSubtitleMode] = useState<LoginSubtitleMode>("picker");
  const [subtitle, setSubtitle] = useState(LOGIN_SUBTITLE_PICKER);

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
