"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { AuthBootLoadingState } from "@/components/auth/AuthBootLoadingState";
import {
  AUTH_ENTERING_SUBTITLE,
  AUTH_ENTERING_TITLE,
} from "@/lib/auth/auth-entering-copy";
import { resolvePostLoginTarget } from "@/lib/auth/post-login-entering";

function AuthEnteringLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthScreenLayout
      title={AUTH_ENTERING_TITLE}
      subtitle={AUTH_ENTERING_SUBTITLE}
      hideCompactQuote
    >
      {children}
    </AuthScreenLayout>
  );
}

function AuthEnteringScreenInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = resolvePostLoginTarget(searchParams.get("next"));
    window.location.assign(target);
  }, [searchParams]);

  return <AuthBootLoadingState />;
}

export function AuthEnteringScreen() {
  return (
    <Suspense
      fallback={
        <AuthEnteringLayout>
          <AuthBootLoadingState />
        </AuthEnteringLayout>
      }
    >
      <AuthEnteringLayout>
        <AuthEnteringScreenInner />
      </AuthEnteringLayout>
    </Suspense>
  );
}
