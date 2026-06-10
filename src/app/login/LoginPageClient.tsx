"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";
import {
  LOGIN_SUBTITLE_PICKER,
  loginSubtitleForMode,
  type LoginSubtitleMode,
} from "@/lib/auth/login-form-copy";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { LoginForm } from "./LoginForm";

function LoginPageClientInner({ accounts }: { accounts: LoginDirectoryAccount[] }) {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const [subtitle, setSubtitle] = useState(LOGIN_SUBTITLE_PICKER);

  const handleSubtitleModeChange = (mode: LoginSubtitleMode) => {
    setSubtitle(loginSubtitleForMode(mode));
  };

  return (
    <AuthScreenLayout
      title="Zaloguj się"
      subtitle={subtitle}
      hideCompactQuote={reason === "session"}
    >
      <LoginForm accounts={accounts} onSubtitleModeChange={handleSubtitleModeChange} />
    </AuthScreenLayout>
  );
}

export function LoginPageClient({ accounts }: { accounts: LoginDirectoryAccount[] }) {
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
