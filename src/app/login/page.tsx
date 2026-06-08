import { Suspense } from "react";
import { redirect } from "next/navigation";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { LoginForm } from "./LoginForm";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("login");

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await needsBootstrapSetup()) redirect("/setup");

  return (
    <AuthScreenLayout title="Zaloguj się">
      <Suspense fallback={<p className="text-sm text-slate-500">Ładowanie…</p>}>
        <LoginForm />
      </Suspense>
    </AuthScreenLayout>
  );
}
