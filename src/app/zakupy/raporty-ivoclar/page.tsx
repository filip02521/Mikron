import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, IVOCLAR_RAPORTY_LEGACY_PATH } from "@/lib/auth-roles";
import { hasMailCenterModuleForUserId } from "@/lib/admin-modules";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader
        title="Raporty Ivoclar"
        description="Status i historia wysyłek są teraz w Centrum maili. Generowanie prowadzi OnTime Raporty."
      />
      <Alert tone="info" title="Brak dostępu do Centrum maili">
        Nie masz uprawnień do podglądu logów wysyłek. Poproś administratora o moduł{" "}
        <strong className="font-semibold">Wysyłki Ivoclar (odczyt)</strong> w panelu Konta.
      </Alert>
    </div>
  );
}
