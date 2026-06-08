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
      subtitle="Ustaw hasło do konta OnTime (link od administratora)"
    >
      <SetPasswordForm />
    </AuthScreenLayout>
  );
}
