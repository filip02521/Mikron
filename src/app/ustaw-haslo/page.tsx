import { AuthScreenLayout } from "@/components/auth/AuthScreenLayout";
import { SetPasswordForm } from "./SetPasswordForm";

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
