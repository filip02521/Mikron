import type { Metadata } from "next";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-roles";
import { loadZdAutomatKpi } from "@/lib/data/zd-kpi-weekly";
import { loadZdSkuClassSummary } from "@/lib/data/zd-sku-class-sync";
import { ZdAutomatPanel } from "@/components/zakupy/ZdAutomatPanel";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("zdAutomat");
export const dynamic = "force-dynamic";
/** „Przelicz” uruchamia klasy i KPI przez `after()` — działa w limicie czasu tej trasy. */
export const maxDuration = 1800;

export default async function ZdAutomatPage() {
  const user = await requireZdEstimateAdmin("read");
  const [kpi, classes] = await Promise.all([loadZdAutomatKpi(), loadZdSkuClassSummary()]);
  return (
    <div className={adminPageShellClass}>
      <ZdAutomatPanel kpi={kpi} classes={classes} canRecompute={isAdmin(user.role)} />
    </div>
  );
}
