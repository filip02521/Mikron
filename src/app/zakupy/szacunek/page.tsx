import type { Metadata } from "next";
import { requireZdEstimateAdmin } from "@/lib/auth";
import {
  actionResolveZdEstimateScopeForSupplier,
  actionZdEstimateBootstrap,
} from "@/app/actions/zd-estimate";
import {
  ZdEstimateWorkbench,
  type ZdEstimateLaunchProps,
} from "@/components/zakupy/ZdEstimateWorkbench";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { zdEstimatePageShellClass } from "@/lib/ui/ontime-theme";
import { parseZdEstimateLaunchQuery } from "@/lib/orders/zd-estimate-supplier-scope";

export const metadata: Metadata = pageMetadataFor("zdEstimate");
export const dynamic = "force-dynamic";
/** Ciężki estimate (np. cecha ~1590 SKU) + resolve Subiekta. */
export const maxDuration = 180;

export default async function ZdEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    supplierId?: string;
    autorun?: string;
    mode?: string;
    grupaId?: string;
    cechaId?: string;
  }>;
}) {
  await requireZdEstimateAdmin("read");
  const params = await searchParams;
  const parsed = parseZdEstimateLaunchQuery(params);
  const bootstrap = await actionZdEstimateBootstrap();

  const wantAutorun = parsed.autorun && bootstrap.configured;

  let launch: ZdEstimateLaunchProps | null = null;
  if (parsed.supplierId || parsed.autorun) {
    launch = {
      fromDaily: parsed.fromDaily,
      supplierId: parsed.supplierId,
      supplierName: null,
      autorun: wantAutorun,
      needsAssign: false,
      mode: parsed.mode,
      grupaId: parsed.grupaId,
      cechaId: parsed.cechaId,
      label: null,
      resolveMessage: null,
      launchKey: null,
    };

    if (parsed.supplierId) {
      const resolved = await actionResolveZdEstimateScopeForSupplier(
        parsed.supplierId
      );
      if (resolved.ok) {
        const autorun = wantAutorun;
        launch = {
          ...launch,
          supplierId: resolved.supplierId,
          supplierName: resolved.supplierName,
          mode: resolved.mode,
          grupaId: resolved.grupaId,
          cechaId: resolved.cechaId,
          label: resolved.label,
          needsAssign: false,
          autorun,
          resolveMessage: null,
          launchKey: autorun ? crypto.randomUUID() : null,
        };
      } else {
        launch = {
          ...launch,
          supplierId: resolved.supplierId,
          supplierName: resolved.supplierName,
          needsAssign: true,
          autorun: false,
          mode: null,
          grupaId: null,
          cechaId: null,
          label: null,
          resolveMessage: resolved.message,
          launchKey: null,
        };
      }
    } else if (parsed.mode === "grupa" && parsed.grupaId) {
      launch = {
        ...launch,
        needsAssign: false,
        autorun: wantAutorun,
        launchKey: wantAutorun ? crypto.randomUUID() : null,
      };
    } else if (parsed.mode === "cecha" && parsed.cechaId) {
      launch = {
        ...launch,
        needsAssign: false,
        autorun: wantAutorun,
        launchKey: wantAutorun ? crypto.randomUUID() : null,
      };
    } else if (parsed.autorun) {
      launch = {
        ...launch,
        needsAssign: true,
        autorun: false,
        resolveMessage: "Brak dostawcy lub zakresu do automatycznego szacunku.",
        launchKey: null,
      };
    }
  }

  return (
    <div className={zdEstimatePageShellClass}>
      <PageHeader
        title="Szacunek ZD"
        description="Zakres Subiekta → lista do zamówienia → Utwórz ZD. „Do ZD” to jednostki dokumentu (z opakowań i próśb)."
        hint="Sandbox na testowym :5082. Live :5080 bez zmian. Opakowania i wykluczenia są trwałe i wspólne dla działu zakupów."
      />
      <ZdEstimateWorkbench bootstrap={bootstrap} launch={launch} />
    </div>
  );
}
