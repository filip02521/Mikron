import type { Metadata } from "next";
import { requireOperations } from "@/lib/auth";
import {
  actionListCustomsClearances,
  actionListCustomsSuppliers,
} from "@/app/actions/customs-clearance";
import { CustomsClearanceListClient } from "@/components/zakupy/customs/CustomsClearanceListClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadataFor, PAGE_DESCRIPTIONS, PAGE_TITLES } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("customsClearance");
export const dynamic = "force-dynamic";

export default async function CustomsClearancesPage() {
  await requireOperations("read");
  const [suppliers, clearances] = await Promise.all([
    actionListCustomsSuppliers(),
    actionListCustomsClearances(),
  ]);

  return (
    <div className={adminPageShellClass}>
      <PageHeader
        title={PAGE_TITLES.customsClearance}
        description={PAGE_DESCRIPTIONS.customsClearance}
      />
      <CustomsClearanceListClient suppliers={suppliers} clearances={clearances} />
    </div>
  );
}
