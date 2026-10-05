import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/auth";
import { PriceListReviewClient } from "@/components/zakupy/price-lists/PriceListReviewClient";
import { getPriceListImport, listPriceListItems } from "@/lib/price-lists/data";
import { getPricesHost } from "@/lib/price-lists/subiekt-prices";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

export const metadata: Metadata = pageMetadataFor("priceLists");
export const dynamic = "force-dynamic";
/** Partia zapisu cen przez Sferę (~20 pozycji) mieści się w tym limicie. */
export const maxDuration = 300;

export default async function PriceListReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperations("read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const imp = await getPriceListImport(id);
  if (!imp) notFound();
  const items = await listPriceListItems(id);
  const host = getPricesHost();

  return (
    <div className={adminPageShellClass}>
      <PriceListReviewClient
        imp={imp}
        items={items}
        hostLabel={host.ok ? host.host.label : null}
        hostMatches={host.ok && host.host.hostKind === imp.hostKind}
      />
    </div>
  );
}
