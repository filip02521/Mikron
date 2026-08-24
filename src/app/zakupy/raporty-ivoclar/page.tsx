import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, IVOCLAR_RAPORTY_LEGACY_PATH } from "@/lib/auth-roles";
import { hasMailCenterModuleForUserId } from "@/lib/admin-modules";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass, panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export const metadata: Metadata = pageMetadataFor("ivoclarReport");
export const dynamic = "force-dynamic";

export default async function IvoclarReportMovedPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${IVOCLAR_RAPORTY_LEGACY_PATH}`);
  }

  const hasMailAccess =
    isAdmin(user.role) || (await hasMailCenterModuleForUserId(user.id));
  if (hasMailAccess) {
    redirect("/admin/mail");
  }

  return (
    <div className={adminPageShellClass}>
      <h1 className={cn(panelTypography.sectionTitle, "mb-2")}>Raporty Ivoclar — przeniesione</h1>
      <p className={cn(panelTypography.sectionDesc, "max-w-xl")}>
        Status i historia wysyłek są w Centrum maili (<code>/admin/mail</code>). Generowanie
        prowadzi OnTime Raporty.
      </p>
      <p className={cn(panelTypography.sectionDesc, "mt-3 max-w-xl")}>
        Nie masz uprawnień do podglądu logów. Poproś administratora o moduł{" "}
        <strong>Wysyłki Ivoclar (odczyt)</strong> w panelu Konta.
      </p>
    </div>
  );
}
