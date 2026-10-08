import type { Metadata } from "next";
import { requireOperations } from "@/lib/auth";
import {
  actionListCustomsClearances,
  actionListCustomsSuppliers,
} from "@/app/actions/customs-clearance";
import { CustomsClearanceListClient } from "@/components/zakupy/customs/CustomsClearanceListClient";
import { CustomsMailPanel } from "@/components/zakupy/customs/CustomsMailPanel";
import { DhlShipmentsPanel } from "@/components/zakupy/customs/DhlShipmentsPanel";
import { loadDhlShipments } from "@/lib/customs/dhl-data";
import { loadCustomsMail } from "@/lib/supplier-mail/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { isCustomsAiConfigured } from "@/lib/customs/customs-ai";
import { pageMetadataFor, PAGE_DESCRIPTIONS, PAGE_TITLES } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("customsClearance");
export const dynamic = "force-dynamic";
/** Odczyt faktur / deklaracji przez AI (Gemini) trwa do kilku minut. */
export const maxDuration = 300;

export default async function CustomsClearancesPage() {
  const user = await requireOperations("read");
  // Treść maili z cudzych skrzynek — jak Poczta w Asystencie: tylko admin i zakupy.
  const canSeeMail = user.role === "admin" || user.role === "zakupy";
  const [suppliers, clearances, dhl, agencyMail] = await Promise.all([
    actionListCustomsSuppliers(),
    actionListCustomsClearances(),
    loadDhlShipments(),
    // Poczta agencji nie może zatrzymać listy odpraw (np. brak migracji, błąd bazy) — wtedy bez panelu.
    canSeeMail ? loadCustomsMail().catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className={adminPageShellClass}>
      <PageHeader
        title={PAGE_TITLES.customsClearance}
        description={PAGE_DESCRIPTIONS.customsClearance}
      />
      {dhl ? <DhlShipmentsPanel shipments={dhl} suppliers={suppliers} /> : null}
      <CustomsMailPanel threads={agencyMail} />
      <CustomsClearanceListClient
        suppliers={suppliers}
        clearances={clearances}
        aiEnabled={isCustomsAiConfigured()}
      />
    </div>
  );
}
