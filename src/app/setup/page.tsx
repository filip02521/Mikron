import { redirect } from "next/navigation";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";
import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { SetupForm } from "./SetupForm";
import { ClearSessionOnSetup } from "./ClearSessionOnSetup";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("setup");

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const showSetup = await needsBootstrapSetup();
  if (!showSetup) redirect("/login");

  return (
    <AuthScreenLayout
      title="Pierwsza konfiguracja"
      subtitle="Utwórz pierwsze konto administratora OnTime"
    >
      <ClearSessionOnSetup />
      <SetupForm />
    </AuthScreenLayout>
  );
}
