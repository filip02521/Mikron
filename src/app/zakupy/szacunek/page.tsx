import type { Metadata } from "next";
import { requireOperations } from "@/lib/auth";
import { actionZdEstimateBootstrap } from "@/app/actions/zd-estimate";
import { ZdEstimateWorkbench } from "@/components/zakupy/ZdEstimateWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { zdEstimatePageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("zdEstimate");
export const dynamic = "force-dynamic";

export default async function ZdEstimatePage() {
  await requireOperations("read");
  const bootstrap = await actionZdEstimateBootstrap();

  return (
    <div className={zdEstimatePageShellClass}>
      <PageHeader
        title="Szacunek ZD"
        description="Lista do zamówienia jak w procesie ręcznym — grupa Subiekta, zapas OnTime, sprzedaż i stany. Kolumna „Do ZD” to ilość do wpisania w dokumencie (z uwzględnieniem opakowań)."
        hint="Sandbox na testowym :5082. Live :5080 bez zmian. Opakowania i wykluczenia są trwałe i wspólne dla działu zakupów."
      />
      <ZdEstimateWorkbench bootstrap={bootstrap} />
    </div>
  );
}
