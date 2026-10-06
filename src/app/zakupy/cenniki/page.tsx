import type { Metadata } from "next";
import { requireOperations } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriceListsClient } from "@/components/zakupy/price-lists/PriceListsClient";
import { listPriceListImports } from "@/lib/price-lists/data";
import { getPricesHost } from "@/lib/price-lists/subiekt-prices";
import { pageMetadataFor, PAGE_DESCRIPTIONS, PAGE_TITLES } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("priceLists");
export const dynamic = "force-dynamic";
/** Porównanie ~1500 towarów to ~1500 odczytów cen z Subiekta. */
export const maxDuration = 300;

export default async function PriceListsPage() {
  await requireOperations("read");
  const host = getPricesHost();
  const imports = await listPriceListImports();

  return (
    <div className={adminPageShellClass}>
      <PageHeader title={PAGE_TITLES.priceLists} description={PAGE_DESCRIPTIONS.priceLists} />
      <PriceListsClient
        imports={imports}
        host={host.ok ? { label: host.host.label, isLive: host.host.hostKind === "live" } : null}
        hostError={host.ok ? null : host.error}
      />
    </div>
  );
}
