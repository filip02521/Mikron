import type { Metadata } from "next";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { actionIvoclarReportBootstrap } from "@/app/actions/ivoclar-report";
import { IvoclarReportWorkbench } from "@/components/zakupy/IvoclarReportWorkbench";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("ivoclarReport");
export const dynamic = "force-dynamic";
/** Paginacja FS + szczegół każdej faktury (tydzień ~800 GET). */
export const maxDuration = 180;

export default async function IvoclarReportPage() {
  await requireZdEstimateAdmin("read");
  const bootstrap = await actionIvoclarReportBootstrap();

  return (
    <div className={adminPageShellClass}>
      <IvoclarReportWorkbench bootstrap={bootstrap} />
    </div>
  );
}
