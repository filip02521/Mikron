import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { AutoRefreshSettingsSection } from "@/components/settings/AutoRefreshSettingsSection";
import { AppearanceSettingsSection } from "@/components/settings/AppearanceSettingsSection";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata = pageMetadata("Ustawienia", "Zarządzaj powiadomieniami i preferencjami.");

export const dynamic = "force-dynamic";

export default async function UstawieniaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className={salesPageShellClass}>
      <SettingsWorkspace
        title="Ustawienia"
        description="Zarządzaj powiadomieniami i preferencjami."
      >
        <NotificationSettingsSection role={user.role} />

        <AutoRefreshSettingsSection role={user.role} />

        <AppearanceSettingsSection uniformBackground={user.uniformBackground} fontScale={user.fontScale} />
      </SettingsWorkspace>
    </div>
  );
}
