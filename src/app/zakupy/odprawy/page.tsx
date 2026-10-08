import type { Metadata } from "next";
import { requireOperations } from "@/lib/auth";
import {
  actionListCustomsClearances,
  actionListCustomsSuppliers,
} from "@/app/actions/customs-clearance";
import { CustomsClearanceListClient } from "@/components/zakupy/customs/CustomsClearanceListClient";
import { DhlShipmentsPanel } from "@/components/zakupy/customs/DhlShipmentsPanel";
import { DhlMailboxCard } from "@/components/zakupy/customs/DhlMailboxCard";
import { loadDhlShipments } from "@/lib/customs/dhl-data";
import { getGmailOAuthConfig } from "@/lib/google/gmail";
import { listSharedMailboxes } from "@/lib/google/gmail-connections";
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
  const canManageMailbox = (user.role === "admin" || user.role === "zakupy") && Boolean(getGmailOAuthConfig());
  const [suppliers, clearances, dhl, sharedMailboxes] = await Promise.all([
    actionListCustomsSuppliers(),
    actionListCustomsClearances(),
    loadDhlShipments(),
    canManageMailbox ? listSharedMailboxes() : Promise.resolve(null),
  ]);

  return (
    <div className={adminPageShellClass}>
      <PageHeader
        title={PAGE_TITLES.customsClearance}
        description={PAGE_DESCRIPTIONS.customsClearance}
      />
      {sharedMailboxes && !sharedMailboxes.length ? <DhlMailboxCard mailboxes={sharedMailboxes} /> : null}
      {dhl ? <DhlShipmentsPanel shipments={dhl} suppliers={suppliers} /> : null}
      {sharedMailboxes?.length ? <DhlMailboxCard mailboxes={sharedMailboxes} /> : null}
      <CustomsClearanceListClient
        suppliers={suppliers}
        clearances={clearances}
        aiEnabled={isCustomsAiConfigured()}
      />
    </div>
  );
}
