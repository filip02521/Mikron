import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { AutoRefreshSettingsSection } from "@/components/settings/AutoRefreshSettingsSection";
import { AppearanceSettingsSection } from "@/components/settings/AppearanceSettingsSection";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { GmailSettingsSection } from "@/components/settings/GmailSettingsSection";
import { SalesOnboardingSettingsSection } from "@/components/settings/SalesOnboardingSettingsSection";
import { canAccessZdEstimate, isSalesAccount } from "@/lib/auth-roles";
import { getGmailOAuthConfig } from "@/lib/google/gmail";
import { getEmailSignature, getGmailConnection } from "@/lib/google/gmail-connections";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata = pageMetadata("Ustawienia", "Zarządzaj powiadomieniami i preferencjami.");

export const dynamic = "force-dynamic";

export default async function UstawieniaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const showGmail =
    canAccessZdEstimate(user.role, user.assignedWorkspaces) && getGmailOAuthConfig() != null;
  // Błąd bazy (np. niepełna migracja 172) wyłącza kartę Gmaila, nie całe ustawienia.
  const gmailData = showGmail
    ? await Promise.all([getGmailConnection(user.id), getEmailSignature(user.id)]).catch((e: unknown) => {
        console.error("[ustawienia] gmail", e);
        return null;
      })
    : null;
  const [gmail, signature] = gmailData ?? [null, ""];
  const gmailUnavailable = showGmail && !gmailData;

  return (
    <div className={salesPageShellClass}>
      <SettingsWorkspace
        title="Ustawienia"
        description="Zarządzaj powiadomieniami i preferencjami."
      >
        <NotificationSettingsSection role={user.role} />

        <AutoRefreshSettingsSection role={user.role} />

        {showGmail ? <GmailSettingsSection
            connectedEmail={gmail?.email ?? null}
            canReadReplies={gmail?.canReadReplies ?? false}
            signature={signature}
            unavailable={gmailUnavailable}
          /> : null}

        <AppearanceSettingsSection uniformBackground={user.uniformBackground} fontScale={user.fontScale} />

        {isSalesAccount(user.role) && user.salesPersonId ? <SalesOnboardingSettingsSection /> : null}
      </SettingsWorkspace>
    </div>
  );
}
