import { fetchWarehouseCarriers } from "@/lib/data/warehouse-carriers";
import { CarrierPhonesPageClient } from "@/components/carrier-phones/CarrierPhonesPageClient";
import { logDevPageError } from "@/lib/dev/log-page-error";
import { Alert } from "@/components/ui/Alert";
import { procurementArchivePageShellClass } from "@/lib/ui/ontime-theme";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("carriers");
export const dynamic = "force-dynamic";

export default async function KurierzyPage() {
  let carriers: Awaited<ReturnType<typeof fetchWarehouseCarriers>> = [];
  let loadError: string | null = null;

  try {
    carriers = await fetchWarehouseCarriers();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Nie udało się załadować listy kurierów.";
    logDevPageError("kurierzy/page", error);
  }

  return (
    <div className={procurementArchivePageShellClass}>
      {loadError ? (
        <Alert tone="warning" className="mb-4">
          {loadError}. Sprawdź połączenie z Supabase.
        </Alert>
      ) : null}
      <CarrierPhonesPageClient carriers={carriers} />
    </div>
  );
}
