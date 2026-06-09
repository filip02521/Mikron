import { Suspense } from "react";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { SetPasswordForm } from "./SetPasswordForm";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("setPassword");

export const dynamic = "force-dynamic";

export default function UstawHasloPage() {
  return (
    <AuthScreenLayout
      title="Ustaw hasło"
      subtitle="Wybierz bezpieczne hasło — po zapisaniu od razu przejdziesz do aplikacji OnTime"
    >
      <Suspense fallback={<p className="text-sm text-slate-500">Ładowanie…</p>}>
        <SetPasswordForm />
      </Suspense>
    </AuthScreenLayout>
  );
}
